import sharp from "sharp";
import {
  datosPublicacion,
  plantillaPublicacion,
  svgPublicacion,
  type FichaParaPublicacion,
  type PlantillaPublicacionId,
} from "./publicacion-plantilla";

export async function renderPublicacion(input: {
  foto: Buffer;
  plantillaId: PlantillaPublicacionId;
  ficha: FichaParaPublicacion;
  marca?: string;
  logo?: Buffer | null;
}): Promise<Buffer> {
  const plantilla = plantillaPublicacion(input.plantillaId);
  if (!plantilla) throw new Error("Plantilla desconocida.");
  const datos = datosPublicacion(input.ficha, input.marca);
  let logoDataUri: string | null = null;
  if (input.logo && input.logo.length) {
    try {
      const png = await sharp(input.logo).resize({ width: 360, height: 120, fit: "inside" }).png().toBuffer();
      logoDataUri = `data:image/png;base64,${png.toString("base64")}`;
    } catch {
      logoDataUri = null;
    }
  }
  const base = await sharp(input.foto)
    .rotate()
    .resize(plantilla.ancho, plantilla.alto, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();
  const overlay = Buffer.from(svgPublicacion(input.plantillaId, datos, logoDataUri));
  return sharp(base).composite([{ input: overlay, top: 0, left: 0 }]).png().toBuffer();
}
