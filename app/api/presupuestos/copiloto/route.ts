import { generateText, Output, gateway, type ModelMessage } from "ai";
import { NextResponse } from "next/server";
import {
  COPILOTO_HISTORIAL_MAX,
  COPILOTO_MAX_BYTES,
  COPILOTO_MAX_FILES,
  COPILOTO_TEXTO_MAX,
  INSTRUCCION_ADJUNTOS,
  MODELO_COPILOTO,
  MODELO_COPILOTO_FALLBACK,
  copilotoLlmSchema,
  copilotoOutputSchema,
  estadoDesdeBorrador,
  normalizarOutput,
  snapshotEstado,
  systemPromptCopiloto,
  type CopilotoOutput,
  type EstadoCopiloto,
  type HistorialCopiloto,
} from "@/lib/ai/presupuesto-copiloto";
import { esDocBinario, esDocx, extractDocxText } from "@/lib/ai/extract-docx";
import { extractPdfText } from "@/lib/ai/extract-pdf";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hayAuthGateway() {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

function extraerJson(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1].trim() : trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("El modelo no devolvió JSON.");
  return JSON.parse(raw.slice(start, end + 1));
}

function textoError(err: unknown) {
  if (err instanceof Error) return err.message;
  return String(err);
}

function mensajeErrorCopiloto(err: unknown): { status: number; error: string } {
  const message = textoError(err);
  const statusCode =
    typeof err === "object" && err && "statusCode" in err && typeof (err as { statusCode: unknown }).statusCode === "number"
      ? (err as { statusCode: number }).statusCode
      : undefined;
  if (/API key|OIDC|Unauthenticated|not authenticated/i.test(message) || statusCode === 401) {
    return {
      status: 503,
      error:
        "Falta configurar la pasarela de IA (AI Gateway). En Vercel: activa AI Gateway. En local: vercel env pull o AI_GATEWAY_API_KEY.",
    };
  }
  if (/credit|quota|billing|payment|insufficient/i.test(message) || statusCode === 402) {
    return {
      status: 402,
      error: "Sin crédito en AI Gateway. Añade créditos en Vercel → AI Gateway.",
    };
  }
  if (/timeout|ETIMEDOUT|timed out|deadline/i.test(message) || statusCode === 504) {
    return {
      status: 504,
      error: "La IA tardó demasiado. Prueba con menos adjuntos o una petición más concreta.",
    };
  }
  const short = message.replace(/\s+/g, " ").slice(0, 280);
  return {
    status: 502,
    error: short ? `No se pudo generar la propuesta: ${short}` : "No se pudo generar la propuesta.",
  };
}

function debeReintentarSinEsquema(err: unknown) {
  const message = textoError(err);
  if (/API key|OIDC|Unauthenticated|credit|quota|timeout|ETIMEDOUT/i.test(message)) return false;
  return /schema|default is not|json schema|tool|unparseable|No object generated|response_format/i.test(message);
}

function respuestaSse(run: (emit: (payload: { output?: CopilotoOutput; error?: string }) => void) => Promise<void>) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (payload: { output?: CopilotoOutput; error?: string }) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          /* stream cerrado */
        }
      }, 4000);
      try {
        await run(emit);
      } catch (err) {
        console.error("[copiloto]", err);
        emit({ error: mensajeErrorCopiloto(err).error });
      } finally {
        clearInterval(ping);
        controller.close();
      }
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

async function generarPresupuesto(opts: {
  system: string;
  messages: ModelMessage[];
}): Promise<CopilotoOutput> {
  const common = {
    model: gateway(MODELO_COPILOTO),
    system: opts.system,
    messages: opts.messages,
    maxOutputTokens: 16_000,
    providerOptions: {
      gateway: {
        models: [MODELO_COPILOTO_FALLBACK],
      },
    },
  };

  try {
    const result = await generateText({
      ...common,
      output: Output.object({
        schema: copilotoLlmSchema,
        name: "presupuesto",
        description: "Presupuesto completo resultante tras la petición del usuario",
      }),
    });
    const parsed = copilotoOutputSchema.safeParse(result.output);
    if (parsed.success) return normalizarOutput(parsed.data);
    throw new Error("El modelo no devolvió un presupuesto válido. Inténtalo de nuevo con una petición más concreta.");
  } catch (err) {
    console.error("[copiloto] structured", err);
    if (!debeReintentarSinEsquema(err)) throw err;
  }

  const result = await generateText({
    ...common,
    system: `${opts.system}\n\nResponde SOLO con un JSON válido del presupuesto completo (resumen, sugerencias, concepto, porcentaje_descuento, lineas, propuesta). Sin markdown.`,
  });
  const parsed = copilotoOutputSchema.safeParse(extraerJson(result.text));
  if (!parsed.success) {
    throw new Error("El modelo no devolvió un presupuesto válido. Inténtalo de nuevo con una petición más concreta.");
  }
  return normalizarOutput(parsed.data);
}

const MIME_OK = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/octet-stream",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);

function mimeDeArchivo(file: File) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (file.type && MIME_OK.has(file.type)) return file.type;
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".md")) return "text/markdown";
  if (name.endsWith(".csv")) return "text/csv";
  if (name.endsWith(".txt")) return "text/plain";
  return file.type;
}

function esTexto(mediaType: string) {
  return mediaType.startsWith("text/") || mediaType === "text/markdown" || mediaType === "text/csv";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sesión expirada" }, { status: 401 });
  }
  if (process.env.NODE_ENV !== "production" && !hayAuthGateway()) {
    return NextResponse.json(
      {
        error:
          "Falta configurar la pasarela de IA (AI Gateway). En local: vercel env pull o AI_GATEWAY_API_KEY.",
      },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "No se pudo leer la petición." }, { status: 400 });
  }

  const rawPayload = form.get("payload");
  if (typeof rawPayload !== "string") {
    return NextResponse.json({ error: "Falta el estado del presupuesto." }, { status: 400 });
  }

  let payload: {
    instrucciones?: unknown;
    historial?: unknown;
    estado?: unknown;
    borrador?: unknown;
  };
  try {
    payload = JSON.parse(rawPayload) as typeof payload;
  } catch {
    return NextResponse.json({ error: "El estado del presupuesto no es válido." }, { status: 400 });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length > COPILOTO_MAX_FILES) {
    return NextResponse.json({ error: `Máximo ${COPILOTO_MAX_FILES} archivos.` }, { status: 400 });
  }
  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
  if (totalBytes > COPILOTO_MAX_BYTES) {
    return NextResponse.json(
      { error: "Los adjuntos pesan demasiado (máx. 4 MB en total). Comprime el PDF o recorta páginas." },
      { status: 400 }
    );
  }

  let instrucciones = typeof payload.instrucciones === "string" ? payload.instrucciones.trim() : "";
  if (!instrucciones && files.length > 0) {
    instrucciones = INSTRUCCION_ADJUNTOS;
  }
  if (!instrucciones) {
    return NextResponse.json(
      { error: "Escribe qué quieres que haga el copiloto o adjunta un Word/PDF." },
      { status: 400 }
    );
  }

  const estado = payload.estado as EstadoCopiloto | undefined;
  if (!estado || (estado.emisor !== "garal" && estado.emisor !== "rehabinco")) {
    return NextResponse.json({ error: "Estado de presupuesto incompleto." }, { status: 400 });
  }

  const historial = Array.isArray(payload.historial)
    ? (payload.historial as HistorialCopiloto[])
        .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
        .slice(-COPILOTO_HISTORIAL_MAX)
    : [];

  let borrador: CopilotoOutput | null = null;
  if (payload.borrador && typeof payload.borrador === "object") {
    const parsedBorrador = copilotoOutputSchema.safeParse(payload.borrador);
    if (parsedBorrador.success) {
      borrador = normalizarOutput(parsedBorrador.data);
    }
  }

  const partes: Array<{ type: "text"; text: string }> = [];

  for (const file of files) {
    if (esDocBinario(file)) {
      return NextResponse.json(
        { error: `${file.name} es .doc antiguo. Ábrelo en Word y guárdalo como .docx.` },
        { status: 400 }
      );
    }
    const mediaType = mimeDeArchivo(file);
    if (mediaType === "application/pdf") {
      try {
        const buf = new Uint8Array(await file.arrayBuffer());
        const texto = await extractPdfText(buf);
        if (!texto) {
          return NextResponse.json(
            { error: `${file.name} no tiene texto (parece un escaneo). Pásalo a Word o pega el contenido.` },
            { status: 400 }
          );
        }
        partes.push({
          type: "text",
          text: `--- Archivo ${file.name} (PDF extraído a texto) ---\n${texto.slice(0, COPILOTO_TEXTO_MAX)}`,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : `No se pudo leer ${file.name}.`;
        return NextResponse.json({ error: msg }, { status: 400 });
      }
      continue;
    }
    if (esDocx(file) || mediaType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      try {
        const buf = new Uint8Array(await file.arrayBuffer());
        const texto = extractDocxText(buf);
        if (!texto) {
          return NextResponse.json(
            { error: `${file.name} no tiene texto. Si es un escaneo, exporta a PDF.` },
            { status: 400 }
          );
        }
        partes.push({
          type: "text",
          text: `--- Archivo ${file.name} (Word extraído a texto) ---\n${texto.slice(0, COPILOTO_TEXTO_MAX)}`,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : `No se pudo leer ${file.name}.`;
        return NextResponse.json({ error: msg }, { status: 400 });
      }
      continue;
    }
    if (!esTexto(mediaType)) {
      return NextResponse.json(
        { error: `No se admite ${file.name}. Usa Word (.docx), PDF o texto (.txt, .md, .csv).` },
        { status: 400 }
      );
    }
    const texto = await file.text();
    partes.push({
      type: "text",
      text: `--- Archivo ${file.name} ---\n${texto.slice(0, COPILOTO_TEXTO_MAX)}`,
    });
  }

  const mesa = files.map((f) => f.name);
  const baseJson = snapshotEstado(estado);
  const borradorJson = borrador ? snapshotEstado(estadoDesdeBorrador(estado, borrador)) : null;
  const encabezado = [
    mesa.length > 0
      ? `Documentos en la mesa de esta sesión (siguen vigentes): ${mesa.join(", ")}.`
      : "No hay documentos en la mesa en este envío.",
    "",
    "ESTADO del formulario (ya aceptado en el CRM):",
    JSON.stringify(baseJson, null, 2),
    "",
    borradorJson
      ? `BORRADOR en curso (aún no volcado al formulario). Aplica la petición SOBRE ESTE borrador y conserva el resto:\n${JSON.stringify(borradorJson, null, 2)}`
      : "No hay borrador en curso: parte del ESTADO del formulario.",
    "",
    `Petición del usuario:\n${instrucciones}`,
  ].join("\n");

  const messages: ModelMessage[] = [
    ...historial.map((m) => ({ role: m.role, content: m.text })),
    {
      role: "user" as const,
      content: [
        {
          type: "text" as const,
          text: encabezado,
        },
        ...partes,
      ],
    },
  ];

  return respuestaSse(async (emit) => {
    const output = await generarPresupuesto({
      system: systemPromptCopiloto(estado.emisor),
      messages,
    });
    emit({ output });
  });
}
