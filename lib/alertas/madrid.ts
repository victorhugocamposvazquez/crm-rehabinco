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
