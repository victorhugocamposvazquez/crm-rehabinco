import type { SupabaseClient } from "@supabase/supabase-js";
import { ineProvinciaDeMunicipio, provinciaCatastroPorCodigo } from "./provincias-espana";

export type FilaCatastroMunicipio = {
  ine_code: string;
  province_code: string;
  province_name: string;
  name_catastro: string;
  name_ine: string | null;
  is_foral: boolean;
};

const memoria = new Map<string, FilaCatastroMunicipio>();

export function ineMunicipioValido(code: string | null | undefined): string | null {
  const c = (code ?? "").replace(/\D/g, "");
  if (c.length !== 5) return null;
  return c;
}

export async function cargarMunicipioCatastro(
  db: SupabaseClient,
  ineCode: string,
): Promise<FilaCatastroMunicipio | null> {
  const key = ineMunicipioValido(ineCode);
  if (!key) return null;
  const cached = memoria.get(key);
  if (cached) return cached;
  const { data, error } = await db
    .from("catastro_municipios")
    .select("ine_code, province_code, province_name, name_catastro, name_ine, is_foral")
    .eq("ine_code", key)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as FilaCatastroMunicipio;
  memoria.set(key, row);
  return row;
}

/** Provincia y municipio tal como exige Consulta_DNPLOC (nunca texto libre del usuario). */
export async function dnplocDesdeIne(
  db: SupabaseClient,
  ineCode: string,
): Promise<{ provincia: string; municipio: string } | null> {
  const row = await cargarMunicipioCatastro(db, ineCode);
  if (row) {
    return { provincia: row.province_name, municipio: row.name_catastro };
  }
  const ine = ineMunicipioValido(ineCode);
  if (!ine) return null;
  const prov = provinciaCatastroPorCodigo(ineProvinciaDeMunicipio(ine));
  if (!prov) return null;
  return null;
}

export function limpiarCacheMunicipiosCatastro(): void {
  memoria.clear();
}
