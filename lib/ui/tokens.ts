export const c = {
  bg: "#F5F5F5",
  surface: "#FFFFFF",
  surfaceSoft: "#FAFAFA",
  ink: "#111111",
  text2: "#5C5C5C",
  label: "#6B6B6B",
  text3: "#8A8A8A",
  line: "#E5E5E5",
  lineSoft: "#EFEFEF",
  lineRow: "#F2F2F2",
  inputBorder: "#D4D4D4",
  green: "#111111",
  greenDark: "#000000",
  greenSoft: "#F0F0F0",
  rowActive: "#F5F5F5",
  amber: "#B98A16",
  amberBg: "#FBF0D8",
  amberInk: "#7A5A10",
  blue: "#2B4A8A",
  blueSoft: "#E9EEF8",
  violet: "#8579C4",
  violetBg: "#F1EFF8",
  violetInk: "#4B3F8A",
  red: "#A33B2A",
  redBg: "#FBEAE5",
} as const;

export const COMERCIAL_COLORS = [
  "#1F7A4D",
  "#2B4A8A",
  "#B98A16",
  "#6B5AA8",
  "#A33B2A",
  "#3A6A82",
] as const;

/** Color de ficha del comercial: el guardado, o uno estable según el id. */
export function colorComercial(id?: string | null, color?: string | null): string {
  const guardado = color?.trim() ?? "";
  if (/^#[0-9A-Fa-f]{6}$/.test(guardado)) return guardado;
  if (!id) return COMERCIAL_COLORS[0];
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return COMERCIAL_COLORS[h % COMERCIAL_COLORS.length];
}

function nombreUtil(nombre?: string | null): string {
  const limpio = nombre?.trim() ?? "";
  if (!limpio || /^comercial$/i.test(limpio)) return "";
  return limpio;
}

/** Nombre y primer apellido. No usa el rol «Comercial». */
export function nombreYApellido(nombre?: string | null, email?: string | null): string {
  const limpio = nombreUtil(nombre);
  if (limpio) {
    const partes = limpio.split(/\s+/).filter(Boolean);
    if (partes.length === 1) return partes[0];
    return `${partes[0]} ${partes[1]}`;
  }
  const local = email?.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  return local || "";
}

export function inicialesNombre(nombre?: string | null, email?: string | null): string {
  const source = (nombreUtil(nombre) || email?.split("@")[0] || "U").trim();
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
