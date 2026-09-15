import { canalDeTipo, type CanalAviso } from "./prefs";

export type ItemAviso = {
  titulo: string;
  hora?: string | null;
  tipo: string;
};

const URL_CANAL: Record<CanalAviso, string> = {
  visitas: "/calendario",
  recordatorios: "/calendario",
  agenda: "/calendario",
  tareas_hoy: "/tareas",
  tareas_vencidas: "/tareas",
  menciones: "/tareas",
  partes: "/partes-visita",
};

const TITULO_CANAL: Record<CanalAviso, (n: number) => string> = {
  visitas: (n) => (n === 1 ? "Visita hoy" : `${n} visitas hoy`),
  recordatorios: (n) => (n === 1 ? "Recordatorio hoy" : `${n} recordatorios hoy`),
  agenda: (n) => (n === 1 ? "Hoy en la agenda" : `${n} avisos de agenda`),
  tareas_hoy: (n) => (n === 1 ? "Tarea de hoy" : `${n} tareas hoy`),
  tareas_vencidas: (n) => (n === 1 ? "Tarea vencida" : `${n} tareas vencidas`),
  menciones: (n) => (n === 1 ? "Te han mencionado" : `${n} menciones en tareas`),
  partes: (n) => (n === 1 ? "Parte sin firmar" : `${n} partes sin firmar`),
};

export function claveDigest(userId: string, dia: string, canal?: CanalAviso): string {
  const base = `digest:${userId}:${dia.slice(0, 10)}`;
  return canal ? `${base}:${canal}` : base;
}

export function agruparPorCanal(items: ItemAviso[]): Record<CanalAviso, ItemAviso[]> {
  const grupos: Record<CanalAviso, ItemAviso[]> = {
    visitas: [],
    recordatorios: [],
    agenda: [],
    tareas_hoy: [],
    tareas_vencidas: [],
    menciones: [],
    partes: [],
  };
  for (const item of items) grupos[canalDeTipo(item.tipo)].push(item);
  return grupos;
}

export function resumenPorCanal(
  canal: CanalAviso,
  items: ItemAviso[]
): { titulo: string; cuerpo: string; url: string } | null {
  if (items.length === 0) return null;
  const lineas = items
    .slice(0, 5)
    .map((item) => `${item.hora ? `${item.hora} · ` : ""}${item.titulo}`)
    .join(" · ");
  const extra = items.length > 5 ? ` y ${items.length - 5} más` : "";
  return {
    titulo: TITULO_CANAL[canal](items.length),
    cuerpo: `${lineas}${extra}`,
    url: URL_CANAL[canal],
  };
}

export function resumenAvisosDia(items: ItemAviso[]): { titulo: string; cuerpo: string; url: string } | null {
  if (items.length === 0) return null;
  const grupos = agruparPorCanal(items);
  const canales = (Object.keys(grupos) as CanalAviso[]).filter((canal) => grupos[canal].length > 0);
  if (canales.length === 1) return resumenPorCanal(canales[0]!, grupos[canales[0]!]);
  const lineas = items
    .slice(0, 5)
    .map((item) => `${item.hora ? `${item.hora} · ` : ""}${item.titulo}`)
    .join(" · ");
  const extra = items.length > 5 ? ` y ${items.length - 5} más` : "";
  const hayVencidas = grupos.tareas_vencidas.length > 0;
  return {
    titulo: hayVencidas ? `${items.length} avisos (hay vencidas)` : `${items.length} avisos hoy`,
    cuerpo: `${lineas}${extra}`,
    url: hayVencidas ? "/tareas" : "/calendario",
  };
}

export function tareaEnDigest(vence: string | null | undefined, dia: string): boolean {
  const fecha = vence?.slice(0, 10);
  return Boolean(fecha && fecha <= dia.slice(0, 10));
}
