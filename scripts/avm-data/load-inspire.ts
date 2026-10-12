/**
 * Catastro INSPIRE Buildings (WFS) → catastro_buildings
 * Solo municipios activos en market_crawl_targets (salvo --municipio).
 *
 * npx tsx scripts/avm-data/load-inspire.ts --scope spain/galicia
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveGeofabrikScope, geofabrikScopeFromProvince } from "../../lib/avm/geofabrik";
import { adminClient, dataDir, leerNdjson } from "../env-load/_shared";

const WFS = "https://ovc.catastro.meh.es/INSPIRE/wfsBU.aspx";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

function asegurarGdal(): void {
  try {
    execSync("ogr2ogr --version", { stdio: "ignore" });
  } catch {
    throw new Error("Instala GDAL (ogr2ogr).");
  }
}

type GeoFeature = {
  type: "Feature";
  id?: string;
  properties?: Record<string, unknown>;
  geometry?: GeoJSON.Geometry;
};

function parcelFromRef(ref: string): string {
  const clean = ref.replace(/\s/g, "");
  return clean.slice(0, 14).padEnd(14, "0");
}

function yearFromProps(p: Record<string, unknown>): number | null {
  const beginning = p["beginning"] ?? p["bu-core2d:beginning"];
  if (typeof beginning === "string" && /^\d{4}/.test(beginning)) return Number(beginning.slice(0, 4));
  return null;
}

function refFromProps(p: Record<string, unknown>, fallbackId?: string): string {
  const ext = p.reference ?? p["bu-core2d:reference"];
  if (typeof ext === "string" && ext.length >= 14) return ext.replace(/\s/g, "");
  if (fallbackId) return fallbackId.replace(/^.*\./, "").replace(/\s/g, "");
  return "";
}

function municipioEnScope(code: string, scope: string): boolean {
  if (scope === "spain" || scope === "all") return true;
  if (/^\d{5}$/.test(scope)) return code === scope;
  if (/^\d{2}$/.test(scope)) return code.startsWith(scope);
  const prov = code.slice(0, 2);
  return geofabrikScopeFromProvince(prov) === scope;
}

async function municipiosObjetivo(db: Awaited<ReturnType<typeof adminClient>>, scope: string): Promise<string[]> {
  const uno = arg("--municipio");
  if (uno) return [uno.replace(/\D/g, "").padStart(5, "0")];

  const { data, error } = await db.from("market_crawl_targets").select("municipality_code").eq("active", true);
  if (error) throw new Error(error.message);
  const codes = [...new Set((data ?? []).map((r) => String(r.municipality_code)))];
  return codes.filter((c) => municipioEnScope(c, scope));
}

async function descargarMunicipio(work: string, muni: string, bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number }): Promise<string> {
  const out = path.join(work, `${muni}.geojsonseq`);
  if (existsSync(out)) rmSync(out);
  const pad = 0.002;
  const cmd = [
    "ogr2ogr",
    "-f", "GeoJSONSeq",
    `"${out}"`,
    `WFS:${WFS}`,
    "bu:Building",
    "-spat", String(bbox.minLng - pad), String(bbox.minLat - pad), String(bbox.maxLng + pad), String(bbox.maxLat + pad),
    "-t_srs", "EPSG:4326",
  ].join(" ");
  execSync(cmd, { stdio: "inherit", cwd: root });
  return out;
}

async function main(): Promise<void> {
  asegurarGdal();
  const scope = resolveGeofabrikScope(arg("--scope") ?? "spain");
  const db = await adminClient();
  const munis = await municipiosObjetivo(db, scope);
  if (!munis.length) {
    console.log("Sin municipios en market_crawl_targets para el alcance indicado.");
    process.env.AVM_LAST_ROWS = "0";
    return;
  }

  const work = dataDir("inspire-wfs");
  mkdirSync(work, { recursive: true });
  let total = 0;
  const loadedAt = new Date().toISOString();

  for (const muni of munis) {
    const { data: bboxRaw, error: bbErr } = await db.rpc("avm_municipality_bbox", { p_muni: muni });
    if (bbErr) throw new Error(bbErr.message);
    const bbox = bboxRaw as { minLng?: number; minLat?: number; maxLng?: number; maxLat?: number } | null;
    if (!bbox?.minLng) {
      console.warn(`  ${muni}: sin bbox (¿faltan secciones INE?) — omitido`);
      continue;
    }

    console.log(`\n▶ INSPIRE ${muni}…`);
    const geo = await descargarMunicipio(work, muni, bbox as { minLng: number; minLat: number; maxLng: number; maxLat: number });
    if (!existsSync(geo) || readFileSync(geo, "utf8").trim().length === 0) continue;

    await db.from("catastro_buildings").delete().eq("municipality_code", muni);

    const batch: Record<string, unknown>[] = [];
    const flush = async () => {
      if (!batch.length) return;
      const { data, error } = await db.rpc("avm_upsert_catastro_buildings_batch", { p_rows: batch });
      if (error) throw new Error(error.message);
      total += Number(data ?? batch.length);
      batch.length = 0;
    };

    await leerNdjson<GeoFeature>(geo, async (f) => {
      if (!f.geometry) return;
      const p = f.properties ?? {};
      const buildingRef = refFromProps(p, f.id);
      if (!buildingRef) return;
      const parcelRef = parcelFromRef(buildingRef);
      batch.push({
        municipality_code: muni,
        parcel_ref: parcelRef,
        building_ref: buildingRef,
        year_built: yearFromProps(p),
        current_use: typeof p.currentUse === "string" ? p.currentUse : null,
        dwellings: typeof p.numberOfDwellings === "number" ? p.numberOfDwellings : null,
        building_units: typeof p.numberOfBuildingUnits === "number" ? p.numberOfBuildingUnits : null,
        floors_above_ground: null,
        area_m2: null,
        condition: typeof p.conditionOfConstruction === "string" ? p.conditionOfConstruction : null,
        geom: f.geometry,
        loaded_at: loadedAt,
      });
      if (batch.length >= 150) await flush();
    });
    await flush();
    console.log(`  ${muni}: acumulado ${total}`);
  }

  process.env.AVM_LAST_ROWS = String(total);
  console.log(`\nINSPIRE: ${total} edificios (${munis.length} municipios)`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
