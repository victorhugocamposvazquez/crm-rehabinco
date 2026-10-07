import { createAdminClient } from "@/lib/supabase/admin";
import { prefsCompletas, SELECT_PREFS_AVISO, type CanalAviso, type PrefsAviso } from "./prefs";
import { publicarAviso } from "./publicar";
import { horaMadrid } from "./ventana";

const ZONA = "Europe/Madrid";

export function fechaMadrid(ahora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}

function partesMadrid(ahora: Date): { hora: number; minuto: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONA,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(ahora);
  const leer = (tipo: string) => Number(parts.find((p) => p.type === tipo)?.value ?? "0");
  return { hora: leer("hour"), minuto: leer("minute") };
}

/** La pasada de las 10:00. El cron va cada 15 min, así que entra de 10:00 a 10:14. */
export function esFranjaManana(ahora = new Date()): boolean {
  const { hora, minuto } = partesMadrid(ahora);
  return hora === 10 && minuto < 15;
}

export function claveManana(userId: string, fecha: string): string {
  return `dia:${userId}:${fecha}`;
}

export function cuerpoTareasDelDia(items: { hora: string | null; titulo: string }[]): string {
  const lineas = items.slice(0, 4).map((item) => (item.hora ? `${item.hora} ${item.titulo}` : item.titulo));
  const extra = items.length > 4 ? ` y ${items.length - 4} más` : "";
  return `${lineas.join(" · ")}${extra}`;
}

function canalResumen(prefs: PrefsAviso): CanalAviso | null {
  if (prefs.tareas_hoy) return "tareas_hoy";
  if (prefs.visitas) return "visitas";
  if (prefs.agenda) return "agenda";
  if (prefs.recordatorios) return "recordatorios";
  return null;
}

function offsetMadridMinutos(instante: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instante);
  const leer = (tipo: string) => Number(parts.find((p) => p.type === tipo)?.value ?? "0");
  const comoUtc = Date.UTC(leer("year"), leer("month") - 1, leer("day"), leer("hour"), leer("minute"), leer("second"));
  return Math.round((comoUtc - instante.getTime()) / 60000);
}

export function rangoDiaMadrid(fecha: string): { desde: string; hasta: string } {
  const provisional = new Date(`${fecha}T00:00:00Z`);
  const desde = new Date(provisional.getTime() - offsetMadridMinutos(provisional) * 60000);
  const ajustado = new Date(provisional.getTime() - offsetMadridMinutos(desde) * 60000);
  const hasta = new Date(ajustado.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { desde: ajustado.toISOString(), hasta: hasta.toISOString() };
}

type ItemDia = { hora: string | null; titulo: string; orden: number };

function ordenDeHora(hora: string | null): number {
  if (!hora) return 24 * 60 + 1;
  const [h, m] = hora.split(":");
  const hn = Number(h);
  const mn = Number(m);
  if (!Number.isFinite(hn) || !Number.isFinite(mn)) return 24 * 60 + 1;
  return hn * 60 + mn;
}

/** Un push a las 10:00 (Madrid): «Tus tareas del día», enlace al calendario. Una vez por persona y día. */
export async function dispararMananaAlertas(ahora = new Date()) {
  if (!esFranjaManana(ahora)) {
    return { ok: true as const, modo: "manana" as const, avisos: 0, motivo: "fuera de hora" as const };
  }

  const fecha = fechaMadrid(ahora);
  const { desde, hasta } = rangoDiaMadrid(fecha);
  const admin = createAdminClient();
  const [{ data: citas, error: errCitas }, { data: tareas, error: errTareas }, { data: prefsRows, error: errPrefs }] =
    await Promise.all([
      admin
        .from("citas")
        .select("id, comercial_id, titulo, empieza, estado")
        .eq("estado", "prevista")
        .gte("empieza", desde)
        .lte("empieza", hasta),
      admin.from("tareas").select("id, comercial_id, titulo, vence, hora, estado").eq("estado", "pendiente").eq("vence", fecha),
      admin.from("crm_aviso_prefs").select(`user_id, ${SELECT_PREFS_AVISO}`),
    ]);
  if (errCitas) throw new Error(errCitas.message);
  if (errTareas) throw new Error(errTareas.message);
  if (errPrefs) throw new Error(errPrefs.message);

  const prefsPorUsuario = new Map<string, PrefsAviso>();
  for (const row of prefsRows ?? []) prefsPorUsuario.set(row.user_id, prefsCompletas(row));

  const porUsuario = new Map<string, ItemDia[]>();
  const meter = (userId: string | null | undefined, item: ItemDia) => {
    if (!userId) return;
    const lista = porUsuario.get(userId) ?? [];
    lista.push(item);
    porUsuario.set(userId, lista);
  };

  for (const cita of citas ?? []) {
    const hora = horaMadrid(cita.empieza);
    meter(cita.comercial_id, { hora, titulo: cita.titulo, orden: ordenDeHora(hora) });
  }
  for (const tarea of tareas ?? []) {
    const hora = tarea.hora?.slice(0, 5) ?? null;
    meter(tarea.comercial_id, { hora, titulo: tarea.titulo, orden: ordenDeHora(hora) });
  }

  let avisos = 0;
  for (const [userId, items] of porUsuario) {
    if (items.length === 0) continue;
    const canal = canalResumen(prefsPorUsuario.get(userId) ?? prefsCompletas(null));
    if (!canal) continue;
    items.sort((a, b) => a.orden - b.orden);
    const resultado = await publicarAviso({
      userId,
      clave: claveManana(userId, fecha),
      titulo: "Tus tareas del día",
      cuerpo: cuerpoTareasDelDia(items),
      url: "/calendario",
      canal,
    });
    if (resultado === "nuevo") avisos += 1;
  }

  return { ok: true as const, modo: "manana" as const, avisos, motivo: "enviado" as const, fecha };
}
