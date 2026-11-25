import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { extractPdfText } from "../ai/extract-pdf";
import { INSTRUCCIONES_RESUMEN, resumenNotaSchema, type ResumenNota } from "./resumen";

export const MODELO_NOTA_SIMPLE = process.env.NOTA_SIMPLE_MODEL || "claude-sonnet-5-5";

/**
 * Lee el PDF de una nota simple y devuelve el resumen estructurado.
 * Sin clave de Anthropic o con un PDF escaneado sin texto, devuelve null
 * (la nota queda guardada igualmente).
 */
export async function leerNotaSimple(pdf: Uint8Array): Promise<{ resumen: ResumenNota; modelo: string } | { resumen: null; motivo: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return { resumen: null, motivo: "Lectura automática no configurada (falta ANTHROPIC_API_KEY)." };
  const texto = await extractPdfText(pdf);
  if (texto.length < 200) return { resumen: null, motivo: "El PDF no tiene texto (parece escaneado)." };
  const anthropic = createAnthropic({ apiKey });
  const { object } = await generateObject({
    model: anthropic(MODELO_NOTA_SIMPLE),
    schema: resumenNotaSchema,
    system: INSTRUCCIONES_RESUMEN,
    prompt: texto.slice(0, 60_000),
  });
  return { resumen: object, modelo: MODELO_NOTA_SIMPLE };
}
