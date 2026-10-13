import type { SupabaseClient } from "@supabase/supabase-js";
import { dnplocDesdeIne, ineMunicipioValido } from "../catastro/municipio-resolver";
import { provinciaCatastroPorCodigo, ineProvinciaDeMunicipio } from "../catastro/provincias-espana";
import { siglaViaCartoCiudad } from "./carto-via-catastro";

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
  /** Parcela que ya trae CartoCiudad (14 caracteres). */
  catastralRef?: string | null;
};

export function normalizarNumeroPortal(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  if (/^s\s*\/?\s*n\.?$/i.test(t)) return "S/N";
  return t.toUpperCase();
}

export function siglaViaCarto(tipVia: string | null | undefined): string {
  return siglaViaCartoCiudad(tipVia);
}

/** @deprecated Solo tests legacy; producción usa catastro_municipios por INE. */
export function normalizarMunicipioCatastro(municipio: string | null | undefined): string {
  const raw = (municipio ?? "").trim();
  if (!raw) return "";
  return raw.replace(/\s*\([^)]*\)\s*/g, " ").trim().toUpperCase();
}

/** Resuelve provincia Catastro: código INE de municipio o provincia, o CP. */
export function provinciaNombreCatastro(
  province: string | null | undefined,
  postcode: string | null | undefined,
  ineMuni?: string | null,
): string {
  const ine = ineMunicipioValido(ineMuni ?? "");
  if (ine) {
    const p = provinciaCatastroPorCodigo(ineProvinciaDeMunicipio(ine));
    if (p) return p;
  }
  const p = (province ?? "").trim();
  if (p && !/^\d{2}$/.test(p)) return p.toUpperCase();
  const cp = postcode?.slice(0, 2) ?? p;
  const porCp = provinciaCatastroPorCodigo(cp);
  if (porCp) return porCp;
  return p ? p.toUpperCase() : "";
}

export function armarViaCatastro(
  c: CartoCandidatoNormalizado,
  ubicacion: { provincia: string; municipio: string },
): ViaCatastroDnploc | null {
  const calle = c.streetName?.trim();
  const numero = normalizarNumeroPortal(c.streetNumber);
  if (!calle || !numero || !ubicacion.municipio.trim() || !ubicacion.provincia.trim()) return null;
  return {
    provincia: ubicacion.provincia.trim().toUpperCase(),
    municipio: ubicacion.municipio.trim().toUpperCase(),
    sigla: siglaViaCarto(c.streetType),
    calle: calle.toUpperCase(),
    numero,
  };
}

export async function viaCatastroDesdeCandidato(
  c: CartoCandidatoNormalizado,
  db: SupabaseClient | null,
): Promise<ViaCatastroDnploc | null> {
  const ine = ineMunicipioValido(c.muniCode);
  if (!db || !ine) return null;
  const loc = await dnplocDesdeIne(db, ine);
  if (!loc) return null;
  return armarViaCatastro(c, loc);
}
