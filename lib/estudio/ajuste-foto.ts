/** Ajustes de luz y color de una foto, al estilo del editor del iPhone. 0 no cambia nada. */

export const CLAVES_AJUSTE = [
  "exposicion",
  "brillo",
  "contraste",
  "altas",
  "sombras",
  "puntoNegro",
  "saturacion",
  "intensidad",
  "calidez",
  "tono",
  "nitidez",
  "definicion",
  "vineta",
] as const;

export type ClaveAjuste = (typeof CLAVES_AJUSTE)[number];
export type AjusteFoto = Record<ClaveAjuste, number>;

export const HERRAMIENTAS_FOTO = [
  { id: "recortar", label: "Recortar" },
  { id: "exposicion", label: "Exposición" },
  { id: "brillo", label: "Brillo" },
  { id: "contraste", label: "Contraste" },
  { id: "altas", label: "Altas luces" },
  { id: "sombras", label: "Sombras" },
  { id: "puntoNegro", label: "Punto negro" },
  { id: "saturacion", label: "Saturación" },
  { id: "intensidad", label: "Intensidad" },
  { id: "calidez", label: "Calidez" },
  { id: "tono", label: "Tono" },
  { id: "nitidez", label: "Nitidez" },
  { id: "definicion", label: "Definición" },
  { id: "vineta", label: "Viñeta" },
] as const;

export type HerramientaFoto = (typeof HERRAMIENTAS_FOTO)[number]["id"];

export const AJUSTE_BASE: AjusteFoto = {
  exposicion: 0, brillo: 0, contraste: 0, altas: 0, sombras: 0, puntoNegro: 0,
  saturacion: 0, intensidad: 0, calidez: 0, tono: 0, nitidez: 0, definicion: 0, vineta: 0,
};

function limite(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.max(-100, Math.min(100, Math.round(n)));
}

export function ajusteDe(raw: unknown): AjusteFoto {
  const o = raw && typeof raw === "object" ? (raw as Partial<AjusteFoto>) : {};
  const out = { ...AJUSTE_BASE };
  for (const clave of CLAVES_AJUSTE) out[clave] = limite(o[clave]);
  return out;
}

export function ajusteActivo(raw: unknown): boolean {
  const a = ajusteDe(raw);
  return CLAVES_AJUSTE.some((clave) => a[clave] !== 0);
}

function dec(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

/**
 * Filtro CSS equivalente. Altas luces, sombras, nitidez y definición se aproximan
 * con brillo y contraste para que la imagen descargada coincida con la pantalla.
 * La viñeta no va aquí: es una capa encima de la foto.
 */
export function filtroAjuste(raw: unknown): string {
  const a = ajusteDe(raw);
  const brillo = 1 + (a.brillo * 0.5 + a.exposicion * 0.35 + a.sombras * 0.22 - a.altas * 0.12 - a.puntoNegro * 0.16) / 100;
  const contraste = 1 + (a.contraste * 0.5 + a.exposicion * 0.18 + a.definicion * 0.35 + a.nitidez * 0.22 + a.puntoNegro * 0.28 + a.altas * 0.16 - a.sombras * 0.12) / 100;
  const saturacion = 1 + (a.saturacion * 0.8 + a.intensidad * 0.45) / 100;
  const sepia = Math.max(0, a.calidez) / 100 * 0.45;
  const tono = a.tono * 0.45 - Math.min(0, a.calidez) * 0.28;
  const partes = [`brightness(${dec(brillo)})`, `contrast(${dec(contraste)})`, `saturate(${dec(saturacion)})`];
  if (sepia > 0.001) partes.push(`sepia(${dec(sepia)})`);
  if (Math.abs(tono) > 0.05) partes.push(`hue-rotate(${dec(tono)}deg)`);
  const identidad = Math.abs(brillo - 1) < 0.001 && Math.abs(contraste - 1) < 0.001 && Math.abs(saturacion - 1) < 0.001 && sepia <= 0.001 && Math.abs(tono) <= 0.05;
  return identidad ? "none" : partes.join(" ");
}

/** Capa radial. Positiva oscurece los bordes; negativa los aclara. 0 no pinta nada. */
export function fondoVineta(raw: unknown): string | null {
  const valor = ajusteDe(raw).vineta;
  if (!valor) return null;
  const alpha = Math.abs(valor) / 100 * 0.72;
  const color = valor > 0 ? `rgba(0,0,0,${dec(alpha)})` : `rgba(255,255,255,${dec(alpha)})`;
  return `radial-gradient(circle, transparent 42%, ${color} 100%)`;
}
