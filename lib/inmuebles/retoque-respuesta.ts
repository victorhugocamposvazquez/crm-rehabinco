export function imagenDeRespuestaGemini(body: unknown): { base64: string; mime: string } | null {
  if (!body || typeof body !== "object") return null;
  const candidatos = (body as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidatos)) return null;
  for (const candidato of candidatos) {
    if (!candidato || typeof candidato !== "object") continue;
    const partes = (candidato as { content?: { parts?: unknown } }).content?.parts;
    if (!Array.isArray(partes)) continue;
    for (const parte of partes) {
      if (!parte || typeof parte !== "object") continue;
      const rec = parte as Record<string, unknown>;
      const inline = (rec.inlineData ?? rec.inline_data) as Record<string, unknown> | undefined;
      if (!inline || typeof inline !== "object") continue;
      const data = inline.data ?? inline.bytes;
      const mime = inline.mimeType ?? inline.mime_type;
      if (typeof data === "string" && data.trim()) {
        return { base64: data.trim(), mime: typeof mime === "string" && mime ? mime : "image/png" };
      }
    }
  }
  return null;
}
