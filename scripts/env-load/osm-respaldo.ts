/**
 * Parques (≥ 2.000 m²), playas, deporte y paradas highway=bus_stop.
 * Respaldo del GTFS: el ZIP del NAP (feed 1574) responde 401 sin token.
 *
 * npx tsx scripts/env-load/osm-respaldo.ts /tmp/osm-extra-galicia.geojsonseq
 */
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { adminClient, enBbox, insertarLotes, poligonoWkt, puntoWkt, type LayerRow } from "./_shared";

const SOURCE = "OSM";
const NOTA_BUS = "highway=bus_stop de OSM. El feed GTFS de la Compañía de Tranvías (NAP 1574) no está disponible sin token.";

type Feat = {
  geometry?: { type?: string; coordinates?: unknown };
  properties?: Record<string, string | undefined>;
};

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

function cerrar(ring: [number, number][]): [number, number][] {
  if (ring.length < 3) return ring;
  const a = ring[0];
  const b = ring[ring.length - 1];
  if (a[0] === b[0] && a[1] === b[1]) return ring;
  return [...ring, a];
}

function anillo(coords: unknown): [number, number][] | null {
  if (!Array.isArray(coords)) return null;
  const ring = coords.filter((p): p is [number, number] => Array.isArray(p) && p.length >= 2 && Number.isFinite(Number(p[0])));
  return ring.length >= 3 ? ring.map((p) => [Number(p[0]), Number(p[1])] as [number, number]) : null;
}

function mayorPoligono(geometry: Feat["geometry"]): { ring: [number, number][]; area: number } | null {
  const t = geometry?.type;
  const c = geometry?.coordinates;
  const candidatos: [number, number][][] = [];
  if (t === "Polygon" && Array.isArray(c)) {
    const ring = anillo(c[0]);
    if (ring) candidatos.push(ring);
  } else if (t === "MultiPolygon" && Array.isArray(c)) {
    for (const poly of c) {
      if (!Array.isArray(poly)) continue;
      const ring = anillo(poly[0]);
      if (ring) candidatos.push(ring);
    }
  }
  let mejor: { ring: [number, number][]; area: number } | null = null;
  for (const ring of candidatos) {
    const area = areaAnilloM2(ring);
    if (!mejor || area > mejor.area) mejor = { ring, area };
  }
  return mejor;
}

function puntoDe(geometry: Feat["geometry"]): [number, number] | null {
  if (geometry?.type !== "Point" || !Array.isArray(geometry.coordinates)) return null;
  const lng = Number(geometry.coordinates[0]);
  const lat = Number(geometry.coordinates[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lng, lat];
}

function dentro(lng: number, lat: number): boolean {
  return enBbox(lat, lng);
}

function clasificar(p: Record<string, string | undefined>, geometry: Feat["geometry"], loadedAt: string): LayerRow | null {
  const nombre = (p.name || p["name:es"] || "").trim() || null;
  const acceso = (p.access ?? "").toLowerCase();
  if (p.highway === "bus_stop" && geometry?.type === "Point") {
    const pt = puntoDe(geometry);
    if (!pt || !dentro(pt[0], pt[1])) return null;
    return {
      layer: "gtfs_stop",
      category: "bus",
      name: nombre,
      sense: "positive",
      props: { ...p, respaldo_gtfs: true, nota: NOTA_BUS },
      geom: puntoWkt(pt[0], pt[1]),
      source: SOURCE,
      loaded_at: loadedAt,
    };
  }
  if ((p.railway === "station" || p.railway === "halt" || p.railway === "tram_stop") && geometry?.type === "Point") {
    const pt = puntoDe(geometry);
    if (!pt || !dentro(pt[0], pt[1])) return null;
    return {
      layer: "gtfs_stop",
      category: "rail",
      name: nombre,
      sense: "positive",
      props: { ...p },
      geom: puntoWkt(pt[0], pt[1]),
      source: SOURCE,
      loaded_at: loadedAt,
    };
  }
  if (p.leisure === "park" || p.leisure === "garden") {
    if (p.leisure === "garden" && (acceso === "private" || acceso === "no")) return null;
    const poly = mayorPoligono(geometry);
    if (!poly || poly.area < 2000) return null;
    const [lng, lat] = poly.ring[0];
    if (!dentro(lng, lat)) return null;
    return {
      layer: "osm_poi",
      category: "park",
      name: nombre,
      sense: "positive",
      props: { ...p, area_m2: Math.round(poly.area) },
      geom: poligonoWkt(cerrar(poly.ring)),
      source: SOURCE,
      loaded_at: loadedAt,
    };
  }
  if (p.natural === "beach") {
    const poly = mayorPoligono(geometry);
    const pt = puntoDe(geometry);
    if (poly) {
      if (!dentro(poly.ring[0][0], poly.ring[0][1])) return null;
      return {
        layer: "osm_poi",
        category: "beach",
        name: nombre,
        sense: "positive",
        props: { ...p },
        geom: poligonoWkt(cerrar(poly.ring)),
        source: SOURCE,
        loaded_at: loadedAt,
      };
    }
    if (!pt || !dentro(pt[0], pt[1])) return null;
    return {
      layer: "osm_poi",
      category: "beach",
      name: nombre,
      sense: "positive",
      props: { ...p },
      geom: puntoWkt(pt[0], pt[1]),
      source: SOURCE,
      loaded_at: loadedAt,
    };
  }
  const deporte = p.leisure === "sports_centre" || p.leisure === "stadium" || p.leisure === "pitch" || p.amenity === "sports_centre";
  if (deporte && geometry?.type !== "LineString") {
    const poly = mayorPoligono(geometry);
    const pt = puntoDe(geometry);
    if (poly) {
      if (poly.area < 400) return null;
      if (!dentro(poly.ring[0][0], poly.ring[0][1])) return null;
      return {
        layer: "osm_poi",
        category: "sport",
        name: nombre,
        sense: "positive",
        props: { ...p, area_m2: Math.round(poly.area) },
        geom: poligonoWkt(cerrar(poly.ring)),
        source: SOURCE,
        loaded_at: loadedAt,
      };
    }
    if (!pt || !dentro(pt[0], pt[1])) return null;
    return {
      layer: "osm_poi",
      category: "sport",
      name: nombre,
      sense: "positive",
      props: { ...p },
      geom: puntoWkt(pt[0], pt[1]),
      source: SOURCE,
      loaded_at: loadedAt,
    };
  }
  return null;
}

async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file) throw new Error("Pasa el geojsonseq.");
  const loadedAt = new Date().toISOString();
  const filas: LayerRow[] = [];
  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    const t = line.trim().replace(/^\u001e/, "");
    if (!t) continue;
    const feat = JSON.parse(t) as Feat;
    const row = clasificar(feat.properties ?? {}, feat.geometry, loadedAt);
    if (row) filas.push(row);
  }
  const db = await adminClient();
  const borrar = await db
    .from("environment_layers")
    .delete()
    .eq("source", SOURCE)
    .in("category", ["park", "beach", "sport"])
    .gt("id", 0);
  if (borrar.error) throw new Error(borrar.error.message);
  const borrarParadas = await db.from("environment_layers").delete().eq("source", SOURCE).eq("layer", "gtfs_stop").gt("id", 0);
  if (borrarParadas.error) throw new Error(borrarParadas.error.message);
  const n = await insertarLotes(db, filas);
  const por = new Map<string, number>();
  for (const f of filas) por.set(`${f.layer}:${f.category}`, (por.get(`${f.layer}:${f.category}`) ?? 0) + 1);
  console.log(`OSM respaldo: ${n} filas`);
  for (const [k, c] of [...por.entries()].sort()) console.log(`  ${k}: ${c}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
