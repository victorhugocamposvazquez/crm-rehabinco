export const TIPOS_CITA = ["visita", "llamada", "firma", "evento", "recordatorio", "tarea", "otro"] as const;
export type TipoCita = (typeof TIPOS_CITA)[number];

export const TIPOS_ALTA_CALENDARIO = ["evento", "recordatorio", "tarea", "visita"] as const;
export type TipoAltaCalendario = (typeof TIPOS_ALTA_CALENDARIO)[number];

export const ESTADOS_CITA = ["prevista", "hecha", "no_asistio", "cancelada"] as const;
export type EstadoCita = (typeof ESTADOS_CITA)[number];

export type CitaCaptacion = {
  id: string;
  comercialId: string;
  tipo: TipoCita;
  titulo: string;
  empieza: string;
  termina: string;
  propiedadId: string | null;
  clienteId: string | null;
  demandaId: string | null;
  fincaReference: string | null;
  estado: EstadoCita;
  color?: string | null;
};

export function relacionUno<T>(valor: T | T[] | null | undefined): T | null {
  if (valor == null) return null;
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

export const TIPO_CITA_LABEL: Record<TipoCita, string> = {
  visita: "Visita",
  llamada: "Llamada",
  firma: "Firma",
  evento: "Evento",
  recordatorio: "Recordatorio",
  tarea: "Tarea",
  otro: "Otro",
};

export const ESTADO_CITA_LABEL: Record<EstadoCita, string> = {
  prevista: "Prevista",
  hecha: "Hecha",
  no_asistio: "No asistió",
  cancelada: "Cancelada",
};

export function puedeHacerParte(cita: { tipo: string; estado: string }): boolean {
  return cita.tipo === "visita" && cita.estado === "prevista";
}

export function horaCita(empieza: string): string {
  const fecha = new Date(empieza);
  if (Number.isNaN(fecha.getTime())) return empieza.slice(11, 16) || "—";
  return `${String(fecha.getHours()).padStart(2, "0")}:${String(fecha.getMinutes()).padStart(2, "0")}`;
}

export function citasAgrupadasPorDia<T extends { empieza: string }>(citas: T[], dias: string[]): Map<string, T[]> {
  const mapa = new Map(dias.map((dia) => [dia, [] as T[]]));
  for (const cita of citas) {
    const clave = cita.empieza.slice(0, 10);
    mapa.get(clave)?.push(cita);
  }
  for (const [clave, lista] of mapa) {
    mapa.set(
      clave,
      [...lista].sort((a, b) => a.empieza.localeCompare(b.empieza))
    );
  }
  return mapa;
}

export function moverSemana(dia: string, semanas: number): string {
  const base = new Date(`${dia.slice(0, 10)}T12:00:00`);
  base.setDate(base.getDate() + semanas * 7);
  return base.toISOString().slice(0, 10);
}

export function rutaNuevaCita(input: { propiedadId?: string | null; clienteId?: string | null }): string {
  const params = new URLSearchParams();
  if (input.propiedadId) params.set("propiedad", input.propiedadId);
  if (input.clienteId) params.set("cliente", input.clienteId);
  const query = params.toString();
  return query ? `/calendario?${query}` : "/calendario";
}

export function rutaNuevaVisitaDesdeCita(cita: {
  id: string;
  propiedadId?: string | null;
}): string {
  const params = new URLSearchParams({ nueva: "1", cita: cita.id });
  if (cita.propiedadId) params.set("propiedad", cita.propiedadId);
  return `/partes-visita?${params.toString()}`;
}

export function citasDelDia<T extends { empieza: string }>(citas: T[], dia: string): T[] {
  const clave = dia.slice(0, 10);
  return citas
    .filter((cita) => cita.empieza.slice(0, 10) === clave)
    .sort((a, b) => a.empieza.localeCompare(b.empieza));
}

export function semanaDesde(dia: string): string[] {
  const base = new Date(`${dia.slice(0, 10)}T12:00:00`);
  const lunes = new Date(base);
  const offset = (base.getDay() + 6) % 7;
  lunes.setDate(base.getDate() - offset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes);
    d.setDate(lunes.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export const CAL_HORA_INICIO = 9;
export const CAL_HORA_FIN = 19;
export const CAL_PX_HORA = 48;
export const CAL_SNAP_MIN = 15;

export function snapMinutos(minutos: number, paso = CAL_SNAP_MIN): number {
  return Math.round(minutos / paso) * paso;
}

export function minutosDesdeOffsetY(
  offsetY: number,
  pxPorHora = CAL_PX_HORA,
  horaInicio = CAL_HORA_INICIO
): number {
  return snapMinutos(horaInicio * 60 + (offsetY / pxPorHora) * 60);
}

export function posicionEventoCalendario(
  empieza: string,
  termina: string,
  horaInicio = CAL_HORA_INICIO,
  pxPorHora = CAL_PX_HORA
): { top: number; height: number } {
  const start = new Date(empieza);
  const end = new Date(termina);
  const top = Math.max(0, (start.getHours() + start.getMinutes() / 60 - horaInicio) * pxPorHora);
  const dur = Math.max(0.5, (end.getTime() - start.getTime()) / 3_600_000);
  return { top, height: Math.max(30, dur * pxPorHora - 4) };
}

export function moverCitaADiaHora(input: {
  empieza: string;
  termina: string;
  dia: string;
  minutos: number;
}): { empieza: string; termina: string; vence: string; hora: string } {
  const durMs = Math.max(
    CAL_SNAP_MIN * 60 * 1000,
    new Date(input.termina).getTime() - new Date(input.empieza).getTime()
  );
  const minutos = Math.max(0, Math.min(23 * 60 + 45, snapMinutos(input.minutos)));
  const start = new Date(`${input.dia.slice(0, 10)}T00:00:00`);
  start.setHours(Math.floor(minutos / 60), minutos % 60, 0, 0);
  const end = new Date(start.getTime() + durMs);
  const hora = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
  return {
    empieza: start.toISOString(),
    termina: end.toISOString(),
    vence: input.dia.slice(0, 10),
    hora,
  };
}

export function minutosLocalesDeCita(empieza: string): number {
  const d = new Date(empieza);
  if (Number.isNaN(d.getTime())) return CAL_HORA_INICIO * 60;
  return d.getHours() * 60 + d.getMinutes();
}

export function minutosDesdeHora(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return snapMinutos((Number.isFinite(h) ? h : CAL_HORA_INICIO) * 60 + (Number.isFinite(m) ? m : 0));
}

export function horaDesdeMinutos(minutos: number): string {
  const acotados = Math.max(0, Math.min(23 * 60 + 45, snapMinutos(minutos)));
  const h = Math.floor(acotados / 60);
  const m = acotados % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function prefillParteDesdeCita(cita: {
  titulo: string;
  empieza: string;
  propiedadId?: string | null;
}): {
  propiedadId: string;
  fechaVisita: string;
  horaVisita: string;
  observaciones: string;
} {
  const empieza = new Date(cita.empieza);
  const hora = Number.isNaN(empieza.getTime())
    ? "10:00"
    : `${String(empieza.getHours()).padStart(2, "0")}:${String(empieza.getMinutes()).padStart(2, "0")}`;
  return {
    propiedadId: cita.propiedadId ?? "",
    fechaVisita: cita.empieza.slice(0, 10),
    horaVisita: hora,
    observaciones: cita.titulo,
  };
}
