import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, type ModelMessage } from "ai";
import { NextResponse } from "next/server";
import {
  COPILOTO_HISTORIAL_MAX,
  COPILOTO_MAX_BYTES,
  COPILOTO_MAX_FILES,
  COPILOTO_TEXTO_MAX,
  COPILOTO_TEXTO_TOTAL,
  COPILOTO_MAX_PDF_VISUAL,
  INSTRUCCION_ADJUNTOS,
  MODELO_COPILOTO,
  MODELO_COPILOTO_FALLBACK,
  copilotoOutputSchema,
  estadoDesdeBorrador,
  normalizarOutput,
  snapshotEstado,
  systemPromptCopiloto,
  type CopilotoOutput,
  type EstadoCopiloto,
  type HistorialCopiloto,
} from "@/lib/ai/presupuesto-copiloto";
import { usoDesdeSdk, type UsoCopiloto } from "@/lib/ai/presupuesto-consumo";
import { esDocBinario, esDocx, extractDocxText } from "@/lib/ai/extract-docx";
import { extractPdfText } from "@/lib/ai/extract-pdf";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function recortarAdjunto(nombre: string, etiqueta: string, texto: string, cupo: number) {
  const cuerpo = texto.length > cupo ? `${texto.slice(0, cupo)}\n[…texto recortado]` : texto;
  return {
    bloque: `--- Archivo ${nombre} (${etiqueta}) ---\n${cuerpo}`,
    usado: Math.min(texto.length, cupo),
  };
}

const anthropic = createAnthropic();

function hayApiAnthropic() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function extraerJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("El modelo no devolvió JSON.");
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const bloques = fence ? [fence[1].trim(), trimmed] : [trimmed];
  for (const raw of bloques) {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) continue;
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      /* probar el siguiente bloque */
    }
  }
  throw new Error("El modelo no devolvió JSON.");
}

function extraerTextoAnidado(value: unknown, depth = 0): string {
  if (depth > 4 || value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value !== "object") return "";
  const o = value as Record<string, unknown>;
  for (const key of ["message", "error", "msg", "detail", "errorMessage"]) {
    const hit = extraerTextoAnidado(o[key], depth + 1);
    if (hit) return hit;
  }
  return "";
}

function textoError(err: unknown): string {
  if (err == null) return "";
  if (typeof err === "string") return err;
  if (typeof err !== "object") return String(err);
  const e = err as {
    name?: unknown;
    message?: unknown;
    statusCode?: unknown;
    responseBody?: unknown;
    data?: unknown;
    cause?: unknown;
    url?: unknown;
  };
  const name = typeof e.name === "string" ? e.name : "";
  const message = typeof e.message === "string" ? e.message.trim() : "";
  const body =
    typeof e.responseBody === "string"
      ? e.responseBody
      : e.data != null
        ? typeof e.data === "string"
          ? e.data
          : JSON.stringify(e.data)
        : "";
  const nested = extraerTextoAnidado(e.data) || extraerTextoAnidado(e.cause);
  const cause = e.cause ? textoError(e.cause) : "";
  const chunks = [message, nested, body.slice(0, 400), cause].filter((s) => {
    const t = s.replace(/\s+/g, " ").trim();
    return t && t !== name && t !== "AI_APICallError";
  });
  const out = chunks.join(" · ").replace(/\s+/g, " ").trim();
  if (out) return out;
  if (message && message !== "AI_APICallError") return message;
  if (typeof e.statusCode === "number") return `Error HTTP ${e.statusCode} al llamar al modelo.`;
  return "";
}

function mensajeErrorCopiloto(err: unknown): { status: number; error: string } {
  const name = typeof err === "object" && err && "name" in err ? String((err as { name: unknown }).name) : "";
  const message = textoError(err);
  const statusCode =
    typeof err === "object" && err && "statusCode" in err && typeof (err as { statusCode: unknown }).statusCode === "number"
      ? (err as { statusCode: number }).statusCode
      : undefined;
  if (/API key|x-api-key|invalid.?api.?key|Unauthenticated|not authenticated|authentication/i.test(message) || statusCode === 401) {
    return {
      status: 503,
      error:
        "Falta ANTHROPIC_API_KEY en Vercel (API de tu cuenta Claude). Añádela en Settings → Environment Variables (Production y Preview) y en .env.local.",
    };
  }
  if (/credit|quota|billing|payment|insufficient|rate.?limit/i.test(message) || statusCode === 402 || statusCode === 429) {
    return {
      status: 402,
      error: "Sin crédito o límite en tu cuenta de Anthropic. Revisa facturación en console.anthropic.com.",
    };
  }
  if (
    name === "AbortError" ||
    name === "TimeoutError" ||
    /timeout|ETIMEDOUT|timed out|deadline|aborted/i.test(message) ||
    statusCode === 504
  ) {
    return {
      status: 504,
      error: "La IA no terminó a tiempo con estos documentos. Vuelve a intentarlo; si se repite, envía un Word cada vez.",
    };
  }
  if (/model.*(not found|does not exist|unavailable)|unknown model/i.test(message) || statusCode === 404) {
    return {
      status: 502,
      error: "El modelo de IA no está disponible ahora. Vuelve a intentarlo en un momento.",
    };
  }
  if (/pdf|file part|media type|unsupported.*(file|document|pdf)|invalid.*content/i.test(message)) {
    return {
      status: 502,
      error:
        "No se pudo leer este archivo con el modelo. Si es un PDF de Design (sin texto), inténtalo de nuevo; si se repite, adjunta también el Word.",
    };
  }
  const short = message.replace(/\s+/g, " ").slice(0, 280);
  return {
    status: 502,
    error: short ? `No se pudo generar la propuesta: ${short}` : "No se pudo generar la propuesta. Vuelve a intentarlo.",
  };
}

const CACHE_PROMPT = {
  anthropic: { cacheControl: { type: "ephemeral" as const, ttl: "1h" as const } },
};

async function llamarModelo(opts: {
  model: string;
  system: string;
  messages: ModelMessage[];
}): Promise<{ output: CopilotoOutput; uso: UsoCopiloto }> {
  const result = await generateText({
    model: anthropic(opts.model),
    messages: [
      {
        role: "system",
        content: `${opts.system}

Responde SOLO con un JSON válido (sin markdown) con: resumen, sugerencias, concepto, porcentaje_descuento, lineas, propuesta.`,
        providerOptions: CACHE_PROMPT,
      },
      ...opts.messages,
    ],
    maxOutputTokens: 12_000,
    reasoning: "none",
    abortSignal: AbortSignal.timeout(55_000),
    maxRetries: 0,
    providerOptions: {
      anthropic: {
        thinking: { type: "disabled" },
        effort: "low",
      },
    },
  });
  const texto = result.text?.trim() ?? "";
  if (!texto) {
    throw new Error("El modelo no devolvió texto. Inténtalo de nuevo.");
  }
  const parsed = copilotoOutputSchema.safeParse(extraerJson(texto));
  if (!parsed.success) {
    throw new Error("El modelo no devolvió un presupuesto válido. Inténtalo de nuevo con una petición más concreta.");
  }
  return {
    output: normalizarOutput(parsed.data),
    uso: usoDesdeSdk(opts.model, result.usage),
  };
}

function esFalloIrrecuperable(err: unknown) {
  const mapped = mensajeErrorCopiloto(err);
  return mapped.status === 401 || mapped.status === 402 || mapped.status === 503 || mapped.status === 504;
}

async function generarPresupuesto(opts: {
  system: string;
  messages: ModelMessage[];
  hayAdjuntos: boolean;
  hayBorrador: boolean;
}): Promise<{ output: CopilotoOutput; uso: UsoCopiloto }> {
  const primario = opts.hayAdjuntos || !opts.hayBorrador ? MODELO_COPILOTO : MODELO_COPILOTO_FALLBACK;
  const intentos = primario === MODELO_COPILOTO ? [MODELO_COPILOTO, MODELO_COPILOTO_FALLBACK] : [MODELO_COPILOTO_FALLBACK];
  let last: unknown;
  for (const model of intentos) {
    try {
      return await llamarModelo({
        model,
        system: opts.system,
        messages: opts.messages,
      });
    } catch (err) {
      last = err;
      console.error("[copiloto] modelo", model, err);
      if (esFalloIrrecuperable(err)) throw err;
    }
  }
  throw last instanceof Error ? last : new Error("No se pudo generar la propuesta.");
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
  if (!hayApiAnthropic()) {
    return NextResponse.json(
      {
        error:
          "Falta ANTHROPIC_API_KEY. En Vercel: Settings → Environment Variables (Production y Preview). En local: .env.local.",
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
    mesa?: unknown;
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

  const partes: Array<
    | { type: "text"; text: string }
    | { type: "file"; data: Uint8Array; mediaType: string; filename?: string }
  > = [];
  let cupoRestante = COPILOTO_TEXTO_TOTAL;
  let pdfVisuales = 0;

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
        if (texto) {
          const cupo = Math.min(COPILOTO_TEXTO_MAX, Math.max(0, cupoRestante));
          if (cupo <= 0) {
            partes.push({
              type: "text",
              text: `--- Archivo ${file.name} omitido: se alcanzó el tope de texto de esta sesión. ---`,
            });
          } else {
            const recorte = recortarAdjunto(file.name, "PDF extraído a texto", texto, cupo);
            cupoRestante -= recorte.usado;
            partes.push({ type: "text", text: recorte.bloque });
          }
        } else {
          pdfVisuales += 1;
          if (pdfVisuales > COPILOTO_MAX_PDF_VISUAL) {
            return NextResponse.json(
              { error: `Máximo ${COPILOTO_MAX_PDF_VISUAL} PDF visuales (tipo Riazor) por envío.` },
              { status: 400 }
            );
          }
          partes.push({
            type: "file",
            data: buf,
            mediaType: "application/pdf",
            filename: file.name,
          });
          partes.push({
            type: "text",
            text: `--- ${file.name}: PDF visual (plantilla CRM/Riazor o escaneo, sin capa de texto). Extrae DATOS (partidas, textos, cifras). El diseño lo aplica el CRM. ---`,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : `No se pudo leer ${file.name}.`;
        return NextResponse.json({ error: msg }, { status: 400 });
      }
      continue;
    }
    if (cupoRestante <= 0) {
      partes.push({
        type: "text",
        text: `--- Archivo ${file.name} omitido: se alcanzó el tope de texto de esta sesión. ---`,
      });
      continue;
    }
    const cupo = Math.min(COPILOTO_TEXTO_MAX, cupoRestante);
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
        const recorte = recortarAdjunto(file.name, "Word extraído a texto", texto, cupo);
        cupoRestante -= recorte.usado;
        partes.push({ type: "text", text: recorte.bloque });
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
    const recorte = recortarAdjunto(file.name, "texto", texto, cupo);
    cupoRestante -= recorte.usado;
    partes.push({ type: "text", text: recorte.bloque });
  }

  const mesaNombres = Array.isArray(payload.mesa)
    ? payload.mesa.filter((n): n is string => typeof n === "string" && n.trim().length > 0)
    : files.map((f) => f.name);
  const baseJson = snapshotEstado(estado);
  const borradorJson = borrador ? snapshotEstado(estadoDesdeBorrador(estado, borrador)) : null;
  const encabezado = [
    mesaNombres.length > 0
      ? files.length > 0
        ? `Documentos nuevos en este envío (léelos): ${files.map((f) => f.name).join(", ")}. En la mesa también: ${mesaNombres.join(", ")}.`
        : `Documentos ya leídos en esta sesión (no se reenvían): ${mesaNombres.join(", ")}. Usa el BORRADOR como fuente.`
      : "No hay documentos en la mesa en este envío.",
    "",
    borradorJson
      ? `BORRADOR en curso. Aplica la petición SOBRE ESTE borrador y conserva el resto:\n${JSON.stringify(borradorJson)}`
      : `ESTADO del formulario (ya aceptado en el CRM):\n${JSON.stringify(baseJson)}`,
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

  try {
    const { output, uso } = await generarPresupuesto({
      system: systemPromptCopiloto(estado.emisor),
      messages,
      hayAdjuntos: files.length > 0,
      hayBorrador: Boolean(borrador),
    });
    return NextResponse.json({ output, uso });
  } catch (err) {
    console.error("[copiloto]", err);
    const mapped = mensajeErrorCopiloto(err);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
