/**
 * Perfil descriptivo del UNKNOWN aplicable.
 * No clasifica DH: no cambia YES / NO / UNKNOWN / NOT_APPLICABLE.
 */
import { normalizarLiteralLtp } from "./ltp-catalogo";

export type GrupoUsoUnknown =
  | "residencial"
  | "industrial"
  | "almacen"
  | "comercial"
  | "mixto"
  | "otro"
  | "sin_uso";

export type CuboRc = "1" | "2-5" | ">5";
export type CuboLcons = "0" | "1" | ">1";
export type CasoUnknown = "A_construida" | "B_uso_ambiguo" | "C_datos_insuficientes";

export function normalizarUsoOficial(uso: string | null | undefined): string {
  return normalizarLiteralLtp(uso ?? "");
}

export function grupoUsoDeUno(uso: string | null | undefined): GrupoUsoUnknown {
  const n = normalizarUsoOficial(uso);
  if (!n) return "sin_uso";
  if (/\bresidencial\b/.test(n)) return "residencial";
  if (/\bindustrial\b/.test(n)) return "industrial";
  if (/\balmacen\b/.test(n) || /\bestacionamiento\b/.test(n)) return "almacen";
  if (/\bcomercial\b/.test(n) || /\boficina\b/.test(n)) return "comercial";
  return "otro";
}

/** Varios usos oficiales distintos (tras agrupar) → mixto. */
export function grupoUsoDe(usos: Array<string | null | undefined>): GrupoUsoUnknown {
  const grupos = new Set(
    usos.map(grupoUsoDeUno).filter((grupo) => grupo !== "sin_uso")
  );
  if (grupos.size === 0) return "sin_uso";
  if (grupos.size > 1) return "mixto";
  return [...grupos][0] ?? "sin_uso";
}

export function cuboRc(propertyReferences: number): CuboRc {
  if (propertyReferences <= 1) return "1";
  if (propertyReferences <= 5) return "2-5";
  return ">5";
}

export function cuboLcons(lcons: number): CuboLcons {
  if (lcons <= 0) return "0";
  if (lcons === 1) return "1";
  return ">1";
}

const USOS_CONSTRUIDOS = new Set<GrupoUsoUnknown>([
  "residencial",
  "industrial",
  "almacen",
  "comercial",
]);

function tieneDatoConstructivo(input: {
  superficie: number | null;
  superficieSolar: number | null;
  anio: number | null;
  lcons: number;
  planta: string | null;
  puerta: string | null;
}): boolean {
  return (
    (input.superficie != null && input.superficie > 0) ||
    (input.superficieSolar != null && input.superficieSolar > 0) ||
    input.anio != null ||
    input.lcons > 0 ||
    Boolean(input.planta?.trim()) ||
    Boolean(input.puerta?.trim())
  );
}

/**
 * Por qué el UNKNOWN aplicable no tiene `ltp`, sin inferir DH.
 * A: uso construido conocido. B: uso raro o solo indicios. C: casi nada oficial.
 */
export function casoUnknownDe(input: {
  usos: Array<string | null | undefined>;
  superficie: number | null;
  superficieSolar: number | null;
  anio: number | null;
  lcons: number;
  planta?: string | null;
  puerta?: string | null;
}): CasoUnknown {
  const grupo = grupoUsoDe(input.usos);
  if (USOS_CONSTRUIDOS.has(grupo) || grupo === "mixto") return "A_construida";
  if (grupo === "otro") return "B_uso_ambiguo";
  if (tieneDatoConstructivo({ ...input, planta: input.planta ?? null, puerta: input.puerta ?? null })) {
    return "B_uso_ambiguo";
  }
  return "C_datos_insuficientes";
}

export function recuentoGruposUso(grupos: GrupoUsoUnknown[]): Record<GrupoUsoUnknown, number> {
  const recuento: Record<GrupoUsoUnknown, number> = {
    residencial: 0,
    industrial: 0,
    almacen: 0,
    comercial: 0,
    mixto: 0,
    otro: 0,
    sin_uso: 0,
  };
  for (const grupo of grupos) recuento[grupo] += 1;
  return recuento;
}
