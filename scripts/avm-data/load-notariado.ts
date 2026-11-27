/**
 * Agregados del Portal Estadístico del Notariado → market_close_series
 * y el descuento de anuncio a cierre en market_discount.
 *
 * npx tsx scripts/avm-data/load-notariado.ts --file data/notariado/2026-10.json
 * PENOTARIADO_TOKEN=… npx tsx scripts/avm-data/load-notariado.ts --fetch --municipios 15030
 *
 * La consulta oficial exige autorización. Sin token ni fichero, el cargador
 * se detiene: no se salta el acceso.
 */
import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "../env-load/_shared";
import {
  CONSULTAS,
  URL_ESTADISTICAS,
  descuentosDe,
  filaDesdeEstadistica,
  filasDesdeFichero,
  type FilaCierre,
  type NivelNotariado,
  type OfertaZona,
  type TipoNotariado,
} from "../../lib/avm/notariado";

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

function periodoActual(): string {
  const hoy = new Date();
  const mes = String(hoy.getUTCMonth() + 1).padStart(2, "0");
  return `${hoy.getUTCFullYear()}-${mes}-01`;
}

function codigos(flag: string): string[] {
  return (arg(flag) ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

async function municipiosEnRastreo(db: SupabaseClient): Promise<string[]> {
  const { data, error } = await db.from("market_crawl_targets").select("municipality_code").eq("active", true);
  if (error) throw new Error(error.message);
  return [...new Set((data ?? []).map((row) => String(row.municipality_code ?? "").trim()).filter(Boolean))];
}

async function unaEstadistica(token: string, zoneLevel: NivelNotariado, zoneKey: string, mainType: TipoNotariado): Promise<FilaCierre | null> {
  const consulta = CONSULTAS.find((c) => c.mainType === mainType);
  if (!consulta) return null;
  const url = new URL(URL_ESTADISTICAS);
  url.searchParams.set("lang", "es");
  url.searchParams.set("kpi", "pricePerSqm");
  url.searchParams.set("locationType", zoneLevel === "municipality" ? "MN" : "CP");
  url.searchParams.set("locationCode", zoneKey);
  url.searchParams.set("constructionType", consulta.constructionType);
  url.searchParams.set("propertyType", consulta.propertyType);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const mensaje = body && typeof body === "object" && "error_description" in body ? String(body.error_description) : `HTTP ${res.status}`;
    throw new Error(`Notariado ${zoneKey}: ${mensaje}`);
  }
  return filaDesdeEstadistica({ zoneLevel, zoneKey, mainType, body, period: periodoActual() });
}

async function descargar(token: string, db: SupabaseClient): Promise<FilaCierre[]> {
  const municipios = codigos("--municipios");
  const cps = codigos("--cps");
  const zonas: { level: NivelNotariado; key: string }[] = [
    ...(municipios.length ? municipios : await municipiosEnRastreo(db)).map((key) => ({ level: "municipality" as const, key })),
    ...cps.map((key) => ({ level: "postcode" as const, key })),
  ];
  if (!zonas.length) throw new Error("No hay municipios en rastreo. Pasa --municipios o --file.");
  const filas: FilaCierre[] = [];
  for (const zona of zonas) {
    for (const consulta of CONSULTAS) {
      const fila = await unaEstadistica(token, zona.level, zona.key, consulta.mainType);
      if (fila) filas.push(fila);
    }
  }
  return filas;
}

async function ofertasDe(db: SupabaseClient, filas: FilaCierre[]): Promise<OfertaZona[]> {
  const salida: OfertaZona[] = [];
  for (const nivel of ["municipality", "postcode"] as const) {
    const claves = [...new Set(filas.filter((f) => f.zoneLevel === nivel).map((f) => f.zoneKey))];
    if (!claves.length) continue;
    const { data, error } = await db
      .from("market_zone_stats")
      .select("zone_key, main_type, month, n, median_ppm2")
      .eq("zone_level", nivel)
      .eq("operation", "sale")
      .in("zone_key", claves);
    if (error) throw new Error(error.message);
    const ultima = new Map<string, { month: string; n: number; median: number; mainType: TipoNotariado }>();
    for (const row of data ?? []) {
      const mainType = row.main_type === "house" || row.main_type === "apartment" ? row.main_type : null;
      if (!mainType) continue;
      const clave = `${row.zone_key}|${mainType}`;
      const month = String(row.month).slice(0, 10);
      const previa = ultima.get(clave);
      if (previa && previa.month >= month) continue;
      ultima.set(clave, { month, n: Number(row.n), median: Number(row.median_ppm2), mainType });
    }
    for (const [clave, zona] of ultima) {
      const zoneKey = clave.slice(0, clave.lastIndexOf("|"));
      salida.push({ zoneLevel: nivel, zoneKey, mainType: zona.mainType, n: zona.n, medianPpm2: zona.median });
    }
  }
  return salida;
}

async function guardar(db: SupabaseClient, filas: FilaCierre[]): Promise<number> {
  if (!filas.length) return 0;
  const series = filas.map((fila) => ({
    source: "notariado",
    zone_level: fila.zoneLevel,
    zone_key: fila.zoneKey,
    main_type: fila.mainType,
    period: fila.period,
    ppm2: fila.ppm2,
    transactions: fila.transactions,
    raw: { superficie_media: fila.surface, compraventas: fila.transactions },
  }));
  const { error } = await db.from("market_close_series").upsert(series, {
    onConflict: "source,zone_level,zone_key,main_type,period",
  });
  if (error) throw new Error(error.message);

  const ofertas = await ofertasDe(db, filas);
  const descuentos = descuentosDe(filas, ofertas);
  const cubiertos = new Set(descuentos.map((d) => `${d.zoneLevel}|${d.zoneKey}|${d.mainType}`));
  for (const fila of filas) {
    const clave = `${fila.zoneLevel}|${fila.zoneKey}|${fila.mainType}`;
    if (cubiertos.has(clave)) continue;
    const { error: baja } = await db
      .from("market_discount")
      .delete()
      .eq("zone_level", fila.zoneLevel)
      .eq("zone_key", fila.zoneKey)
      .eq("main_type", fila.mainType);
    if (baja) throw new Error(baja.message);
  }
  if (descuentos.length) {
    const { error: descuentoError } = await db.from("market_discount").upsert(
      descuentos.map((d) => ({
        zone_level: d.zoneLevel,
        zone_key: d.zoneKey,
        main_type: d.mainType,
        discount_pct: d.discountPct,
        n_observations: d.nObservations,
        computed_at: new Date().toISOString(),
      })),
      { onConflict: "zone_level,zone_key,main_type" },
    );
    if (descuentoError) throw new Error(descuentoError.message);
  }
  return filas.length;
}

async function main(): Promise<void> {
  const fichero = arg("--file");
  const db = await adminClient();
  let filas: FilaCierre[];
  if (fichero) {
    filas = filasDesdeFichero(JSON.parse(readFileSync(fichero, "utf8")), periodoActual());
  } else if (process.argv.includes("--fetch")) {
    const token = process.env.PENOTARIADO_TOKEN?.trim();
    if (!token) {
      throw new Error(
        "El Portal Estadístico del Notariado exige autorización. Exporta el fichero mensual y pásalo con --file, o define PENOTARIADO_TOKEN. No se salta el acceso.",
      );
    }
    filas = await descargar(token, db);
  } else {
    throw new Error("Pasa --file ruta.json o --fetch.");
  }
  const total = await guardar(db, filas);
  process.env.AVM_LAST_ROWS = String(total);
  console.log(`Notariado: ${total} zonas con cierre`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
