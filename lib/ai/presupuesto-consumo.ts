/** Tarifas Anthropic API (USD / millón de tokens), cache 1 h. */
export type TarifaModelo = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite1h: number;
};

export const TARIFAS_USD_POR_MTOK: Record<string, TarifaModelo> = {
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite1h: 10 },
  "claude-sonnet-4-6": { input: 3, output: 15, cacheRead: 0.3, cacheWrite1h: 6 },
};

export type UsoCopiloto = {
  modelo: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  usd: number;
};

export type AcumuladoCopiloto = {
  llamadas: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  usd: number;
};

export const ACUMULADO_VACIO: AcumuladoCopiloto = {
  llamadas: 0,
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  usd: 0,
};

export const STORAGE_CONSUMO_COPILOTO = "crm.copiloto.consumo";

export function nombreModelo(id: string) {
  if (id.includes("opus")) return "Opus";
  if (id.includes("sonnet")) return "Sonnet";
  return id;
}

export function usoDesdeSdk(
  modelo: string,
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    inputTokenDetails?: {
      noCacheTokens?: number;
      cacheReadTokens?: number;
      cacheWriteTokens?: number;
    };
  }
): UsoCopiloto {
  const cacheRead = usage.inputTokenDetails?.cacheReadTokens ?? 0;
  const cacheWrite = usage.inputTokenDetails?.cacheWriteTokens ?? 0;
  const totalInput = usage.inputTokens ?? 0;
  const noCache =
    usage.inputTokenDetails?.noCacheTokens ?? Math.max(0, totalInput - cacheRead - cacheWrite);
  const output = usage.outputTokens ?? 0;
  const tarifa = TARIFAS_USD_POR_MTOK[modelo] ?? TARIFAS_USD_POR_MTOK["claude-opus-5"];
  const usd =
    (noCache * tarifa.input +
      cacheRead * tarifa.cacheRead +
      cacheWrite * tarifa.cacheWrite1h +
      output * tarifa.output) /
    1_000_000;
  return {
    modelo,
    input: totalInput || noCache + cacheRead + cacheWrite,
    output,
    cacheRead,
    cacheWrite,
    usd,
  };
}

export function sumarUso(a: AcumuladoCopiloto, b: UsoCopiloto): AcumuladoCopiloto {
  return {
    llamadas: a.llamadas + 1,
    input: a.input + b.input,
    output: a.output + b.output,
    cacheRead: a.cacheRead + b.cacheRead,
    cacheWrite: a.cacheWrite + b.cacheWrite,
    usd: a.usd + b.usd,
  };
}

export function formatoUsd(n: number) {
  if (n > 0 && n < 0.01) return "< 0,01 $";
  return `${n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}

export function formatoMiles(n: number) {
  if (n >= 1000) return `${(n / 1000).toLocaleString("es-ES", { maximumFractionDigits: 1 })} k`;
  return String(n);
}

export function leerTotalGuardado(): AcumuladoCopiloto {
  if (typeof window === "undefined") return ACUMULADO_VACIO;
  try {
    const raw = window.localStorage.getItem(STORAGE_CONSUMO_COPILOTO);
    if (!raw) return ACUMULADO_VACIO;
    const parsed = JSON.parse(raw) as Partial<AcumuladoCopiloto>;
    return {
      llamadas: Number(parsed.llamadas) || 0,
      input: Number(parsed.input) || 0,
      output: Number(parsed.output) || 0,
      cacheRead: Number(parsed.cacheRead) || 0,
      cacheWrite: Number(parsed.cacheWrite) || 0,
      usd: Number(parsed.usd) || 0,
    };
  } catch {
    return ACUMULADO_VACIO;
  }
}

export function guardarTotal(total: AcumuladoCopiloto) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_CONSUMO_COPILOTO, JSON.stringify(total));
}
