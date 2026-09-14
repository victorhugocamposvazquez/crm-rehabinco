export const TIPOS_CITA = ["visita", "llamada", "firma", "otro"] as const;
export type TipoCita = (typeof TIPOS_CITA)[number];

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
  const params = new URLSearchParams({ cita: cita.id });
  if (cita.propiedadId) params.set("propiedad", cita.propiedadId);
  return `/partes-visita/nuevo?${params.toString()}`;
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
