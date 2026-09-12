import { esOrigenCatastroExplorer, fincaReferenceDesdeVinculo } from "./catastro/explorer";

export const EMPRESA_PARTE_VISITA = {
  razonSocial: "REHABINCO, S.L.",
  cif: "B22834005",
  direccion: "Rúa da Merced nº 57, Bajo – 15009 A Coruña",
  lugar: "A Coruña",
} as const;

export const ESTADO_PARTE_LABELS: Record<
  "borrador" | "pendiente_firma" | "firmado",
  string
> = {
  borrador: "Borrador",
  pendiente_firma: "Pendiente de firma",
  firmado: "Firmado",
};

export function formatFechaLargaEs(dateStr: string | null | undefined): string {
  if (!dateStr) return "____ de ________________ de 20____";
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "____ de ________________ de 20____";
  const day = d.getDate();
  const month = d.toLocaleDateString("es-ES", { month: "long" });
  const year = String(d.getFullYear()).slice(-2);
  return `${day} de ${month} de 20${year}`;
}

export function formatHoraVisita(hora: string | null | undefined): string {
  if (!hora) return "—";
  return hora.slice(0, 5);
}

export function rutaNuevaVisitaDesdeProperty(propertyId: string): string {
  return `/partes-visita/nuevo?propiedad=${encodeURIComponent(propertyId)}`;
}

export function visitaDesdePropertyExigePropiedad(
  desdeProperty: boolean,
  propiedadId: string | null | undefined
): boolean {
  if (!desdeProperty) return true;
  return Boolean(propiedadId?.trim());
}

export function partirVisitasPorFecha<T extends { fecha_visita: string | null }>(
  visitas: T[],
  hoy: string
): { proximas: T[]; historial: T[] } {
  const proximas: T[] = [];
  const historial: T[] = [];
  for (const visita of visitas) {
    if (!visita.fecha_visita || visita.fecha_visita >= hoy) proximas.push(visita);
    else historial.push(visita);
  }
  proximas.sort((a, b) => (a.fecha_visita ?? "9999").localeCompare(b.fecha_visita ?? "9999"));
  historial.sort((a, b) => (b.fecha_visita ?? "").localeCompare(a.fecha_visita ?? ""));
  return { proximas, historial };
}

export type ContextoCatastralVisita = {
  origen: "CATASTRO_EXPLORER";
  fincaReference: string;
} | null;

/** Contexto derivado de Property → link. No copia la ficha catastral. */
export function contextoCatastralDesdeProperty(input: {
  origen?: string | null;
  referenciaCatastral?: string | null;
  link?: { fincaReference: string } | null;
}): ContextoCatastralVisita {
  const fincaReference = fincaReferenceDesdeVinculo({
    origen: input.origen,
    referenciaCatastral: input.referenciaCatastral,
    link: input.link,
  });
  if (!fincaReference) return null;
  if (!esOrigenCatastroExplorer(input.origen) && !input.link) return null;
  return { origen: "CATASTRO_EXPLORER", fincaReference };
}

export function buildPublicFirmaUrl(token: string, origin?: string): string {
  const base =
    origin ??
    (typeof window !== "undefined" ? window.location.origin : "") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "";
  return `${base.replace(/\/$/, "")}/firmar/${token}`;
}
