import {
  creditosGratisMes,
  topePeticionesMensual,
  usdEstimadoTrasCreditos,
  usdPresupuestoMes,
  usdProyectadoFinMesDesdeGastoAcumulado,
  usdValorMercadoPeticiones,
} from "@/lib/captacion/brightdata/presupuesto-unlocker-math";
import {
  SONDEO_NOVEDADES_CADA_MIN,
  SONDEO_NOVEDADES_PAGINAS,
  sondeosNovedadesPorDia,
} from "@/lib/captacion/brightdata/novedades";
import { paginasListadoEstimadasConEstimados, paginasListadoDiaZona } from "@/lib/captacion/brightdata/zonas";

export type PresupuestoUnlockerCliente = {
  topeMes: number;
  creditosGratis: number;
  usdMes: number;
  usadasMes: number;
  restantesMes: number;
};

export type SimulacionListadoZonas = {
  zonasActivas: number;
  paginasMunicipiosDia: number;
  paginasProvinciaDia: number;
  /** Pasada completa diaria (municipios + 1× provincia 48 h). */
  paginasCompletaDia: number;
  sondeosNovedadesDia: number;
  sondeoCadaMin: number;
  paginasSondeoDia: number;
  /** Completa + sondeos de novedades. */
  paginasDia: number;
  diasMes: number;
  paginasMes: number;
  paginasCompletaMes: number;
  paginasSondeoMes: number;
  topeMes: number;
  creditosGratis: number;
  usdMes: number;
  pctDelTope: number;
  dentroTope: boolean;
  margenPeticiones: number;
  usdEstimadoListado: number;
  usdTarifaListadoMes: number;
  usdTarifaCompletaMes: number;
  usdTarifaSondeoMes: number;
  usdBolsilloListadoMes: number;
  /** Listado simulado descontando créditos aún no consumidos este mes. */
  usdBolsilloListadoTrasUsoReal: number;
  creditosRestantesMes: number;
  usdMesOrientativoPeticiones: number;
  pctPresupuestoUsdListado: number;
};

export type GastoBrightDataCliente = {
  gastoMes: number | null;
  gastoUnlockerMes: number | null;
  productos: Array<{ id: string; usd: number }>;
  mes: string | null;
  aviso: string | null;
  usdProyectadoFinMes: number | null;
  usdProyectadoUnlockerFinMes: number | null;
};

export function diasMesNatural(ahora = new Date()): number {
  return new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).getDate();
}

export function presupuestoUnlockerPorDefecto(): Omit<PresupuestoUnlockerCliente, "usadasMes" | "restantesMes"> {
  const topeMes = topePeticionesMensual();
  return {
    topeMes,
    creditosGratis: creditosGratisMes(),
    usdMes: usdPresupuestoMes(),
  };
}

/**
 * Peticiones Unlocker/mes: pasada completa diaria (municipios + provincia 48 h)
 * + sondeos de novedades cada 15 min (solo filtro 48 h).
 */
export function simularListadoZonas(
  activas: string[],
  estimados: Record<string, number | null | undefined>,
  presupuesto?: Partial<PresupuestoUnlockerCliente>,
  ahora = new Date()
): SimulacionListadoZonas {
  const base = presupuestoUnlockerPorDefecto();
  const topeMes = presupuesto?.topeMes ?? base.topeMes;
  const creditosGratis = presupuesto?.creditosGratis ?? base.creditosGratis;
  const usdMes = presupuesto?.usdMes ?? base.usdMes;
  const paginasMunicipiosDia = paginasListadoEstimadasConEstimados(activas, estimados);
  const paginasProvinciaDia = activas.length > 0 ? 1 : 0;
  const paginasCompletaDia = paginasMunicipiosDia + paginasProvinciaDia;
  const sondeoCadaMin = SONDEO_NOVEDADES_CADA_MIN;
  const sondeosNovedadesDia = activas.length > 0 ? sondeosNovedadesPorDia(sondeoCadaMin) : 0;
  const paginasSondeoDia = sondeosNovedadesDia * SONDEO_NOVEDADES_PAGINAS;
  const paginasDia = paginasCompletaDia + paginasSondeoDia;
  const diasMes = diasMesNatural(ahora);
  const paginasCompletaMes = paginasCompletaDia * diasMes;
  const paginasSondeoMes = paginasSondeoDia * diasMes;
  const paginasMes = paginasDia * diasMes;
  const pctDelTope = topeMes > 0 ? paginasMes / topeMes : 0;
  const usadasMes = presupuesto?.usadasMes ?? 0;
  const creditosRestantesMes = Math.max(0, creditosGratis - usadasMes);
  const usdTarifaCompletaMes = usdValorMercadoPeticiones(paginasCompletaMes);
  const usdTarifaSondeoMes = usdValorMercadoPeticiones(paginasSondeoMes);
  const usdTarifaListadoMes = usdValorMercadoPeticiones(paginasMes);
  const usdBolsilloListadoMes = usdEstimadoTrasCreditos(paginasMes, creditosGratis);
  const usdBolsilloListadoTrasUsoReal = usdEstimadoTrasCreditos(paginasMes, creditosRestantesMes);
  const peticionesMesOrientativo = usadasMes + paginasMes;
  const usdMesOrientativoPeticiones = usdEstimadoTrasCreditos(peticionesMesOrientativo, creditosGratis);
  return {
    zonasActivas: activas.length,
    paginasMunicipiosDia,
    paginasProvinciaDia,
    paginasCompletaDia,
    sondeosNovedadesDia,
    sondeoCadaMin,
    paginasSondeoDia,
    paginasDia,
    diasMes,
    paginasMes,
    paginasCompletaMes,
    paginasSondeoMes,
    topeMes,
    creditosGratis,
    usdMes,
    pctDelTope,
    dentroTope: paginasMes <= topeMes,
    margenPeticiones: topeMes - paginasMes,
    usdEstimadoListado: usdBolsilloListadoMes,
    usdTarifaListadoMes,
    usdTarifaCompletaMes,
    usdTarifaSondeoMes,
    usdBolsilloListadoMes,
    usdBolsilloListadoTrasUsoReal,
    creditosRestantesMes,
    usdMesOrientativoPeticiones,
    pctPresupuestoUsdListado: usdMes > 0 ? usdBolsilloListadoTrasUsoReal / usdMes : 0,
  };
}

export function usdListadoMesZona(id: string, estimados: Record<string, number | null | undefined>, diasMes: number): number {
  const pet = paginasListadoDiaZona(id, estimados) * diasMes;
  return usdValorMercadoPeticiones(pet);
}

export function enriquecerGastoBrightData(
  gasto: {
    gastoMes: number | null;
    gastoUnlockerMes?: number | null;
    productos?: Array<{ id: string; usd: number }>;
    mes: string | null;
    aviso: string | null;
  },
  ahora = new Date()
): GastoBrightDataCliente {
  const g = gasto.gastoMes;
  const u = gasto.gastoUnlockerMes ?? null;
  return {
    gastoMes: g,
    gastoUnlockerMes: u,
    productos: gasto.productos ?? [],
    mes: gasto.mes,
    aviso: gasto.aviso,
    usdProyectadoFinMes: g != null ? usdProyectadoFinMesDesdeGastoAcumulado(g, ahora) : null,
    usdProyectadoUnlockerFinMes: u != null ? usdProyectadoFinMesDesdeGastoAcumulado(u, ahora) : null,
  };
}

export function paginasListadoDiaZonaActiva(
  id: string,
  activa: boolean,
  estimados: Record<string, number | null | undefined>
): number {
  return activa ? paginasListadoDiaZona(id, estimados) : 0;
}
