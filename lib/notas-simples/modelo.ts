/**
 * Notas simples del Registro de la Propiedad.
 *
 * Flujo: borrador → solicitada → en_tramite → recibida → leida
 * (cancelada y error son finales; error permite reintentar volviendo a solicitada).
 * El proveedor es intercambiable (`proveedor.ts`): hoy "manual" (alguien del
 * equipo la pide en la sede electrónica del Registro y sube el PDF); mañana una API.
 */

export const ESTADOS_NOTA = ["borrador", "solicitada", "en_tramite", "recibida", "leida", "cancelada", "error"] as const;
export type EstadoNota = (typeof ESTADOS_NOTA)[number];

export const ETIQUETA_ESTADO_NOTA: Record<EstadoNota, string> = {
  borrador: "Borrador",
  solicitada: "Solicitada",
  en_tramite: "En trámite",
  recibida: "Recibida",
  leida: "Leída",
  cancelada: "Cancelada",
  error: "Con incidencia",
};

const TRANSICIONES: Record<EstadoNota, EstadoNota[]> = {
  borrador: ["solicitada", "cancelada"],
  solicitada: ["en_tramite", "recibida", "cancelada", "error"],
  en_tramite: ["recibida", "cancelada", "error"],
  recibida: ["leida"],
  leida: [],
  cancelada: [],
  error: ["solicitada", "cancelada"],
};

export function puedePasar(de: EstadoNota, a: EstadoNota): boolean {
  return TRANSICIONES[de].includes(a);
}

export function parseEstadoNota(v: unknown): EstadoNota | null {
  return typeof v === "string" && (ESTADOS_NOTA as readonly string[]).includes(v) ? (v as EstadoNota) : null;
}

/**
 * Motivo (interés legítimo). El Registro exige declararlo; se ofrecen los
 * habituales de una agencia y "otro" con texto libre.
 */
export const MOTIVOS_NOTA = [
  { id: "compraventa", label: "Compraventa: comprobar titularidad y cargas" },
  { id: "arrendamiento", label: "Arrendamiento" },
  { id: "tasacion", label: "Valoración o tasación" },
  { id: "encargo", label: "Encargo de venta del propietario" },
  { id: "otro", label: "Otro" },
] as const;
export type MotivoNota = (typeof MOTIVOS_NOTA)[number]["id"];

export interface SolicitudNota {
  /** Referencia catastral de 14 (finca) o 20 (inmueble). Al menos una de ref, idufir o finca+registro. */
  refCatastral: string | null;
  idufir: string | null;
  fincaRegistral: string | null;
  registro: string | null;
  direccion: string;
  municipio: string | null;
  provincia: string | null;
  titular: string | null;
  motivo: MotivoNota;
  motivoTexto: string | null;
  propiedadId: string | null;
}

const RC = /^[0-9A-Z]{14}([0-9A-Z]{6})?$/;
const IDUFIR = /^\d{14}$/;

export function normalizarRef(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/[\s-]/g, "").toUpperCase();
  return s ? s : null;
}

function texto(v: unknown, max = 300): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/\s+/g, " ");
  return s ? s.slice(0, max) : null;
}

/** Valida el cuerpo de una solicitud. Devuelve la solicitud limpia o la lista de errores. */
export function validarSolicitud(cuerpo: Record<string, unknown>): { ok: true; solicitud: SolicitudNota } | { ok: false; errores: string[] } {
  const errores: string[] = [];
  const refCatastral = normalizarRef(cuerpo.refCatastral);
  const idufir = normalizarRef(cuerpo.idufir);
  const fincaRegistral = texto(cuerpo.fincaRegistral, 40);
  const registro = texto(cuerpo.registro, 120);
  const direccion = texto(cuerpo.direccion) ?? "";
  const motivo = MOTIVOS_NOTA.some((m) => m.id === cuerpo.motivo) ? (cuerpo.motivo as MotivoNota) : null;
  const motivoTexto = texto(cuerpo.motivoTexto, 500);

  if (refCatastral && !RC.test(refCatastral)) errores.push("La referencia catastral debe tener 14 o 20 caracteres.");
  if (idufir && !IDUFIR.test(idufir)) errores.push("El IDUFIR (CRU) tiene 14 dígitos.");
  if (!refCatastral && !idufir && !(fincaRegistral && registro)) {
    errores.push("Indica la referencia catastral, el IDUFIR o la finca registral con su Registro.");
  }
  if (!direccion) errores.push("Falta la dirección.");
  if (!motivo) errores.push("Elige el motivo de la consulta.");
  if (motivo === "otro" && !motivoTexto) errores.push("Explica el motivo.");

  if (errores.length) return { ok: false, errores };
  return {
    ok: true,
    solicitud: {
      refCatastral: refCatastral && RC.test(refCatastral) ? refCatastral : null,
      idufir,
      fincaRegistral,
      registro,
      direccion,
      municipio: texto(cuerpo.municipio, 120),
      provincia: texto(cuerpo.provincia, 120),
      titular: texto(cuerpo.titular, 200),
      motivo: motivo!,
      motivoTexto,
      propiedadId: typeof cuerpo.propiedadId === "string" && /^[0-9a-f-]{36}$/i.test(cuerpo.propiedadId) ? cuerpo.propiedadId : null,
    },
  };
}

/** Días durante los que una nota recibida se reutiliza en vez de pedir otra. */
export const DIAS_VIGENCIA_NOTA = 90;

export interface NotaResumen {
  id: string;
  estado: EstadoNota;
  ref_catastral: string | null;
  idufir: string | null;
  recibida_en: string | null;
  created_at: string;
}

/**
 * ¿Hay ya una nota de la misma finca, recibida hace menos de 90 días o en curso?
 * La finca se compara por los 14 primeros caracteres de la referencia o por IDUFIR.
 */
export function notaReutilizable(
  existentes: NotaResumen[],
  s: Pick<SolicitudNota, "refCatastral" | "idufir">,
  ahora = new Date()
): NotaResumen | null {
  const finca = s.refCatastral?.slice(0, 14) ?? null;
  const limite = ahora.getTime() - DIAS_VIGENCIA_NOTA * 86_400_000;
  const mismas = existentes.filter(
    (n) => (finca && n.ref_catastral?.slice(0, 14) === finca && (s.refCatastral?.length !== 20 || n.ref_catastral === s.refCatastral)) || (s.idufir && n.idufir === s.idufir)
  );
  const enCurso = mismas.find((n) => n.estado === "solicitada" || n.estado === "en_tramite");
  if (enCurso) return enCurso;
  return (
    mismas
      .filter((n) => (n.estado === "recibida" || n.estado === "leida") && n.recibida_en && new Date(n.recibida_en).getTime() >= limite)
      .sort((a, b) => (b.recibida_en ?? "").localeCompare(a.recibida_en ?? ""))[0] ?? null
  );
}

export function rutaPdfNota(id: string): string {
  return `notas-simples/${id}.pdf`;
}
