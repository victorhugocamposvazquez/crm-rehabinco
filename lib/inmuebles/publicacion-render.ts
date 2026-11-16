import sharp from "sharp";
import {
  datosVisibles,
  plantillaPublicacion,
  plantillaRedesPorDefecto,
  svgPublicacion,
  type FichaParaPublicacion,
  type PlantillaRedes,
} from "./publicacion-plantilla";

export async function renderPublicacion(input: {
  foto: Buffer;
  plantilla: PlantillaRedes;
  ficha: FichaParaPublicacion;
  marca?: string;
  logo?: Buffer | null;
}): Promise<Buffer> {
  const formato = plantillaPublicacion(input.plantilla.formato) ?? plantillaPublicacion(plantillaRedesPorDefecto().formato);
  if (!formato) throw new Error("Plantilla desconocida.");
  const datos = datosVisibles(input.ficha, { ...input.plantilla, formato: formato.id }, input.marca);
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
    .resize(formato.ancho, formato.alto, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();
  const overlay = Buffer.from(svgPublicacion(formato.id, datos, logoDataUri, input.plantilla.estilo));
  return sharp(base).composite([{ input: overlay, top: 0, left: 0 }]).png().toBuffer();
}
