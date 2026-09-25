import {
  creditosGratisMes,
  topePeticionesMensual,
  usdEstimadoTrasCreditos,
  usdPresupuestoMes,
} from "@/lib/captacion/brightdata/presupuesto-unlocker-math";
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
  paginasDia: number;
  diasMes: number;
  paginasMes: number;
  topeMes: number;
  creditosGratis: number;
  usdMes: number;
  pctDelTope: number;
  dentroTope: boolean;
  margenPeticiones: number;
  usdEstimadoListado: number;
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

/** Peticiones Unlocker/mes solo por listado diario (municipios marcados + provincia 48 h). */
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
  const paginasDia = paginasMunicipiosDia + paginasProvinciaDia;
  const diasMes = diasMesNatural(ahora);
  const paginasMes = paginasDia * diasMes;
  const pctDelTope = topeMes > 0 ? paginasMes / topeMes : 0;
  return {
    zonasActivas: activas.length,
    paginasMunicipiosDia,
    paginasProvinciaDia,
    paginasDia,
    diasMes,
    paginasMes,
    topeMes,
    creditosGratis,
    usdMes,
    pctDelTope,
    dentroTope: paginasMes <= topeMes,
    margenPeticiones: topeMes - paginasMes,
    usdEstimadoListado: usdEstimadoTrasCreditos(paginasMes, creditosGratis),
  };
}

export function paginasListadoDiaZonaActiva(
  id: string,
  activa: boolean,
  estimados: Record<string, number | null | undefined>
): number {
  return activa ? paginasListadoDiaZona(id, estimados) : 0;
}
