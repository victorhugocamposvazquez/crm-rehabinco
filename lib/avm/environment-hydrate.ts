import type { SupabaseClient } from "@supabase/supabase-js";
import { parseEntornoCoverage, type EntornoCoverage } from "./entorno-coverage";
import { environmentFromAvmRpc } from "./environment-from-rpc";
import type { Environment, Twin } from "./types";

const MUNICIPAL_LAYERS = new Set(["crime_municipality", "vulnerable_section", "flood"]);

function flagsFrom(env: Environment | null | undefined): Environment["flags"] {
  return env?.flags?.length ? env.flags : [];
}

/** Bandera municipal / sección: siempre desde RPC reciente (no dependen de 600 m). */
export function mergeEnvironmentInforme(stored: Environment | null, fresh: Environment | null): Environment | null {
  if (!stored && !fresh) return null;
  if (!stored) return fresh;
  if (!fresh) return stored;

  const freshFlags = flagsFrom(fresh);
  const storedFlags = flagsFrom(stored);
  const flags = freshFlags.length ? freshFlags : storedFlags;

  const hasPuntos = stored.positives.length > 0 || stored.negatives.length > 0;
  if (hasPuntos) {
    return { ...stored, flags };
  }
  return {
    score: fresh.score,
    positives: fresh.positives,
    negatives: fresh.negatives,
    flags,
  };
}

export async function fetchEnvironmentRpc(
  supabase: SupabaseClient,
  twin: Twin,
): Promise<{ raw: unknown; coverage: EntornoCoverage | null }> {
  const lat = twin.address.lat;
  const lng = twin.address.lng;
  if (lat == null || lng == null) return { raw: null, coverage: null };

  const [envRes, covRes] = await Promise.all([
    supabase.rpc("avm_environment", {
      p_lat: lat,
      p_lng: lng,
      p_census_section: twin.address.censusSection ?? null,
      p_municipality_code: twin.address.municipalityCode ?? null,
    }),
    supabase.rpc("avm_environment_coverage", {
      p_lat: lat,
      p_lng: lng,
      p_municipality_code: twin.address.municipalityCode ?? null,
      p_census_section: twin.address.censusSection ?? null,
    }),
  ]);

  if (envRes.error) throw new Error(envRes.error.message);
  if (covRes.error) throw new Error(covRes.error.message);

  return {
    raw: envRes.data,
    coverage: parseEntornoCoverage(covRes.data),
  };
}

export async function hydrateEnvironmentForInforme(
  supabase: SupabaseClient,
  twin: Twin,
  stored: Environment | null,
): Promise<{ environment: Environment | null; coverage: EntornoCoverage | null }> {
  const { raw, coverage } = await fetchEnvironmentRpc(supabase, twin);
  const fresh = environmentFromAvmRpc(raw);
  const environment = mergeEnvironmentInforme(stored, fresh);
  return { environment, coverage };
}

export function coverageTieneCapasMunicipales(coverage: EntornoCoverage | null): boolean {
  if (!coverage) return false;
  return coverage.layers_consulted.some((l) => MUNICIPAL_LAYERS.has(l.layer));
}
