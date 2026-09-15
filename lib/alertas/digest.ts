export type ItemAviso = {
  titulo: string;
  hora?: string | null;
  tipo: string;
};

export function claveDigest(userId: string, dia: string): string {
  return `digest:${userId}:${dia.slice(0, 10)}`;
}

export function resumenAvisosDia(items: ItemAviso[]): { titulo: string; cuerpo: string; url: string } | null {
  if (items.length === 0) return null;
  const lineas = items
    .slice(0, 5)
    .map((item) => `${item.hora ? `${item.hora} · ` : ""}${item.titulo}`)
    .join(" · ");
  const extra = items.length > 5 ? ` y ${items.length - 5} más` : "";
  const hayVencidas = items.some((item) => item.tipo === "tarea-vencida");
  return {
    titulo: hayVencidas
      ? items.length === 1
        ? "Tarea vencida"
        : `${items.length} avisos (hay vencidas)`
      : items.length === 1
        ? "Hoy en el CRM"
        : `${items.length} avisos hoy`,
    cuerpo: `${lineas}${extra}`,
    url: hayVencidas ? "/tareas" : "/calendario",
  };
}

export function tareaEnDigest(vence: string | null | undefined, dia: string): boolean {
  const fecha = vence?.slice(0, 10);
  return Boolean(fecha && fecha <= dia.slice(0, 10));
}
