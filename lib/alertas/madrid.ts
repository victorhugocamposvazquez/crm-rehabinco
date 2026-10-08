const ZONA = "Europe/Madrid";

export function fechaMadrid(ahora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}

export function partesMadrid(ahora = new Date()): { hora: number; minuto: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONA,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(ahora);
  const leer = (tipo: string) => Number(parts.find((p) => p.type === tipo)?.value ?? "0");
  return { hora: leer("hour"), minuto: leer("minute") };
}

/** El cron va cada 15 min: la hora elegida entra de HH:00 a HH:14, hora de Madrid. */
export function esFranjaDeHora(horaElegida: number, ahora = new Date()): boolean {
  const hora = Math.trunc(horaElegida);
  if (hora < 0 || hora > 23) return false;
  const partes = partesMadrid(ahora);
  return partes.hora === hora && partes.minuto < 15;
}

/** La pasada de las 10:00, el valor por defecto. */
export function esFranjaManana(ahora = new Date()): boolean {
  return esFranjaDeHora(10, ahora);
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
