/**
 * Mapa Estratégico de Ruido · aglomeración A Coruña
 *
 * npx tsx scripts/env-load/noise.ts --geojson data/env/ruido/acoruna-lden.geojson
 */
import { readFileSync } from "node:fs";
import { adminClient, borrarCapa, enBbox, insertarLotes, puntoWkt, type LayerRow } from "./_shared";

const SOURCE = "Mapa estratégico de ruido";
const LOADED_AT = new Date().toISOString();

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

type Geo = {
  type: "FeatureCollection";
  features: {
    geometry: { type: string; coordinates: unknown };
    properties: Record<string, unknown>;
  }[];
};

function centro(geom: { type: string; coordinates: unknown }): [number, number] | null {
  if (geom.type === "Point") {
    const c = geom.coordinates as number[];
    return [c[0], c[1]];
  }
  if (geom.type === "Polygon") {
    const ring = (geom.coordinates as [number, number][][])[0];
    let lng = 0;
    let lat = 0;
    for (const p of ring) {
      lng += p[0];
      lat += p[1];
    }
    return [lng / ring.length, lat / ring.length];
  }
  return null;
}

async function main(): Promise<void> {
  const file = arg("--geojson");
  if (!file) {
    console.error("Pasa --geojson (Concello de A Coruña o SICA MITECO, bandas Lden).");
    process.exit(1);
  }
  const geo = JSON.parse(readFileSync(file, "utf8")) as Geo;
  const filas: LayerRow[] = [];
  for (const f of geo.features) {
    const c = centro(f.geometry);
    if (!c || !enBbox(c[1], c[0])) continue;
    const lden = Number(f.properties.Lden ?? f.properties.lden ?? f.properties.LDEN ?? 0);
    const sourceType = String(f.properties.source_type ?? f.properties.tipo ?? f.properties.origen ?? "tráfico");
    filas.push({
      layer: "noise",
      category: null,
      name: null,
      sense: "negative",
      props: { lden, source_type: sourceType, ...f.properties },
      geom: puntoWkt(c[0], c[1]),
      source: SOURCE,
      loaded_at: LOADED_AT,
    });
  }
  const db = await adminClient();
  await borrarCapa(db, { source: SOURCE, layer: "noise" });
  const n = await insertarLotes(db, filas);
  console.log(`Ruido: ${n} puntos/bandas`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
