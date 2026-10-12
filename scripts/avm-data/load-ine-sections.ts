/**
 * Secciones censales INE (OGC API Features) → ine_census_sections
 *
 * npx tsx scripts/avm-data/load-ine-sections.ts
 * npx tsx scripts/avm-data/load-ine-sections.ts --municipio 15030
 */
import { adminClient } from "../env-load/_shared";

const COLLECTION =
  "https://www.ine.es/geoserver/ogc/features/v1/collections/WMS_INE_SECCIONES_G01:Secciones_2021/items";

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

type IneFeature = {
  type: "Feature";
  properties?: { CUSEC?: string; CUDIS?: string };
  geometry: GeoJSON.Geometry;
};

async function fetchPage(offset: number, limit: number): Promise<{ features: IneFeature[]; next?: string }> {
  const url = new URL(COLLECTION);
  url.searchParams.set("f", "json");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`INE OGC ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as {
    features?: IneFeature[];
    links?: { rel: string; href: string }[];
  };
  const next = body.links?.find((l) => l.rel === "next")?.href;
  return { features: body.features ?? [], next };
}

function codigoSeccion(f: IneFeature): string | null {
  const p = f.properties ?? {};
  const code = (p.CUSEC ?? p.CUDIS ?? "").replace(/\D/g, "");
  return code.length >= 10 ? code : null;
}

async function main(): Promise<void> {
  const filtroMuni = arg("--municipio")?.replace(/\D/g, "").padStart(5, "0") ?? null;
  const db = await adminClient();
  let offset = 0;
  const limit = 500;
  let total = 0;

  for (;;) {
    const { features, next } = await fetchPage(offset, limit);
    if (!features.length) break;

    const batch: { code: string; geom: GeoJSON.Geometry }[] = [];
    for (const f of features) {
      const code = codigoSeccion(f);
      if (!code || !f.geometry) continue;
      if (filtroMuni && !code.startsWith(filtroMuni)) continue;
      batch.push({ code, geom: f.geometry });
    }

    if (batch.length) {
      const { data, error } = await db.rpc("avm_upsert_ine_sections_batch", { p_rows: batch });
      if (error) throw new Error(error.message);
      total += Number(data ?? batch.length);
      console.log(`  … ${total} secciones`);
    }

    if (next) {
      offset += limit;
      continue;
    }
    if (features.length < limit) break;
    offset += limit;
  }

  process.env.AVM_LAST_ROWS = String(total);
  console.log(`INE secciones: ${total} filas`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
