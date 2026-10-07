import { TIPO_CITA_LABEL, type TipoCita } from "@/lib/citas/citas";
import { createAdminClient } from "@/lib/supabase/admin";
import { canalDeTipo } from "./prefs";
import { publicarAviso } from "./publicar";

/** Margen para un cron cada 15 min: si una pasada se retrasa, la cita sigue entrando. */
export const VENTANA_MINUTOS = 70;
const GRACIA_PASADO_MS = 5 * 60 * 1000;

export function citaEnVentana(empiezaIso: string, ahora: Date, ventanaMin = VENTANA_MINUTOS): boolean {
  const cuando = new Date(empiezaIso).getTime();
  if (Number.isNaN(cuando)) return false;
  const t = ahora.getTime();
  return cuando >= t - GRACIA_PASADO_MS && cuando <= t + ventanaMin * 60 * 1000;
}

export function clavePronto(citaId: string, empieza: string): string {
  return `pronto:${citaId}:${empieza}`;
}

export function minutosHasta(empiezaIso: string, ahora: Date): number {
  return Math.round((new Date(empiezaIso).getTime() - ahora.getTime()) / 60000);
}

export function textoPronto(empiezaIso: string, ahora: Date): string {
  const min = minutosHasta(empiezaIso, ahora);
  if (min <= 1) return "Empieza ahora";
  return `Empieza en ${min} min`;
}

export function horaMadrid(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
    hourCycle: "h23",
  }).format(d);
}

function etiquetaTipo(tipo: string): string {
  if (tipo in TIPO_CITA_LABEL) return TIPO_CITA_LABEL[tipo as TipoCita];
  return "Cita";
}

/** Avisa de citas que empiezan en la próxima hora. Idempotente por cita y hora de inicio. */
export async function dispararVentanaAlertas(ahora = new Date()) {
  const admin = createAdminClient();
  const desde = new Date(ahora.getTime() - GRACIA_PASADO_MS).toISOString();
  const hasta = new Date(ahora.getTime() + VENTANA_MINUTOS * 60 * 1000).toISOString();
  const { data: citas, error } = await admin
    .from("citas")
    .select("id, comercial_id, titulo, empieza, tipo, lugar")
    .eq("estado", "prevista")
    .gte("empieza", desde)
    .lte("empieza", hasta);
  if (error) throw new Error(error.message);

  let avisos = 0;
  let omitidos = 0;
  for (const cita of citas ?? []) {
    if (!cita.comercial_id || !citaEnVentana(cita.empieza, ahora)) {
      omitidos += 1;
      continue;
    }
    const tipo = etiquetaTipo(cita.tipo);
    const hora = horaMadrid(cita.empieza);
    const donde = cita.lugar?.trim();
    const resultado = await publicarAviso({
      userId: cita.comercial_id,
      clave: clavePronto(cita.id, cita.empieza),
      titulo: `${textoPronto(cita.empieza, ahora)} · ${tipo}`,
      cuerpo: [hora, cita.titulo, donde].filter(Boolean).join(" · "),
      url: `/calendario?cita=${cita.id}`,
      canal: canalDeTipo(cita.tipo),
    });
    if (resultado === "nuevo") avisos += 1;
    else omitidos += 1;
  }
  return { ok: true as const, modo: "ventana" as const, avisos, omitidos, revisadas: citas?.length ?? 0 };
}
