import type { SupabaseClient } from "@supabase/supabase-js";
import { horaCita, TIPO_CITA_LABEL, type EstadoCita, type TipoCita } from "@/lib/citas/citas";
import type { EstadoTarea } from "./tareas";

export type CitaParaTarea = {
  id: string;
  comercial_id: string;
  tipo: string;
  titulo: string;
  empieza: string;
  propiedad_id?: string | null;
  cliente_id?: string | null;
  demanda_id?: string | null;
  finca_reference?: string | null;
  estado?: string;
  tarea_id?: string | null;
};

export function venceYHoraDesdeCita(empieza: string): { vence: string; hora: string } {
  return { vence: empieza.slice(0, 10), hora: horaCita(empieza) };
}

export function estadoTareaDesdeCita(estadoCita: string | undefined): EstadoTarea {
  if (estadoCita === "hecha" || estadoCita === "cancelada") return "hecha";
  return "pendiente";
}

/** Prefijo con tipo de cita para distinguir visitas, recordatorios, etc. en el tablero. */
export function tituloTareaDesdeCita(cita: { tipo: string; titulo: string }): string {
  if (cita.tipo === "tarea") return cita.titulo;
  const label = TIPO_CITA_LABEL[cita.tipo as TipoCita];
  if (!label) return cita.titulo;
  const base = cita.titulo.trim();
  if (base.toLowerCase().startsWith(label.toLowerCase())) return base;
  return `${label}: ${base}`;
}

export function patchTareaDesdeCita(cita: CitaParaTarea) {
  const { vence, hora } = venceYHoraDesdeCita(cita.empieza);
  return {
    comercial_id: cita.comercial_id,
    titulo: tituloTareaDesdeCita(cita),
    vence,
    hora,
    estado: estadoTareaDesdeCita(cita.estado),
    propiedad_id: cita.propiedad_id ?? null,
    cliente_id: cita.cliente_id ?? null,
    demanda_id: cita.demanda_id ?? null,
    finca_reference: cita.finca_reference ?? null,
    cita_id: cita.id,
  };
}

export async function syncTareaDesdeCita(
  supabase: SupabaseClient,
  cita: CitaParaTarea,
  opts?: { creadoPor?: string }
): Promise<string | null> {
  const patch = patchTareaDesdeCita(cita);

  if (cita.tarea_id) {
    const { error } = await supabase.from("tareas").update(patch).eq("id", cita.tarea_id);
    if (error) throw error;
    return cita.tarea_id;
  }

  const { data: tarea, error: errInsert } = await supabase
    .from("tareas")
    .insert({
      ...patch,
      creado_por: opts?.creadoPor ?? cita.comercial_id,
    })
    .select("id")
    .single();
  if (errInsert || !tarea) throw errInsert ?? new Error("No se pudo crear la tarea");

  const { error: errLink } = await supabase.from("citas").update({ tarea_id: tarea.id }).eq("id", cita.id);
  if (errLink) throw errLink;

  return tarea.id;
}

export async function syncCitaDesdeTarea(
  supabase: SupabaseClient,
  tarea: {
    id: string;
    comercial_id: string;
    titulo: string;
    vence: string | null;
    hora: string | null;
    cita_id: string | null;
    propiedad_id?: string | null;
    cliente_id?: string | null;
  },
  patch: { hora?: string | null; vence?: string | null; titulo?: string }
): Promise<string | null> {
  const hora = (patch.hora !== undefined ? patch.hora : tarea.hora)?.slice(0, 5) ?? null;
  const vence = (patch.vence !== undefined ? patch.vence : tarea.vence) ?? new Date().toISOString().slice(0, 10);
  const tituloCita = patch.titulo ?? tarea.titulo;
  if (!hora) return tarea.cita_id;

  const [hh, mm] = hora.split(":").map(Number);
  const empieza = new Date(`${vence}T12:00:00`);
  empieza.setHours(hh || 12, mm || 0, 0, 0);
  const termina = new Date(empieza);
  termina.setHours(empieza.getHours() + 1);

  if (tarea.cita_id) {
    await supabase
      .from("citas")
      .update({ empieza: empieza.toISOString(), termina: termina.toISOString(), titulo: tituloCita })
      .eq("id", tarea.cita_id);
    return tarea.cita_id;
  }

  const { data } = await supabase
    .from("citas")
    .insert({
      comercial_id: tarea.comercial_id,
      tipo: "tarea",
      titulo: tituloCita,
      empieza: empieza.toISOString(),
      termina: termina.toISOString(),
      tarea_id: tarea.id,
      propiedad_id: tarea.propiedad_id ?? null,
      cliente_id: tarea.cliente_id ?? null,
    })
    .select("id")
    .single();

  if (data?.id) {
    await supabase.from("tareas").update({ cita_id: data.id }).eq("id", tarea.id);
  }
  return data?.id ?? null;
}

export async function syncEstadoTareaDesdeCita(
  supabase: SupabaseClient,
  cita: CitaParaTarea,
  estado: EstadoCita
): Promise<void> {
  await syncTareaDesdeCita(supabase, { ...cita, estado }, { creadoPor: cita.comercial_id });
}

const SELECT_CITA_SYNC =
  "id, comercial_id, tipo, titulo, empieza, propiedad_id, cliente_id, demanda_id, finca_reference, estado, tarea_id";

/** Crea tareas para citas antiguas que aún no tienen enlace (backfill en cliente). */
export async function backfillTareasDesdeCalendario(
  supabase: SupabaseClient,
  opts?: { comercialId?: string; creadoPor?: string }
): Promise<number> {
  let q = supabase
    .from("citas")
    .select(SELECT_CITA_SYNC)
    .is("tarea_id", null)
    .neq("estado", "cancelada")
    .order("empieza", { ascending: false })
    .limit(50);
  if (opts?.comercialId) q = q.eq("comercial_id", opts.comercialId);
  const { data: citas, error } = await q;
  if (error || !citas?.length) return 0;

  let n = 0;
  for (const cita of citas) {
    try {
      await syncTareaDesdeCita(supabase, cita as CitaParaTarea, {
        creadoPor: opts?.creadoPor ?? cita.comercial_id,
      });
      n += 1;
    } catch {
      /* siguiente cita */
    }
  }
  return n;
}
