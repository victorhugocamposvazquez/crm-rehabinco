/**
 * Descarga MITECO (gis.miteco.gob.es) + conversión shapefile → GeoJSONSeq vía ogr2ogr.
 */
import { execSync, spawnSync } from "node:child_process";
import { createWriteStream, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export const MITECO_DESCARGA = "https://gis.miteco.gob.es/descargas/app/DescargaFichero?f=";

export function requireGdal(): void {
  const r = spawnSync("ogr2ogr", ["--version"], { encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error("Instala GDAL: brew install gdal (necesitas ogr2ogr y unzip).");
  }
}

export async function downloadMitecoZip(filename: string, destZip: string): Promise<void> {
  if (existsSync(destZip) && statSync(destZip).size > 10_000) {
    console.log(`  (ya existe ${path.basename(destZip)}, ${Math.round(statSync(destZip).size / 1e6)} MB)`);
    return;
  }
  const url = MITECO_DESCARGA + encodeURIComponent(filename);
  console.log(`  Descargando ${filename}…`);
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`${filename}: HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body as import("node:stream/web").ReadableStream), createWriteStream(destZip));
  const mb = Math.round(statSync(destZip).size / 1e6);
  console.log(`  → ${mb} MB`);
}

export function unzipTo(zipPath: string, outDir: string): void {
  execSync(`unzip -q -o ${JSON.stringify(zipPath)} -d ${JSON.stringify(outDir)}`, {
    stdio: "inherit",
  });
}

export function findFirstShp(dir: string): string {
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop()!;
    for (const name of readdirSync(d)) {
      const full = path.join(d, name);
      const st = statSync(full);
      if (st.isDirectory()) stack.push(full);
      else if (name.toLowerCase().endsWith(".shp")) return full;
    }
  }
  throw new Error(`No hay .shp en ${dir}`);
}

/** GeoJSONSeq en WGS84, geometría simplificada (~decenas de m). */
export function shpToGeoJsonSeq(shp: string, outSeq: string, simplifyDeg = 0.00008): void {
  if (existsSync(outSeq) && statSync(outSeq).size > 1000) {
    console.log(`  (ya existe ${path.basename(outSeq)})`);
    return;
  }
  execSync(
    [
      "ogr2ogr",
      "-t_srs",
      "EPSG:4326",
      "-simplify",
      String(simplifyDeg),
      "-f",
      "GeoJSONSeq",
      JSON.stringify(outSeq),
      JSON.stringify(shp),
    ].join(" "),
    { stdio: "inherit" },
  );
}

export async function prepareMitecoShpLayer(
  filename: string,
  workRoot: string,
  simplifyDeg = 0.00008,
): Promise<{ geojsonSeq: string; shp: string }> {
  const base = filename.replace(/\.zip$/i, "");
  const zipPath = path.join(workRoot, filename);
  const extractDir = path.join(workRoot, base);
  const geojsonSeq = path.join(workRoot, `${base}.geojsonl`);

  await downloadMitecoZip(filename, zipPath);
  unzipTo(zipPath, extractDir);
  const shp = findFirstShp(extractDir);
  shpToGeoJsonSeq(shp, geojsonSeq, simplifyDeg);
  return { geojsonSeq, shp };
}
