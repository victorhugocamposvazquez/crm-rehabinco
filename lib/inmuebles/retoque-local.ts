import sharp from "sharp";

const ANGULO_MAX = 4;
const PASO = 0.5;

function varianzaDeBordes(pixels: Buffer, ancho: number, alto: number): number {
  if (alto < 2 || ancho < 2) return 0;
  let media = 0;
  const energias: number[] = [];
  for (let y = 1; y < alto; y++) {
    let suma = 0;
    const fila = y * ancho;
    for (let x = 0; x < ancho; x++) suma += Math.abs(pixels[fila + x] - pixels[fila - ancho + x]);
    energias.push(suma);
    media += suma;
  }
  media /= energias.length;
  let varianza = 0;
  for (const energia of energias) {
    const delta = energia - media;
    varianza += delta * delta;
  }
  return varianza / energias.length;
}

/** Grados que hay que girar para dejar las líneas horizontales más rectas. 0 si ya lo está. */
export async function anguloParaEnderezar(imagen: Buffer): Promise<number> {
  const pequeno = await sharp(imagen).rotate().resize({ width: 280, withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer();
  const medir = async (grados: number) => {
    const pipeline = grados === 0 ? sharp(pequeno) : sharp(pequeno).rotate(grados, { background: "#000000" });
    const { data, info } = await pipeline.greyscale().raw().toBuffer({ resolveWithObject: true });
    return varianzaDeBordes(data, info.width, info.height);
  };
  const base = await medir(0);
  let mejor = 0;
  let mejorPuntos = base;
  for (let grados = -ANGULO_MAX; grados <= ANGULO_MAX; grados += PASO) {
    if (grados === 0) continue;
    const puntos = await medir(grados);
    if (puntos > mejorPuntos) {
      mejorPuntos = puntos;
      mejor = grados;
    }
  }
  if (mejorPuntos < base * 1.03) return 0;
  return mejor;
}

export async function masLuz(imagen: Buffer): Promise<Buffer> {
  return sharp(imagen)
    .rotate()
    .modulate({ brightness: 1.28, saturation: 1.06 })
    .sharpen({ sigma: 0.4 })
    .jpeg({ quality: 86 })
    .toBuffer();
}

export async function enderezarFoto(imagen: Buffer): Promise<Buffer> {
  const grados = await anguloParaEnderezar(imagen);
  const derecha = await sharp(imagen).rotate().jpeg({ quality: 90 }).toBuffer();
  if (Math.abs(grados) < PASO) return sharp(derecha).jpeg({ quality: 86 }).toBuffer();

  const original = await sharp(derecha).metadata();
  const ancho = original.width ?? 0;
  const alto = original.height ?? 0;
  const rad = (Math.abs(grados) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rotada = await sharp(derecha).rotate(grados, { background: "#1a1a1a" }).toBuffer();
  const lienzo = await sharp(rotada).metadata();
  const anchoLienzo = lienzo.width ?? ancho;
  const altoLienzo = lienzo.height ?? alto;
  let recorteAncho = Math.floor(ancho * cos - alto * sin);
  let recorteAlto = Math.floor(alto * cos - ancho * sin);
  recorteAncho = Math.max(1, Math.min(recorteAncho, anchoLienzo));
  recorteAlto = Math.max(1, Math.min(recorteAlto, altoLienzo));
  const left = Math.max(0, Math.min(anchoLienzo - recorteAncho, Math.floor((anchoLienzo - recorteAncho) / 2)));
  const top = Math.max(0, Math.min(altoLienzo - recorteAlto, Math.floor((altoLienzo - recorteAlto) / 2)));
  return sharp(rotada).extract({ left, top, width: recorteAncho, height: recorteAlto }).jpeg({ quality: 86 }).toBuffer();
}

export async function aplicarRetoqueLocal(imagen: Buffer, preset: "luz" | "enderezar"): Promise<Buffer> {
  if (preset === "luz") return masLuz(imagen);
  return enderezarFoto(imagen);
}
