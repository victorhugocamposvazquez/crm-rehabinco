import { generateText, Output, type ModelMessage } from "ai";
import { NextResponse } from "next/server";
import {
  COPILOTO_HISTORIAL_MAX,
  COPILOTO_MAX_BYTES,
  COPILOTO_MAX_FILES,
  COPILOTO_TEXTO_MAX,
  INSTRUCCION_ADJUNTOS,
  copilotoOutputSchema,
  estadoDesdeBorrador,
  modeloCopiloto,
  normalizarOutput,
  snapshotEstado,
  systemPromptCopiloto,
  type CopilotoOutput,
  type EstadoCopiloto,
  type HistorialCopiloto,
} from "@/lib/ai/presupuesto-copiloto";
import { esDocBinario, esDocx, extractDocxText } from "@/lib/ai/extract-docx";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;
export const runtime = "nodejs";

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
      { error: "Los adjuntos pesan demasiado (máx. 6 MB en total). Comprime el PDF o recorta páginas." },
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

  const partes: Array<{ type: "text"; text: string } | { type: "file"; data: Uint8Array; mediaType: string; filename?: string }> =
    [];
  let tieneDocumento = false;

  for (const file of files) {
    if (esDocBinario(file)) {
      return NextResponse.json(
        { error: `${file.name} es .doc antiguo. Ábrelo en Word y guárdalo como .docx.` },
        { status: 400 }
      );
    }
    const mediaType = mimeDeArchivo(file);
    if (mediaType === "application/pdf") {
      tieneDocumento = true;
      const buf = new Uint8Array(await file.arrayBuffer());
      partes.push({ type: "file", data: buf, mediaType: "application/pdf", filename: file.name });
      continue;
    }
    if (esDocx(file) || mediaType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      tieneDocumento = true;
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

  try {
    const result = await generateText({
      model: modeloCopiloto(tieneDocumento),
      system: systemPromptCopiloto(estado.emisor),
      messages,
      output: Output.object({
        schema: copilotoOutputSchema,
        name: "presupuesto",
        description: "Presupuesto completo resultante tras la petición del usuario",
      }),
    });
    const parsed = copilotoOutputSchema.safeParse(result.output);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "El modelo no devolvió un presupuesto válido. Inténtalo de nuevo con una petición más concreta." },
        { status: 422 }
      );
    }
    const output: CopilotoOutput = normalizarOutput(parsed.data);
    return NextResponse.json({ output });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al generar la propuesta";
    return NextResponse.json(
      { error: message.includes("API key") || message.includes("OIDC")
          ? "Falta configurar la pasarela de IA (AI Gateway). En local: vercel env pull o AI_GATEWAY_API_KEY."
          : "No se pudo generar la propuesta. Revisa los adjuntos o inténtalo de nuevo." },
      { status: 502 }
    );
  }
}
