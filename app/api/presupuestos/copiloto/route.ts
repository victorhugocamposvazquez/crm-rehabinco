import { generateText, Output, type ModelMessage } from "ai";
import { NextResponse } from "next/server";
import {
  COPILOTO_MAX_BYTES,
  COPILOTO_MAX_FILES,
  copilotoOutputSchema,
  modeloCopiloto,
  normalizarOutput,
  systemPromptCopiloto,
  type CopilotoOutput,
  type EstadoCopiloto,
  type HistorialCopiloto,
} from "@/lib/ai/presupuesto-copiloto";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;
export const runtime = "nodejs";

const MIME_OK = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/octet-stream",
]);

function mimeDeArchivo(file: File) {
  const name = file.name.toLowerCase();
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
  };
  try {
    payload = JSON.parse(rawPayload) as typeof payload;
  } catch {
    return NextResponse.json({ error: "El estado del presupuesto no es válido." }, { status: 400 });
  }

  const instrucciones = typeof payload.instrucciones === "string" ? payload.instrucciones.trim() : "";
  if (!instrucciones) {
    return NextResponse.json({ error: "Escribe qué quieres que haga el copiloto." }, { status: 400 });
  }

  const estado = payload.estado as EstadoCopiloto | undefined;
  if (!estado || (estado.emisor !== "garal" && estado.emisor !== "rehabinco")) {
    return NextResponse.json({ error: "Estado de presupuesto incompleto." }, { status: 400 });
  }

  const historial = Array.isArray(payload.historial)
    ? (payload.historial as HistorialCopiloto[])
        .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
        .slice(-8)
    : [];

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length > COPILOTO_MAX_FILES) {
    return NextResponse.json({ error: `Máximo ${COPILOTO_MAX_FILES} archivos.` }, { status: 400 });
  }
  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
  if (totalBytes > COPILOTO_MAX_BYTES) {
    return NextResponse.json(
      { error: "Los adjuntos pesan demasiado (máx. 3,5 MB en total). Comprime el PDF o recorta páginas." },
      { status: 400 }
    );
  }

  const partes: Array<{ type: "text"; text: string } | { type: "file"; data: Uint8Array; mediaType: string; filename?: string }> =
    [];
  let tienePdf = false;

  for (const file of files) {
    const mediaType = mimeDeArchivo(file);
    if (mediaType === "application/pdf") {
      tienePdf = true;
      const buf = new Uint8Array(await file.arrayBuffer());
      partes.push({ type: "file", data: buf, mediaType: "application/pdf", filename: file.name });
      continue;
    }
    if (!esTexto(mediaType)) {
      return NextResponse.json(
        { error: `No se admite ${file.name}. Usa PDF o texto (.txt, .md, .csv).` },
        { status: 400 }
      );
    }
    const texto = await file.text();
    partes.push({
      type: "text",
      text: `--- Archivo ${file.name} ---\n${texto.slice(0, 80_000)}`,
    });
  }

  const messages: ModelMessage[] = [
    ...historial.map((m) => ({ role: m.role, content: m.text })),
    {
      role: "user" as const,
      content: [
        {
          type: "text" as const,
          text: `Estado actual del presupuesto (JSON). Úsalo como base y aplica la petición.\n${JSON.stringify(
            {
              emisor: estado.emisor,
              concepto: estado.concepto,
              porcentaje_impuesto: estado.porcentaje_impuesto,
              porcentaje_descuento: estado.porcentaje_descuento,
              lineas: estado.lineas,
              propuesta: estado.propuesta,
            },
            null,
            2
          )}\n\nPetición del usuario:\n${instrucciones}`,
        },
        ...partes,
      ],
    },
  ];

  try {
    const result = await generateText({
      model: modeloCopiloto(tienePdf),
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
