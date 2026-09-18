const MADRID = "Europe/Madrid";
const MIN_SIN_PROXY_MS = 8000;
const MAX_SIN_PROXY_MS = 15000;

export function ritmoEfectivo(
  ritmo: { minMs: number; maxMs: number },
  sinProxy: boolean
): { minMs: number; maxMs: number } {
  if (!sinProxy) return ritmo;
  const minMs = Math.max(ritmo.minMs, MIN_SIN_PROXY_MS);
  const maxMs = Math.max(ritmo.maxMs, MAX_SIN_PROXY_MS, minMs);
  return { minMs, maxMs };
}

export function esperaEntrePeticiones(minMs: number, maxMs: number): number {
  const hora = horaMadrid();
  const factor = hora >= 2 && hora < 7 ? 3 : 1;
  const min = minMs * factor;
  const max = Math.max(maxMs * factor, min);
  return min + Math.floor(Math.random() * (max - min + 1));
}

function horaMadrid(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: MADRID,
    hour: "numeric",
    hour12: false,
  }).formatToParts(new Date());
  return Number(parts.find((p) => p.type === "hour")?.value ?? "12");
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
