import { extractText, getDocumentProxy } from "unpdf";

/** Extrae el texto de un PDF. Los escaneos sin capa de texto quedan vacíos. */
export async function extractPdfText(data: Uint8Array): Promise<string> {
  try {
    const pdf = await getDocumentProxy(data);
    const { text } = await extractText(pdf, { mergePages: true });
    const raw = Array.isArray(text) ? text.join("\n") : text;
    return raw.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  } catch {
    throw new Error("No se pudo leer el PDF. Prueba a exportarlo otra vez o pega el texto.");
  }
}
