export type GastoBrightData = {
  saldo: number | null;
  pendiente: number | null;
  gastoMes: number | null;
  mes: string;
  aviso: string | null;
};

/** Mes natural en UTC, como lo factura Bright Data. `to` es exclusivo. */
export function rangoMesUtc(ahora: Date): { from: string; to: string; etiqueta: string } {
  const ano = ahora.getUTCFullYear();
  const mes = ahora.getUTCMonth();
  const from = fechaUtc(ano, mes, 1);
  const siguiente = new Date(Date.UTC(ano, mes + 1, 1));
  const to = fechaUtc(siguiente.getUTCFullYear(), siguiente.getUTCMonth(), 1);
  const etiqueta = new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(ahora);
  return { from, to, etiqueta };
}

function fechaUtc(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Suma el JSON del Cost Explorer: un objeto por día y, dentro, el importe de cada producto. */
export function sumarCoste(cuerpo: unknown): number {
  if (!cuerpo || typeof cuerpo !== "object" || Array.isArray(cuerpo)) return 0;
  let total = 0;
  for (const dia of Object.values(cuerpo as Record<string, unknown>)) {
    if (!dia || typeof dia !== "object" || Array.isArray(dia)) continue;
    for (const valor of Object.values(dia as Record<string, unknown>)) {
      if (typeof valor === "number" && Number.isFinite(valor)) total += valor;
    }
  }
  return Math.round(total * 100) / 100;
}

export async function leerGastoBrightData(token: string, ahora = new Date()): Promise<GastoBrightData> {
  const rango = rangoMesUtc(ahora);
  const [balance, coste] = await Promise.all([
    pedir(token, "https://api.brightdata.com/customer/balance"),
    pedir(token, "https://api.brightdata.com/costs/export/json", {
      method: "POST",
      body: JSON.stringify({ dimension: "products", filters: {}, from: rango.from, to: rango.to }),
    }),
  ]);

  const avisos: string[] = [];
  let saldo: number | null = null;
  let pendiente: number | null = null;
  if (balance.status >= 200 && balance.status < 300 && balance.json && typeof balance.json === "object") {
    const rec = balance.json as Record<string, unknown>;
    saldo = numero(rec.balance);
    pendiente = numero(rec.pending_balance);
  } else {
    avisos.push(mensaje(balance.status, balance.json));
  }

  let gastoMes: number | null = null;
  if (coste.status >= 200 && coste.status < 300) {
    gastoMes = sumarCoste(coste.json);
  } else {
    avisos.push(mensaje(coste.status, coste.json));
  }

  return {
    saldo,
    pendiente,
    gastoMes,
    mes: rango.etiqueta,
    aviso: [...new Set(avisos)].join(" ") || null,
  };
}

function numero(valor: unknown): number | null {
  const n = typeof valor === "number" ? valor : typeof valor === "string" ? Number(valor) : NaN;
  return Number.isFinite(n) ? n : null;
}

async function pedir(token: string, url: string, init?: RequestInit): Promise<{ status: number; json: unknown }> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
  });
  const texto = await res.text();
  let json: unknown = {};
  if (texto) {
    try {
      json = JSON.parse(texto) as unknown;
    } catch {
      json = texto;
    }
  }
  return { status: res.status, json };
}

function mensaje(status: number, cuerpo: unknown): string {
  const texto = texto(cuerpo);
  if (/inactive/i.test(texto)) {
    return "La cuenta de Bright Data está inactiva. El contador volverá cuando recargues saldo.";
  }
  return texto || `Bright Data ha respondido ${status}.`;
}

function texto(valor: unknown): string {
  if (valor == null) return "";
  if (typeof valor === "string") return valor;
  if (Array.isArray(valor)) return valor.map(texto).filter(Boolean).join("; ");
  if (typeof valor === "object") {
    const rec = valor as Record<string, unknown>;
    const directo = rec.message ?? rec.error ?? rec.detail ?? rec.reason;
    if (directo != null && directo !== valor) return texto(directo);
  }
  return "";
}
