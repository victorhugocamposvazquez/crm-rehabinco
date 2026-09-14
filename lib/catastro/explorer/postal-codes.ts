/**
 * Códigos postales oficiales por municipio (Correos/INE).
 * El motor catastral no los usa: solo el explorer, para no buscar un CP de otro pueblo.
 */
import datos from "./postal-codes-es.json";

export type MunicipioCodigosPostales = {
  provinceCode: string;
  name: string;
  codes: string[];
};

type FilaPostal = { n: string; c: string[] };

const filas = datos as Record<string, FilaPostal>;

const porCodigoPostal = new Map<string, MunicipioCodigosPostales[]>();
for (const [clave, fila] of Object.entries(filas)) {
  const [provinceCode] = clave.split("|");
  const item: MunicipioCodigosPostales = { provinceCode, name: fila.n, codes: fila.c };
  for (const cp of fila.c) {
    const lista = porCodigoPostal.get(cp) ?? [];
    if (!lista.some((actual) => actual.provinceCode === provinceCode && actual.name === fila.n)) {
      lista.push(item);
      porCodigoPostal.set(cp, lista);
    }
  }
}

export function canonicoMunicipioPostal(nombre: string): string {
  let texto = nombre
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .trim();
  const articulo = texto.match(/^(.+),\s+(EL|LA|LOS|LAS|L'|ELS|LES|A|O|OS|AS|SA)$/);
  if (articulo) texto = `${articulo[2]} ${articulo[1]}`;
  return texto.replace(/[^A-Z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function claveMunicipioPostal(provinceCode: string, municipality: string): string {
  return `${provinceCode.trim()}|${canonicoMunicipioPostal(municipality)}`;
}

export function codigosPostalesDeMunicipio(
  provinceCode: string | null | undefined,
  municipality: string | null | undefined
): MunicipioCodigosPostales | null {
  if (!provinceCode?.trim() || !municipality?.trim()) return null;
  const fila = filas[claveMunicipioPostal(provinceCode, municipality)];
  if (!fila?.c?.length) return null;
  return {
    provinceCode: provinceCode.trim(),
    name: fila.n,
    codes: fila.c,
  };
}

export function municipiosDeCodigoPostal(postalCode: string): MunicipioCodigosPostales[] {
  const cp = postalCode.replace(/\s+/g, "");
  if (!/^\d{5}$/.test(cp)) return [];
  return porCodigoPostal.get(cp) ?? [];
}

export function codigoPostalDelMunicipio(
  provinceCode: string | null | undefined,
  municipality: string | null | undefined,
  postalCode: string
): boolean {
  const delMunicipio = codigosPostalesDeMunicipio(provinceCode, municipality);
  if (!delMunicipio) return true;
  const cp = postalCode.replace(/\s+/g, "");
  if (!cp) return true;
  return delMunicipio.codes.includes(cp);
}
