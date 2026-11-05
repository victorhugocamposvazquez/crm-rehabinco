import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const LOGO_REL = "public/web/brand/marca-agua-rehabinco.svg";

export {
  urlFotoConMarca,
  urlOrigenPermitida,
  urlsFotosConMarca,
  yaTieneMarca,
} from "./marca-agua-url";

/** Baja la opacidad del PNG blanco sin perder la forma del logo. */
async function logoConOpacidad(logoPng: Buffer, opacidad: number): Promise<Buffer> {
  const alpha = Math.max(0, Math.min(255, Math.round(255 * opacidad)));
  return sharp(logoPng)
    .ensureAlpha()
    .composite([
      {
        input: Buffer.from([255, 255, 255, alpha]),
        raw: { width: 1, height: 1, channels: 4 },
        tile: true,
        blend: "dest-in",
      },
    ])
    .png()
    .toBuffer();
}

export async function aplicarMarcaAgua(foto: Buffer): Promise<Buffer> {
  const base = sharp(foto, { failOn: "none" }).rotate();
  const meta = await base.metadata();
  const width = meta.width ?? 1200;
  const height = meta.height ?? 800;
  const logoWidth = Math.max(140, Math.round(width * 0.22));

  const logoSvg = await readFile(path.join(process.cwd(), LOGO_REL));
  // Rasteriza sobredimensionado, recorta transparencia y deja margen para que
  // la O final (y el trazo) no salgan cortados al componer.
  const logoBruto = await sharp(logoSvg, { density: 300 })
    .resize({ width: Math.round(logoWidth * 1.15) })
    .trim({ threshold: 1 })
    .extend({
      top: 4,
      bottom: 4,
      left: 8,
      right: 12,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .resize({ width: logoWidth })
    .png()
    .toBuffer();
  const logoPng = logoBruto;
  const logoMeta = await sharp(logoPng).metadata();
  const lw = logoMeta.width ?? logoWidth;
  const lh = logoMeta.height ?? Math.round(logoWidth * 0.2);
  const left = Math.max(0, Math.round((width - lw) / 2));
  const top = Math.max(0, Math.round((height - lh) / 2));

  const sombra = await logoConOpacidad(
    await sharp(logoPng).tint({ r: 0, g: 0, b: 0 }).png().toBuffer(),
    0.28
  );
  const logo = await logoConOpacidad(logoPng, 0.7);

  return base
    .composite([
      {
        input: sombra,
        left: Math.min(width - lw, left + 2),
        top: Math.min(height - lh, top + 2),
      },
      { input: logo, left, top },
    ])
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();
}
