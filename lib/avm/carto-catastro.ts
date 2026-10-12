import { TIPOS_VIA_OFICIALES } from "../catastro/constants";

export type ViaCatastroDnploc = {
  provincia: string;
  municipio: string;
  sigla: string;
  calle: string;
  numero: string;
};

/** Candidato CartoCiudad con campos que exige la Sede (DNPLOC). */
export type CartoCandidatoNormalizado = {
  address: string;
  lat: number;
  lng: number;
  postcode: string | null;
  municipality: string | null;
  /** Código provincia INE (15) o nombre. */
  province: string | null;
  streetType: string | null;
  streetName: string | null;
  streetNumber: string | null;
  muniCode?: string;
};

const PROVINCIA_POR_CP: Record<string, string> = {
  "15": "A CORUÑA",
  "36": "PONTEVEDRA",
  "32": "OURENSE",
  "27": "LUGO",
};

export function siglaViaCarto(tipVia: string | null | undefined): string {
  const t = (tipVia ?? "CALLE")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toUpperCase();
  const porCodigo = TIPOS_VIA_OFICIALES.find((item) => item.codigo === t);
  if (porCodigo) return porCodigo.codigo;
  const porNombre = TIPOS_VIA_OFICIALES.find((item) =>
    item.nombres.some((nombre) => nombre.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase() === t),
  );
  return porNombre?.codigo ?? "CL";
}

/** Municipio tal como lo espera Consulta_DNPLOC (ej. A CORUÑA, no CORUÑA (A)). */
export function normalizarMunicipioCatastro(municipio: string | null | undefined): string {
  const raw = (municipio ?? "").trim();
  if (!raw) return "A CORUÑA";
  const sinParentesis = raw.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  const n = sinParentesis
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  if (n === "a coruna" || n === "coruna" || n.includes("coruna")) return "A CORUÑA";
  return sinParentesis.toUpperCase();
}

export function provinciaNombreCatastro(province: string | null, postcode: string | null): string {
  const p = (province ?? "").trim();
  if (p && !/^\d{2}$/.test(p)) return p.toUpperCase();
  const cp = postcode?.slice(0, 2) ?? p;
  if (cp && PROVINCIA_POR_CP[cp]) return PROVINCIA_POR_CP[cp];
  return p ? p.toUpperCase() : "A CORUÑA";
}

export function viaCatastroDesdeCandidato(c: CartoCandidatoNormalizado): ViaCatastroDnploc | null {
  const calle = c.streetName?.trim();
  const numero = c.streetNumber?.trim();
  if (!calle || !numero) return null;
  return {
    provincia: provinciaNombreCatastro(c.province, c.postcode),
    municipio: normalizarMunicipioCatastro(c.municipality),
    sigla: siglaViaCarto(c.streetType),
    calle: calle.toUpperCase(),
    numero,
  };
}
