/**
 * Mapa Estratégico de Ruido (MER) · bandas Lden · España
 *
 * npx tsx scripts/env-load/noise.ts --fetch-spain
 * npx tsx scripts/env-load/noise.ts --geojson data/env/ruido/acoruna-lden.geojson
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  adminClient,
  borrarCapa,
  dataDir,
  enBbox,
  insertarLotes,
  leerNdjson,
  parseRegionArg,
  puntoWkt,
  setEnvLoadRegion,
  type LayerRow,
} from "./_shared";
import { prepareMitecoShpLayer, requireGdal } from "./miteco-gdal";

const SOURCE = "Mapa estratégico de ruido";
const LOADED_AT = new Date().toISOString();

const MER_LDEN: { file: string; source_type: string }[] = [
  { file: "mer-aglomeraciones_lden.zip", source_type: "aglomeración" },
  { file: "mer-carreteras_lden.zip", source_type: "carretera" },
  { file: "mer-lineas_ferroviarias_lden.zip", source_type: "ferrocarril" },
  { file: "mer-aeropuertos_lden.zip", source_type: "aeropuerto" },
];

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

type GeoFeature = {
  geometry: { type: string; coordinates: unknown };
  properties: Record<string, unknown>;
};

type Geo = {
  type: "FeatureCollection";
  features: GeoFeature[];
};

function numLden(props: Record<string, unknown>): number {
  for (const k of Object.keys(props)) {
    if (!/lden/i.test(k)) continue;
    const n = Number(props[k]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  for (const k of ["NIVEL", "Nivel", "VALOR", "valor", "DB", "dB"]) {
    const n = Number(props[k]);
    if (Number.isFinite(n) && n > 30) return n;
  }
  return 0;
}

function puntosDesdeGeometria(
  geom: { type: string; coordinates: unknown },
  everyNth: number,
): [number, number][] {
  const out: [number, number][] = [];
  const pushRing = (ring: [number, number][]) => {
    for (let i = 0; i < ring.length; i += everyNth) {
      out.push(ring[i]);
    }
  };

  if (geom.type === "Point") {
    const c = geom.coordinates as number[];
    return [[c[0], c[1]]];
  }
  if (geom.type === "LineString") {
    pushRing(geom.coordinates as [number, number][]);
    return out;
  }
  if (geom.type === "MultiLineString") {
    for (const line of geom.coordinates as [number, number][][]) {
      pushRing(line);
    }
    return out;
  }
  if (geom.type === "Polygon") {
    pushRing((geom.coordinates as [number, number][][])[0]);
    return out;
  }
  if (geom.type === "MultiPolygon") {
    for (const poly of geom.coordinates as [number, number][][][]) {
      pushRing(poly[0]);
    }
    return out;
  }
  return out;
}

function centro(geom: { type: string; coordinates: unknown }): [number, number] | null {
  const pts = puntosDesdeGeometria(geom, 1);
  if (!pts.length) return null;
  if (geom.type === "Point") return pts[0];
  let lng = 0;
  let lat = 0;
  for (const p of pts) {
    lng += p[0];
    lat += p[1];
  }
  return [lng / pts.length, lat / pts.length];
}

function filasDesdeFeature(f: GeoFeature, sourceType: string, sampleLines: number): LayerRow[] {
  const lden = numLden(f.properties);
  if (lden <= 0) return [];

  const geom = f.geometry;
  const isLine = geom.type === "LineString" || geom.type === "MultiLineString";
  const coords = isLine ? puntosDesdeGeometria(geom, sampleLines) : [centro(geom)].filter(Boolean) as [number, number][];

  const filas: LayerRow[] = [];
  for (const [lng, lat] of coords) {
    if (!enBbox(lat, lng)) continue;
    filas.push({
      layer: "noise",
      category: null,
      name: null,
      sense: "negative",
      props: { lden, source_type: sourceType, ...f.properties },
      geom: puntoWkt(lng, lat),
      source: SOURCE,
      loaded_at: LOADED_AT,
    });
  }
  return filas;
}

async function cargarGeojsonFile(file: string, sourceType: string, db: Awaited<ReturnType<typeof adminClient>>): Promise<number> {
  const geo = JSON.parse(readFileSync(file, "utf8")) as Geo;
  const filas: LayerRow[] = [];
  for (const f of geo.features) {
    filas.push(...filasDesdeFeature(f, sourceType, 4));
  }
  return insertarLotes(db, filas);
}

async function cargarGeojsonSeq(
  file: string,
  sourceType: string,
  db: Awaited<ReturnType<typeof adminClient>>,
  sampleLines: number,
): Promise<number> {
  const lote: LayerRow[] = [];
  let total = 0;
  const flush = async () => {
    if (!lote.length) return;
    total += await insertarLotes(db, lote.splice(0, lote.length), 200);
  };
  await leerNdjson<GeoFeature>(file, async (f) => {
    lote.push(...filasDesdeFeature(f, sourceType, sampleLines));
    if (lote.length >= 500) await flush();
  });
  await flush();
  return total;
}

function merLayersFetch(): typeof MER_LDEN {
  let layers = [...MER_LDEN];
  if (process.argv.includes("--aglomeraciones-only")) {
    layers = layers.filter((l) => l.file.includes("aglomeraciones"));
  }
  return layers;
}

async function fetchSpain(): Promise<void> {
  requireGdal();
  setEnvLoadRegion("spain");
  const work = dataDir("ruido/spain");
  const layers = merLayersFetch();
  console.log(`MER Lden: ${layers.map((l) => l.source_type).join(", ")}`);

  const db = await adminClient();
  await borrarCapa(db, { source: SOURCE, layer: "noise" });

  let grand = 0;
  for (const { file, source_type } of layers) {
    console.log(`\n▶ ${file}`);
    const simplify = file.includes("carreteras") ? 0.00012 : 0.00008;
    const sample = file.includes("carreteras") ? 8 : file.includes("aglomeraciones") ? 5 : 4;
    const { geojsonSeq } = await prepareMitecoShpLayer(file, work, simplify);
    const n = await cargarGeojsonSeq(geojsonSeq, source_type, db, sample);
    console.log(`  ${n} puntos`);
    grand += n;
  }
  console.log(`\nRuido total: ${grand} puntos`);
}

async function main(): Promise<void> {
  setEnvLoadRegion(parseRegionArg());

  if (process.argv.includes("--fetch-spain")) {
    await fetchSpain();
    return;
  }

  const file = arg("--geojson");
  if (!file) {
    console.error("Usa --fetch-spain (ZIP MER + GDAL) o --geojson <fichero>.");
    process.exit(1);
  }
  const sourceType = arg("--source-type") ?? "tráfico";
  const db = await adminClient();
  await borrarCapa(db, { source: SOURCE, layer: "noise" });
  const resolved = path.resolve(file);
  const n =
    resolved.endsWith(".geojsonl") || resolved.endsWith(".jsonl")
      ? await cargarGeojsonSeq(resolved, sourceType, db, 4)
      : await cargarGeojsonFile(resolved, sourceType, db);
  console.log(`Ruido: ${n} puntos/bandas`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
