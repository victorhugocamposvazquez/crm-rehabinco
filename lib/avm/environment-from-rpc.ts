import { buildEnvironment, type RawEnvironment } from "./environment";
import type { Environment } from "./types";

export type AvmEnvironmentRpc = {
  nearest?: RawEnvironment["nearest"];
  counts_500m?: Record<string, number>;
  meta?: { has_osm?: boolean; osm_loaded_at?: string | null };
};

/** Convierte la salida de avm_environment() en Environment; null solo si no hay ningún dato. */
export function environmentFromAvmRpc(data: unknown): Environment | null {
  const payload = (data ?? null) as AvmEnvironmentRpc | null;
  if (!payload) return null;
  const nearest = Array.isArray(payload.nearest) ? payload.nearest : [];
  const counts = payload.counts_500m ?? {};
  if (!nearest.length && !Object.keys(counts).length && !payload.meta?.has_osm) return null;
  return buildEnvironment({ nearest, counts_500m: counts });
}
