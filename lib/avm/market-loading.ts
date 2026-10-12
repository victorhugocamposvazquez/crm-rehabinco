import type { SupabaseClient } from "@supabase/supabase-js";

export type EstadoMercadoZona = {
  loading: boolean;
  firstRunAt: string | null;
  listingsCount: number;
};

export async function estadoMercadoMunicipio(db: SupabaseClient, municipalityCode: string | null | undefined): Promise<EstadoMercadoZona> {
  const code = (municipalityCode ?? "").replace(/\D/g, "");
  if (code.length !== 5) return { loading: false, firstRunAt: null, listingsCount: 0 };

  const { count: listingsCount } = await db
    .from("market_listings")
    .select("id", { count: "exact", head: true })
    .eq("municipality_code", code)
    .eq("active", true);

  const { data: target } = await db
    .from("market_crawl_targets")
    .select("last_run")
    .eq("municipality_code", code)
    .maybeSingle();

  const { data: firstRun } = await db
    .from("market_crawl_runs")
    .select("started_at")
    .eq("municipality_code", code)
    .order("started_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const n = listingsCount ?? 0;
  const firstRunAt = firstRun?.started_at ? String(firstRun.started_at).slice(0, 10) : target?.last_run ? String(target.last_run).slice(0, 10) : null;
  const loading = n === 0 && Boolean(target);

  return { loading, firstRunAt, listingsCount: n };
}

export function mensajeMercadoEnCarga(estado: EstadoMercadoZona): string | null {
  if (!estado.loading) return null;
  const fecha = estado.firstRunAt ?? "próximos días";
  return `Mercado de esta zona en carga: primera pasada el ${fecha}.`;
}
