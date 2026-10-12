/**
 * SNCZI MITECO · zonas inundables T10/T50/T100/T500 (España)
 *
 * npx tsx scripts/env-load/sncsi.ts --fetch-spain
 * npx tsx scripts/env-load/sncsi.ts --fetch-spain --skip-t10
 * npx tsx scripts/env-load/sncsi.ts --geojson data/env/snczi/galicia-costa.geojson
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  adminClient,
  borrarCapa,
  dataDir,
  insertarLotes,
  leerNdjson,
  poligonoWkt,
  type LayerRow,
} from "./_shared";
import { prepareMitecoShpLayer, requireGdal } from "./miteco-gdal";

const SOURCE = "SNCZI (MITECO)";
const LOADED_AT = new Date().toISOString();

const SNCZI_ZIPS: { file: string; period: string }[] = [
  { file: "laminasPB-q10.zip", period: "T10" },
  { file: "laminas-q50.zip", period: "T50" },
  { file: "laminasPB-q100.zip", period: "T100" },
  { file: "laminasCanarias-q100.zip", period: "T100" },
  { file: "laminasPB-q500.zip", period: "T500" },
  { file: "laminasCanarias-q500.zip", period: "T500" },
];

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

type GeoFeature = {
  type: "Feature";
  geometry: { type: string; coordinates: unknown };
  properties: Record<string, unknown>;
};

type Geo = {
  type: "FeatureCollection";
  features: GeoFeature[];
};

function periodo(props: Record<string, unknown>, fallback: string): string {
  const raw = String(props.period ?? props.PERIOD ?? props.periodo ?? props.T ?? "").toUpperCase();
  if (raw.includes("10")) return "T10";
  if (raw.includes("50")) return "T50";
  if (raw.includes("100")) return "T100";
  if (raw.includes("500")) return "T500";
  return fallback || raw || "T500";
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

function filaDesdeFeature(f: GeoFeature, periodFallback: string): LayerRow | null {
  const rings = polys(f.geometry);
  if (!rings.length) return null;
  const p = periodo(f.properties, periodFallback);
  return {
    layer: "flood",
    category: p,
    name: null,
    sense: "negative",
    props: { period: p, ...f.properties },
    geom: poligonoWkt(rings[0]),
    source: SOURCE,
    loaded_at: LOADED_AT,
  };
}

async function cargarGeojsonFile(file: string, periodFallback: string, db: Awaited<ReturnType<typeof adminClient>>): Promise<number> {
  const geo = JSON.parse(readFileSync(file, "utf8")) as Geo;
  const filas: LayerRow[] = [];
  for (const f of geo.features) {
    const row = filaDesdeFeature(f, periodFallback);
    if (row) filas.push(row);
  }
  return insertarLotes(db, filas);
}

async function cargarGeojsonSeq(file: string, periodFallback: string, db: Awaited<ReturnType<typeof adminClient>>): Promise<number> {
  const lote: LayerRow[] = [];
  let total = 0;
  const flush = async () => {
    if (!lote.length) return;
    total += await insertarLotes(db, lote.splice(0, lote.length), 150);
  };
  await leerNdjson<GeoFeature>(file, async (f) => {
    const row = filaDesdeFeature(f, periodFallback);
    if (!row) return;
    lote.push(row);
    if (lote.length >= 400) await flush();
  });
  await flush();
  return total;
}

function capasFetch(): { file: string; period: string }[] {
  let layers = [...SNCZI_ZIPS];
  if (process.argv.includes("--skip-t10")) {
    layers = layers.filter((l) => l.period !== "T10");
  }
  const only = arg("--only");
  if (only) {
    const set = new Set(only.split(",").map((s) => s.trim().toUpperCase()));
    layers = layers.filter((l) => set.has(l.period));
  }
  return layers;
}

async function fetchSpain(): Promise<void> {
  requireGdal();
  const work = dataDir("snczi/spain");
  const layers = capasFetch();
  console.log(`SNCZI: ${layers.length} ficheros (${layers.map((l) => l.period).join(", ")})`);

  const db = await adminClient();
  await borrarCapa(db, { source: SOURCE, layer: "flood" });

  let grand = 0;
  for (const { file, period } of layers) {
    console.log(`\n▶ ${file} (${period})`);
    const { geojsonSeq } = await prepareMitecoShpLayer(file, work, 0.00006);
    const n = await cargarGeojsonSeq(geojsonSeq, period, db);
    console.log(`  ${n} polígonos`);
    grand += n;
  }
  console.log(`\nInundabilidad total: ${grand} polígonos`);
}

async function main(): Promise<void> {
  if (process.argv.includes("--fetch-spain")) {
    await fetchSpain();
    return;
  }

  const file = arg("--geojson");
  if (!file) {
    console.error("Usa --fetch-spain (ZIP MITECO + GDAL) o --geojson <fichero>.");
    console.error("WFS: https://wmts.mapama.gob.es/sig-api/ogc/features/v1/collections/agua:Zi_laminas_q100");
    process.exit(1);
  }
  const period = arg("--period") ?? "T500";
  const db = await adminClient();
  await borrarCapa(db, { source: SOURCE, layer: "flood" });
  const n = file.endsWith(".geojsonl") || file.endsWith(".jsonl")
    ? await cargarGeojsonSeq(path.resolve(file), period, db)
    : await cargarGeojsonFile(path.resolve(file), period, db);
  console.log(`Inundabilidad: ${n} polígonos`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
