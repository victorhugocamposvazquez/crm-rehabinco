import { strFromU8, unzipSync } from "fflate";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function esDocx(file: { name: string; type: string }) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx")) return true;
  return file.type === DOCX_MIME;
}

export function esDocBinario(file: { name: string }) {
  return file.name.toLowerCase().endsWith(".doc") && !file.name.toLowerCase().endsWith(".docx");
}

function decodeXml(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/** Extrae el texto de un .docx (Word moderno). No abre .doc binario. */
export function extractDocxText(data: Uint8Array): string {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data);
  } catch {
    throw new Error("No se pudo abrir el Word. Guárdalo otra vez como .docx.");
  }
  const xmlBytes = files["word/document.xml"];
  if (!xmlBytes) {
    throw new Error("El Word no contiene texto legible.");
  }
  const xml = strFromU8(xmlBytes);
  let out = "";
  const re = /<w:t\b[^>]*>([^<]*)<\/w:t>|<\/w:p>|<\/w:tr>|<w:tab\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    if (m[1] !== undefined) out += decodeXml(m[1]);
    else if (m[0] === "<w:tab/>") out += "\t";
    else out += "\n";
  }
  return out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
