/**
 * GTFS Compañía de Tranvías de A Coruña (o respaldo OSM)
 *
 * npx tsx scripts/env-load/gtfs.ts
 * npx tsx scripts/env-load/gtfs.ts --zip ~/Downloads/tranvias-coruna.zip
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { adminClient, borrarCapa, dataDir, enBbox, insertarLotes, puntoWkt, type LayerRow } from "./_shared";

const SOURCE = "GTFS";
const LOADED_AT = new Date().toISOString();

const URLS = [
  "https://nap.mitma.es/api/v1/datasets/gtfs/search?query=coru%C3%B1a",
  "https://datos.coruna.gal/dataset/compania-de-tranvias-de-la-coruna",
];

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(",");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (cols[i] ?? "").trim();
    });
    return row;
  });
}

function leerZipStops(zipPath: string): LayerRow[] {
  // Sin dependencia zip: el usuario descomprime o pasa carpeta con stops.txt
  const dir = zipPath.endsWith(".zip") ? zipPath.replace(/\.zip$/, "") : zipPath;
  const stopsFile = path.join(dir, "stops.txt");
  const routesFile = path.join(dir, "routes.txt");
  const tripsFile = path.join(dir, "trips.txt");
  const stopTimesFile = path.join(dir, "stop_times.txt");
  if (!existsSync(stopsFile)) {
    console.warn(`No encuentro stops.txt en ${dir}; sin cambios en GTFS.`);
    return [];
  }

  const stops = parseCsv(readFileSync(stopsFile, "utf8"));
  const routeByTrip = new Map<string, string>();
  if (existsSync(tripsFile) && existsSync(routesFile)) {
    const trips = parseCsv(readFileSync(tripsFile, "utf8"));
    for (const t of trips) routeByTrip.set(t.trip_id, t.route_id);
  }
  const routesAtStop = new Map<string, Set<string>>();
  if (existsSync(stopTimesFile)) {
    const st = parseCsv(readFileSync(stopTimesFile, "utf8"));
    for (const row of st) {
      const trip = row.trip_id;
      const stopId = row.stop_id;
      const route = routeByTrip.get(trip);
      if (!route || !stopId) continue;
      const set = routesAtStop.get(stopId) ?? new Set();
      set.add(route);
      routesAtStop.set(stopId, set);
    }
  }

  const filas: LayerRow[] = [];
  for (const s of stops) {
    const lat = Number(s.stop_lat);
    const lng = Number(s.stop_lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !enBbox(lat, lng)) continue;
    const routes = [...(routesAtStop.get(s.stop_id) ?? [])];
    filas.push({
      layer: "gtfs_stop",
      category: s.location_type === "1" ? "rail" : "bus",
      name: s.stop_name ?? null,
      sense: "positive",
      props: { stop_id: s.stop_id, routes },
      geom: puntoWkt(lng, lat),
      source: SOURCE,
      loaded_at: LOADED_AT,
    });
  }
  return filas;
}

async function main(): Promise<void> {
  const zip = arg("--zip");
  if (!zip) {
    console.warn("Sin --zip: no hay feed GTFS local. Fuentes probadas:", URLS.join(" · "));
    console.warn("Las paradas de bus/tranvía siguen en OSM (gtfs_stop). Salida sin cambios.");
    return;
  }
  const t0 = Date.now();
  const filas = leerZipStops(path.resolve(zip));
  const db = await adminClient();
  await borrarCapa(db, { source: SOURCE, layer: "gtfs_stop" });
  const n = await insertarLotes(db, filas);
  console.log(`GTFS: ${n} paradas en ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
