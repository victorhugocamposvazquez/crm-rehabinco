/**
 * OpenStreetMap (Geofabrik) → environment_layers
 * Requisitos en Mac: osmium-tool (`brew install osmium-tool`)
 *
 * npx tsx scripts/env-load/osm.ts
 * npx tsx scripts/env-load/osm.ts --region spain
 * npx tsx scripts/env-load/osm.ts --region acoruna --pbf ~/Downloads/galicia-latest.osm.pbf
 * npx tsx scripts/env-load/osm.ts --geofabrik spain/galicia
 */
import type { EnvCategory } from "../../lib/avm/ui/icons";
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

function cerrar(ring: [number, number][]): [number, number][] {
  if (ring.length < 3) return ring;
  const a = ring[0];
  const b = ring[ring.length - 1];
  if (a[0] === b[0] && a[1] === b[1]) return ring;
  return [...ring, a];
}

function areaAnilloM2(ring: [number, number][]): number {
  if (ring.length < 3) return 0;
  const lat0 = (ring[0][1] * Math.PI) / 180;
  const mLng = 111320 * Math.cos(lat0);
  const mLat = 110540;
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    area += ring[i][0] * mLng * ring[j][1] * mLat - ring[j][0] * mLng * ring[i][1] * mLat;
  }
  return Math.abs(area) / 2;
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

function textoSalud(tags: Record<string, string | undefined>): string {
  return `${tags.name ?? ""} ${tags["name:es"] ?? ""} ${tags.operator ?? ""} ${tags.healthcare ?? ""}`.toLowerCase();
}

function clasificarSalud(
  tags: Record<string, string | undefined>,
  amenity: string,
): (Omit<LayerRow, "geom" | "name" | "props" | "loaded_at" | "category"> & { category: EnvCategory }) | null {
  const blob = textoSalud(tags);
  const privado = /quir[oó]n|sanitas|dental|dentista|privado|cl[ií]nica/.test(blob) && !/sergas|centro de sa/.test(blob);
  if (amenity === "hospital" && !privado) {
    return { layer: "health", category: "hospital", sense: "positive", source: SOURCE };
  }
  if (/centro de sa[uú]de|centro de salud|\bpac\b|punto de atenci[oó]n|sergas/.test(blob)) {
    return { layer: "health", category: "health_center", sense: "positive", source: SOURCE };
  }
  return { layer: "health", category: "health_private", sense: "info", source: SOURCE };
}

function clasificar(tags: Record<string, string | undefined>): (Omit<LayerRow, "geom" | "name" | "props" | "loaded_at" | "category"> & { category: EnvCategory }) | null {
  const shop = tags.shop;
  const amenity = tags.amenity;
  if (shop === "fuel" || amenity === "fuel") {
    return { layer: "osm_poi", category: "fuel", sense: "negative", source: SOURCE };
  }
  if (shop === "supermarket" || amenity === "supermarket") {
    return { layer: "osm_poi", category: "supermarket", sense: "positive", source: SOURCE };
  }
  if (shop) {
    return { layer: "osm_poi", category: "shop", sense: "positive", source: SOURCE };
  }
  if (amenity === "restaurant" || amenity === "cafe" || amenity === "bar") {
    return { layer: "osm_poi", category: "hospitality", sense: "info", source: SOURCE };
  }
  if (amenity === "pub" || amenity === "nightclub") {
    return { layer: "osm_poi", category: "nightlife", sense: "negative", source: SOURCE };
  }
  if (amenity === "school" || amenity === "kindergarten") {
    const nombre = `${tags.name ?? ""} ${tags["name:es"] ?? ""}`;
    if (/academia|autoescuela|ludoteca|no reglada/i.test(nombre)) return null;
    const infantil = amenity === "kindergarten" || /escola infantil|escuela infantil/i.test(nombre);
    return { layer: "school", category: infantil ? "nursery" : "school", sense: "positive", source: SOURCE };
  }
  if (amenity === "dentist") {
    return { layer: "health", category: "health_private", sense: "info", source: SOURCE };
  }
  if (amenity === "hospital" || amenity === "clinic" || amenity === "doctors") {
    return clasificarSalud(tags, amenity);
  }
  if (amenity === "pharmacy") return { layer: "osm_poi", category: "pharmacy", sense: "positive", source: SOURCE };
  if (tags.leisure === "park" || tags.leisure === "garden") {
    return { layer: "osm_poi", category: "park", sense: "positive", source: SOURCE };
  }
  if (tags.natural === "beach") return { layer: "osm_poi", category: "beach", sense: "positive", source: SOURCE };
  if (
    amenity === "sports_centre" ||
    tags.leisure === "sports_centre" ||
    tags.leisure === "pitch" ||
    tags.leisure === "stadium" ||
    tags.leisure === "track"
  ) {
    return { layer: "osm_poi", category: "sport", sense: "positive", source: SOURCE };
  }
  if (tags.highway === "bus_stop") {
    return { layer: "gtfs_stop", category: "bus", sense: "positive", source: SOURCE };
  }
  if (tags.railway === "station" || tags.railway === "tram_stop" || tags.railway === "halt") {
    return { layer: "gtfs_stop", category: "rail", sense: "positive", source: SOURCE };
  }
  if (tags.railway === "rail" || tags.railway === "light_rail") {
    return { layer: "osm_poi", category: "railway", sense: "negative", source: SOURCE };
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
  if (meta.category === "bus") {
    props.respaldo_gtfs = true;
    props.nota = "highway=bus_stop de OSM. El feed GTFS del NAP no está disponible sin token.";
  }
  if (meta.category === "school" || meta.category === "nursery") props.tipo = tags.amenity ?? meta.category;
  if (meta.category === "health_center" || meta.category === "hospital") props.publico = true;

  let geom: string | null = null;
  if (f.geometry.type === "Point") {
    if (meta.category === "park") return null;
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
    if (meta.category === "park") {
      const mayor = rings.reduce((a, b) => (areaAnilloM2(b) > areaAnilloM2(a) ? b : a));
      if (areaAnilloM2(mayor) < 2000) return null;
      geom = poligonoWkt(cerrar(mayor));
    } else {
      geom = poligonoWkt(cerrar(rings[0]));
    }
  } else if (meta.category === "park") {
    return null;
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
  const poiTags = [
    "shop",
    "amenity=supermarket",
    "amenity=restaurant",
    "amenity=cafe",
    "amenity=bar",
    "amenity=pub",
    "amenity=nightclub",
    "amenity=school",
    "amenity=kindergarten",
    "amenity=hospital",
    "amenity=clinic",
    "amenity=doctors",
    "amenity=pharmacy",
    "amenity=fuel",
    "amenity=bus_stop",
    "amenity=gym",
    "leisure=park",
    "leisure=playground",
    "leisure=garden",
    "leisure=fitness_centre",
    "leisure=sports_centre",
    "leisure=pitch",
    "leisure=swimming_pool",
    "natural=beach",
    "highway=bus_stop",
    "public_transport=platform",
    "railway=station",
    "railway=halt",
    "railway=tram_stop",
    "landuse=industrial",
  ];
  const pois = filtrarExportar(
    pbf,
    work,
    "pois",
    poiTags.flatMap((tag) => [`n/${tag}`, `w/${tag}`])
  );
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
