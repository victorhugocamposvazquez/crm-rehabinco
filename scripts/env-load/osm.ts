/**
 * OpenStreetMap (Geofabrik) → environment_layers
 * Requisitos en Mac: osmium-tool (`brew install osmium-tool`)
 *
 * npx tsx scripts/env-load/osm.ts
 * npx tsx scripts/env-load/osm.ts --region spain
 * npx tsx scripts/env-load/osm.ts --region acoruna --pbf ~/Downloads/galicia-latest.osm.pbf
 * npx tsx scripts/env-load/osm.ts --geofabrik spain/galicia
 */
import { execFileSync, execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import {
  adminClient,
  borrarCapa,
  dataDir,
  enBbox,
  insertarLotes,
  leerNdjson,
  lineaWkt,
  parseRegionArg,
  puntoWkt,
  poligonoWkt,
  setEnvLoadRegion,
  type LayerRow,
} from "./_shared";
import { GEOFABRIK as GEOFABRIK_REGIONS, resolveGeofabrikScope } from "../../lib/avm/geofabrik";

const SOURCE = "OSM";
const LOADED_AT = new Date().toISOString();

type GeoFeature = {
  type: "Feature";
  geometry: { type: string; coordinates: unknown };
  properties: Record<string, string | undefined>;
};

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

function asegurarOsmium(): void {
  try {
    execSync("osmium --version", { stdio: "ignore" });
  } catch {
    throw new Error("Instala osmium-tool: brew install osmium-tool");
  }
}

const GEOFABRIK_LEGACY = {
  spain: GEOFABRIK_REGIONS.spain,
  acoruna: GEOFABRIK_REGIONS["spain/galicia"],
} as const;

function descargarPbf(dest: string, spec: { url: string; file: string; label: string }): void {
  if (existsSync(dest)) return;
  mkdirSync(path.dirname(dest), { recursive: true });
  console.log(`Descargando ${spec.file} (${spec.label})…`);
  execSync(`curl -L -o "${dest}" "${spec.url}"`, { stdio: "inherit" });
}

function filtrarExportar(pbf: string, work: string, name: string, filterArgs: string[]): string {
  const filtered = path.join(work, `${name}.osm.pbf`);
  const geo = path.join(work, `${name}.geojsonseq`);
  execFileSync("osmium", ["tags-filter", pbf, ...filterArgs, "-o", filtered, "--overwrite"], { stdio: "inherit" });
  execFileSync("osmium", ["export", "-f", "geojsonseq", "-o", geo, filtered, "--overwrite"], { stdio: "inherit" });
  return geo;
}

function coordsPunto(c: unknown): [number, number] | null {
  if (!Array.isArray(c) || c.length < 2) return null;
  const lng = Number(c[0]);
  const lat = Number(c[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lng, lat];
}

function centroideLinea(coords: unknown): [number, number] | null {
  if (!Array.isArray(coords) || !coords.length) return null;
  let lng = 0;
  let lat = 0;
  let n = 0;
  for (const p of coords) {
    const pt = coordsPunto(p);
    if (!pt) continue;
    lng += pt[0];
    lat += pt[1];
    n++;
  }
  return n ? [lng / n, lat / n] : null;
}

function clasificar(tags: Record<string, string | undefined>): Omit<LayerRow, "geom" | "name" | "props" | "loaded_at"> | null {
  const shop = tags.shop;
  if (shop === "fuel") {
    return { layer: "osm_poi", category: "fuel", sense: "negative", source: SOURCE };
  }
  if (shop) {
    return { layer: "osm_poi", category: "shop", sense: "positive", source: SOURCE };
  }
  const amenity = tags.amenity;
  if (amenity === "supermarket") return { layer: "osm_poi", category: "supermarket", sense: "positive", source: SOURCE };
  if (amenity === "restaurant" || amenity === "cafe") {
    return { layer: "osm_poi", category: "restaurant", sense: "positive", source: SOURCE };
  }
  if (amenity === "bar" || amenity === "pub" || amenity === "nightclub") {
    return { layer: "osm_poi", category: "nightlife", sense: "negative", source: SOURCE };
  }
  if (amenity === "school" || amenity === "kindergarten") {
    return { layer: "school", category: amenity, sense: "positive", source: SOURCE };
  }
  if (amenity === "hospital" || amenity === "clinic" || amenity === "doctors") {
    return { layer: "health", category: "health_center", sense: "positive", source: SOURCE };
  }
  if (amenity === "pharmacy") return { layer: "osm_poi", category: "pharmacy", sense: "positive", source: SOURCE };
  if (amenity === "fuel") {
    return { layer: "osm_poi", category: "fuel", sense: "negative", source: SOURCE };
  }
  if (tags.leisure === "park" || tags.leisure === "playground" || tags.leisure === "garden") {
    return { layer: "osm_poi", category: "park", sense: "positive", source: SOURCE };
  }
  if (tags.natural === "beach") return { layer: "osm_poi", category: "beach", sense: "positive", source: SOURCE };
  if (tags.leisure === "sports_centre" || tags.leisure === "pitch" || tags.leisure === "swimming_pool") {
    return { layer: "osm_poi", category: "gym", sense: "positive", source: SOURCE };
  }
  if (tags.highway === "bus_stop" || tags.public_transport === "platform") {
    return { layer: "gtfs_stop", category: "bus", sense: "positive", source: SOURCE };
  }
  if (tags.railway === "station" || tags.railway === "tram_stop") {
    return { layer: "gtfs_stop", category: "rail", sense: "positive", source: SOURCE };
  }
  if (tags.highway === "primary" || tags.highway === "trunk" || tags.highway === "motorway") {
    return { layer: "osm_poi", category: "main_road", sense: "negative", source: SOURCE };
  }
  if (tags.landuse === "industrial") {
    return { layer: "osm_poi", category: "industrial", sense: "negative", source: SOURCE };
  }
  const power = tags.power;
  if (power === "line" || power === "cable" || power === "minor_line") {
    return { layer: "osm_poi", category: "power_line", sense: "negative", source: SOURCE };
  }
  return null;
}

function filaDesdeFeature(f: GeoFeature): LayerRow | null {
  const tags = f.properties ?? {};
  const meta = clasificar(tags);
  if (!meta) return null;
  const name = tags.name ?? tags["name:es"] ?? null;
  const props: Record<string, unknown> = { ...tags };

  let geom: string | null = null;
  if (f.geometry.type === "Point") {
    const p = coordsPunto(f.geometry.coordinates);
    if (!p || !enBbox(p[1], p[0])) return null;
    geom = puntoWkt(p[0], p[1]);
  } else if (
    f.geometry.type === "LineString" &&
    (meta.category === "main_road" || meta.category === "power_line" || meta.category === "railway")
  ) {
    const coords = f.geometry.coordinates as [number, number][];
    const mid = centroideLinea(coords);
    if (!mid || !enBbox(mid[1], mid[0])) return null;
    geom = lineaWkt(coords.filter((c) => enBbox(c[1], c[0])).length >= 2 ? coords : [mid, mid]);
  } else if (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon") {
    const rings: [number, number][][] = [];
    if (f.geometry.type === "Polygon") {
      const ring = (f.geometry.coordinates as [number, number][][])[0];
      if (ring?.some(([lng, lat]) => enBbox(lat, lng))) rings.push(ring);
    } else {
      for (const poly of f.geometry.coordinates as [number, number][][][]) {
        const ring = poly[0];
        if (ring?.some(([lng, lat]) => enBbox(lat, lng))) rings.push(ring);
      }
    }
    if (!rings.length) return null;
    geom = poligonoWkt(rings[0]);
  } else {
    const mid = centroideLinea(f.geometry.type === "MultiLineString" ? (f.geometry.coordinates as unknown[])[0] : f.geometry.coordinates);
    if (!mid || !enBbox(mid[1], mid[0])) return null;
    geom = puntoWkt(mid[0], mid[1]);
  }

  return {
    ...meta,
    name,
    props,
    geom,
    loaded_at: LOADED_AT,
  };
}

async function main(): Promise<void> {
  asegurarOsmium();
  const geofabrikArg = arg("--geofabrik") ?? process.env.AVM_GEOFABRIK_SCOPE;
  const geofScope = geofabrikArg ? resolveGeofabrikScope(geofabrikArg) : null;
  const region = parseRegionArg();
  setEnvLoadRegion(geofScope && geofScope !== "spain" ? "spain" : region);
  const spec = geofScope
    ? GEOFABRIK_REGIONS[geofScope]
    : region === "acoruna"
      ? GEOFABRIK_LEGACY.acoruna
      : GEOFABRIK_LEGACY.spain;
  const work = dataDir("osm-work");
  const pbf = arg("--pbf") ?? path.join(dataDir("osm"), spec.file);
  descargarPbf(pbf, spec);

  const t0 = Date.now();
  const pois = filtrarExportar(pbf, work, "pois", [
    "n/shop",
    "n/amenity=supermarket",
    "n/amenity=restaurant",
    "n/amenity=cafe",
    "n/amenity=bar",
    "n/amenity=pub",
    "n/amenity=nightclub",
    "n/amenity=school",
    "n/amenity=kindergarten",
    "n/amenity=hospital",
    "n/amenity=clinic",
    "n/amenity=doctors",
    "n/amenity=pharmacy",
    "n/amenity=fuel",
    "n/shop=fuel",
    "n/amenity=bus_stop",
    "n/amenity=station",
    "n/way/shop",
    "n/way/amenity=supermarket",
    "n/way/amenity=restaurant",
    "n/way/amenity=cafe",
    "n/way/amenity=bar",
    "n/way/amenity=pub",
    "n/way/amenity=nightclub",
    "n/way/amenity=school",
    "n/way/amenity=kindergarten",
    "n/way/amenity=hospital",
    "n/way/amenity=clinic",
    "n/way/amenity=doctors",
    "n/way/amenity=pharmacy",
    "n/way/amenity=fuel",
    "n/way/shop=fuel",
    "n/way/leisure=park",
    "n/way/leisure=playground",
    "n/way/leisure=garden",
    "n/way/natural=beach",
    "n/way/leisure=sports_centre",
    "n/way/leisure=pitch",
    "n/way/leisure=swimming_pool",
    "n/way/highway=bus_stop",
    "n/way/public_transport=platform",
    "n/way/railway=station",
    "n/way/railway=tram_stop",
    "n/way/landuse=industrial",
  ]);
  const vias = filtrarExportar(pbf, work, "roads", [
    "w/highway=primary",
    "w/highway=trunk",
    "w/highway=motorway",
    "w/railway=rail",
    "w/power=line",
    "w/power=cable",
    "w/power=minor_line",
  ]);

  const porCat = new Map<string, number>();
  const db = await adminClient();
  const reemplazoTotal = !geofScope || geofScope === "spain";
  if (reemplazoTotal) {
    console.log("Borrando capa OSM previa (España completa)…");
    await borrarCapa(db, { source: SOURCE });
  } else {
    console.log(`Carga OSM parcial (${geofScope}): no se borra el resto de España.`);
  }

  const lote = 2500;
  let buffer: LayerRow[] = [];
  let n = 0;

  const contar = (row: LayerRow) => {
    const k = `${row.layer}:${row.category ?? ""}`;
    porCat.set(k, (porCat.get(k) ?? 0) + 1);
  };

  const flush = async () => {
    if (!buffer.length) return;
    n += await insertarLotes(db, buffer, 200);
    buffer = [];
    if (n % 50_000 < lote) console.log(`  … ${n} filas insertadas`);
  };

  const push = async (f: GeoFeature) => {
    const row = filaDesdeFeature(f);
    if (!row) return;
    contar(row);
    buffer.push(row);
    if (buffer.length >= lote) await flush();
  };

  const ingest = async (f: GeoFeature) => {
    const tags = f.properties ?? {};
    if (tags.railway === "rail") {
      const railRow = filaDesdeFeature({ ...f, properties: { ...tags, highway: undefined } });
      if (railRow) {
        const row: LayerRow = {
          ...railRow,
          layer: "osm_poi",
          category: "railway",
          sense: "negative",
        };
        contar(row);
        buffer.push(row);
        if (buffer.length >= lote) await flush();
      }
      return;
    }
    await push(f);
  };

  await leerNdjson<GeoFeature>(pois, ingest);
  await flush();
  await leerNdjson<GeoFeature>(vias, ingest);
  await flush();

  const seg = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`OSM listo (${geofScope ?? region}): ${n} filas en ${seg}s`);
  process.env.AVM_LAST_ROWS = String(n);
  for (const [k, c] of [...porCat.entries()].sort()) console.log(`  ${k}: ${c}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
