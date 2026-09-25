import {
  creditosGratisMes,
  topePeticionesMensual,
  UNLOCKER_USD_POR_MIL,
  usdPresupuestoMes,
} from "@/lib/captacion/brightdata/presupuesto-unlocker-math";
import { rangoMesUtc } from "@/lib/captacion/brightdata/saldo";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export { UNLOCKER_USD_POR_MIL, creditosGratisMes, usdPresupuestoMes, topePeticionesMensual } from "@/lib/captacion/brightdata/presupuesto-unlocker-math";

export type ResumenPresupuestoUnlocker = {
  creditosGratis: number;
  usdMes: number;
  topeMes: number;
  usadasMes: number;
  restantesMes: number;
  topeDia: number;
  usadasDia: number;
  restantesDia: number;
  mesEtiqueta: string;
};

function diasEnMesUtc(ahora: Date): number {
  const y = ahora.getUTCFullYear();
  const m = ahora.getUTCMonth();
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}

/** Reparte el tope mensual a lo largo del mes (UTC) para no quemarlo en pocos días. */
export function topePeticionesDiario(ahora = new Date(), topeMes = topePeticionesMensual()): number {
  const fijo = process.env.CAPTACION_UNLOCKER_TOPE_DIA?.trim();
  if (fijo) {
    const n = Number(fijo);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return Math.ceil(topeMes / diasEnMesUtc(ahora));
}

function rangoDiaUtc(ahora: Date): { from: string; to: string } {
  const y = ahora.getUTCFullYear();
  const m = ahora.getUTCMonth();
  const d = ahora.getUTCDate();
  const from = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}T00:00:00.000Z`;
  const next = new Date(Date.UTC(y, m, d + 1));
  const to = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}T00:00:00.000Z`;
  return { from, to };
}

export async function peticionesUsadasEnRango(
  supabase: SupabaseClient,
  fromIso: string,
  toIso: string
): Promise<number> {
  const { data, error } = await supabase
    .from("captacion_rafagas")
    .select("paginas")
    .gte("iniciada_en", fromIso)
    .lt("iniciada_en", toIso);
  if (error) throw new Error(error.message);
  let total = 0;
  for (const row of data ?? []) {
    const p = (row as { paginas?: number }).paginas;
    if (typeof p === "number" && Number.isFinite(p) && p > 0) total += p;
  }
  return total;
}

export async function resumenPresupuestoUnlocker(ahora = new Date()): Promise<ResumenPresupuestoUnlocker> {
  const supabase = createAdminClient();
  const mes = rangoMesUtc(ahora);
  const dia = rangoDiaUtc(ahora);
  const topeMes = topePeticionesMensual();
  const topeDia = topePeticionesDiario(ahora, topeMes);
  const [usadasMes, usadasDia] = await Promise.all([
    peticionesUsadasEnRango(supabase, `${mes.from}T00:00:00.000Z`, `${mes.to}T00:00:00.000Z`),
    peticionesUsadasEnRango(supabase, dia.from, dia.to),
  ]);
  return {
    creditosGratis: creditosGratisMes(),
    usdMes: usdPresupuestoMes(),
    topeMes,
    usadasMes,
    restantesMes: Math.max(0, topeMes - usadasMes),
    topeDia,
    usadasDia,
    restantesDia: Math.max(0, topeDia - usadasDia),
    mesEtiqueta: mes.etiqueta,
  };
}

export type CupoRafagaPresupuesto =
  | { cupo: number; omitir?: undefined }
  | { cupo: 0; omitir: "tope_mes" | "tope_dia" };

/** Cuántas páginas puede procesar la siguiente ráfaga sin pasarse del presupuesto. */
export async function cupoPaginasRafagaPresupuesto(ahora = new Date()): Promise<CupoRafagaPresupuesto> {
  const r = await resumenPresupuestoUnlocker(ahora);
  if (r.restantesMes <= 0) return { cupo: 0, omitir: "tope_mes" };
  if (r.restantesDia <= 0) return { cupo: 0, omitir: "tope_dia" };
  return { cupo: Math.min(r.restantesMes, r.restantesDia) };
}

export function textoPresupuestoUnlocker(r: ResumenPresupuestoUnlocker): string {
  const plan = `${r.creditosGratis.toLocaleString("es-ES")} créditos + ${r.usdMes.toFixed(0)} USD`;
  return `${r.usadasMes.toLocaleString("es-ES")} / ${r.topeMes.toLocaleString("es-ES")} peticiones (${plan}, ${r.mesEtiqueta}). Hoy: ${r.usadasDia} / ${r.topeDia}.`;
}
