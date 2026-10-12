/**
 * SNCZI MITECO · zonas inundables T10/T100/T500 (Galicia-Costa)
 *
 * Descarga manual o WFS → GeoJSON, luego:
 * npx tsx scripts/env-load/sncsi.ts --geojson data/env/snczi/galicia-costa.geojson
 */
import { readFileSync } from "node:fs";
import { adminClient, borrarCapa, insertarLotes, poligonoWkt, type LayerRow } from "./_shared";

const SOURCE = "SNCZI (MITECO)";
const LOADED_AT = new Date().toISOString();

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

type Geo = {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    geometry: { type: string; coordinates: unknown };
    properties: Record<string, unknown>;
  }[];
};

function periodo(props: Record<string, unknown>): string {
  const raw = String(props.period ?? props.PERIOD ?? props.periodo ?? props.T ?? "").toUpperCase();
  if (raw.includes("10")) return "T10";
  if (raw.includes("100")) return "T100";
  if (raw.includes("500")) return "T500";
  return raw || "T500";
}

function polys(geom: { type: string; coordinates: unknown }): [number, number][][] {
  if (geom.type === "Polygon") {
    return [(geom.coordinates as [number, number][][])[0]];
  }
  if (geom.type === "MultiPolygon") {
    return (geom.coordinates as [number, number][][][]).map((p) => p[0]);
  }
  return [];
}

async function main(): Promise<void> {
  const file = arg("--geojson");
  if (!file) {
    console.error("Pasa --geojson con el shapefile convertido (ogr2ogr -t_srs EPSG:4326 -f GeoJSON …).");
    console.error("WFS MITECO SNCZI: https://sig.mapama.gob.es/arcgis/services/SNCZI/");
    process.exit(1);
  }
  const geo = JSON.parse(readFileSync(file, "utf8")) as Geo;
  const filas: LayerRow[] = [];
  for (const f of geo.features) {
    const rings = polys(f.geometry);
    if (!rings.length) continue;
    filas.push({
      layer: "flood",
      category: periodo(f.properties),
      name: null,
      sense: "negative",
      props: { period: periodo(f.properties), ...f.properties },
      geom: poligonoWkt(rings[0]),
      source: SOURCE,
      loaded_at: LOADED_AT,
    });
  }
  const db = await adminClient();
  await borrarCapa(db, { source: SOURCE, layer: "flood" });
  const n = await insertarLotes(db, filas);
  console.log(`Inundabilidad: ${n} polígonos`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
