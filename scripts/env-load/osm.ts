/**
 * OpenStreetMap (Geofabrik Galicia) → environment_layers
 * Requisitos en Mac: osmium-tool (`brew install osmium-tool`)
 *
 * npx tsx scripts/env-load/osm.ts
 * npx tsx scripts/env-load/osm.ts --pbf ~/Downloads/galicia-latest.osm.pbf
 */
import { execSync } from "node:child_process";
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
  puntoWkt,
  poligonoWkt,
  type LayerRow,
} from "./_shared";

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

function descargarGalicia(dest: string): void {
  if (existsSync(dest)) return;
  mkdirSync(path.dirname(dest), { recursive: true });
  console.log("Descargando galicia-latest.osm.pbf (Geofabrik)…");
  execSync(
    `curl -L -o "${dest}" "https://download.geofabrik.de/europe/spain/galicia-latest.osm.pbf"`,
    { stdio: "inherit" }
  );
}

function filtrarExportar(pbf: string, work: string, name: string, filterArgs: string[]): string {
  const filtered = path.join(work, `${name}.osm.pbf`);
  const geo = path.join(work, `${name}.geojsonseq`);
  const filter = ["osmium", "tags-filter", pbf, ...filterArgs, "-o", filtered, "--overwrite"].join(" ");
  execSync(filter, { stdio: "inherit" });
  execSync(`osmium export -f geojsonseq -o "${geo}" "${filtered}" --overwrite`, { stdio: "inherit" });
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
  } else if (f.geometry.type === "LineString" && meta.category === "main_road") {
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
  const work = dataDir("osm-work");
  const pbf = arg("--pbf") ?? path.join(dataDir("osm"), "galicia-latest.osm.pbf");
  descargarGalicia(pbf);

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
  ]);

  const filas: LayerRow[] = [];
  const push = (f: GeoFeature) => {
    const row = filaDesdeFeature(f);
    if (row) filas.push(row);
  };
  await leerNdjson<GeoFeature>(pois, push);
  await leerNdjson<GeoFeature>(vias, (f) => {
    const tags = f.properties ?? {};
    if (tags.railway === "rail") {
      const row = filaDesdeFeature({ ...f, properties: { ...tags, highway: undefined } });
      if (row) {
        filas.push({
          ...row,
          layer: "osm_poi",
          category: "railway",
          sense: "negative",
        });
      }
      return;
    }
    push(f);
  });

  const porCat = new Map<string, number>();
  for (const r of filas) {
    const k = `${r.layer}:${r.category ?? ""}`;
    porCat.set(k, (porCat.get(k) ?? 0) + 1);
  }

  const db = await adminClient();
  console.log("Borrando capa OSM previa…");
  await borrarCapa(db, { source: SOURCE });
  console.log(`Insertando ${filas.length} elementos…`);
  const n = await insertarLotes(db, filas);
  const seg = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`OSM listo: ${n} filas en ${seg}s`);
  for (const [k, c] of [...porCat.entries()].sort()) console.log(`  ${k}: ${c}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
