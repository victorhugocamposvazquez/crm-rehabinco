import sharp from "sharp";
import { imagenDeRespuestaGemini } from "./retoque-respuesta";

const MODELO_DEFECTO = "gemini-2.5-flash-image";

export function claveGemini(): string {
  return process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() || "";
}

export function modeloGeminiImagen(): string {
  return process.env.GEMINI_IMAGE_MODEL?.trim() || MODELO_DEFECTO;
}

export async function jpegParaModelo(imagen: Buffer): Promise<Buffer> {
  return sharp(imagen)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
}

export async function retocarFotoGemini(input: { imagen: Buffer; prompt: string }): Promise<Buffer> {
  const clave = claveGemini();
  if (!clave) {
    throw new Error("Falta GEMINI_API_KEY en el servidor.");
  }
  const jpeg = await jpegParaModelo(input.imagen);
  const modelo = modeloGeminiImagen();
  const respuesta = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent?key=${encodeURIComponent(clave)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(50_000),
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: input.prompt },
              { inlineData: { mimeType: "image/jpeg", data: jpeg.toString("base64") } },
            ],
          },
        ],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      }),
    }
  );
  const cuerpo = (await respuesta.json().catch(() => null)) as { error?: { message?: string } } | null;
  if (!respuesta.ok) {
    const detalle = cuerpo?.error?.message?.trim();
    throw new Error(detalle || "El retoque no ha respondido.");
  }
  const imagen = imagenDeRespuestaGemini(cuerpo);
  if (!imagen) throw new Error("El retoque no ha devuelto una foto.");
  const bytes = Buffer.from(imagen.base64, "base64");
  return sharp(bytes).rotate().jpeg({ quality: 86 }).toBuffer();
}
