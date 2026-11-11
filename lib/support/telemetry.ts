"use client";

import type { SupportContextSnapshot, SupportTelemetryEvent } from "./types";

const MAX_EVENTS = 15;
let inicializado = false;
const buffer: SupportTelemetryEvent[] = [];

function redactarTextoSensible(texto: string): string {
  return texto
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .replace(/apikey=[^&\s]+/gi, "apikey=[REDACTED]")
    .replace(/token=[^&\s]+/gi, "token=[REDACTED]")
    .replace(/password=[^&\s]+/gi, "password=[REDACTED]")
    .slice(0, 260);
}

function limpiarRutaUrl(input: string): string {
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "https://localhost";
    const u = new URL(input, base);
    return u.pathname;
  } catch {
    return input.split("?")[0]?.slice(0, 140) ?? "";
  }
}

function registrarEvento(ev: SupportTelemetryEvent) {
  buffer.push(ev);
  if (buffer.length > MAX_EVENTS) {
    buffer.splice(0, buffer.length - MAX_EVENTS);
  }
}

export function initSupportTelemetry(): void {
  if (typeof window === "undefined" || inicializado) return;
  inicializado = true;

  window.addEventListener("error", (ev) => {
    const msg = ev.message || String(ev.error ?? "Error JS");
    registrarEvento({
      tipo: "error_js",
      resumen: redactarTextoSensible(msg),
      ruta: window.location.pathname,
      en: new Date().toISOString(),
    });
  });

  window.addEventListener("unhandledrejection", (ev) => {
    const reason =
      ev.reason instanceof Error
        ? ev.reason.message
        : typeof ev.reason === "string"
          ? ev.reason
          : "Promesa rechazada";
    registrarEvento({
      tipo: "promesa",
      resumen: redactarTextoSensible(reason),
      ruta: window.location.pathname,
      en: new Date().toISOString(),
    });
  });

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const metodo = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const ruta = limpiarRutaUrl(rawUrl);

    try {
      const res = await originalFetch(input, init);
      if (res.status >= 400 && !ruta.startsWith("/api/support")) {
        registrarEvento({
          tipo: "red",
          metodo,
          ruta,
          status: res.status,
          resumen: `${metodo} ${ruta} -> HTTP ${res.status}`,
          en: new Date().toISOString(),
        });
      }
      return res;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      if (!ruta.startsWith("/api/support")) {
        registrarEvento({
          tipo: "red",
          metodo,
          ruta,
          resumen: `${metodo} ${ruta} -> fallo de red`,
          en: new Date().toISOString(),
        });
      }
      throw err;
    }
  };
}

export function capturarSnapshotContexto(permisosActivos?: string[]): SupportContextSnapshot {
  if (typeof window === "undefined") {
    return { pathname: "/", eventos: [] };
  }
  return {
    pathname: `${window.location.pathname}${window.location.search ? "" : ""}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    userAgent: navigator.userAgent.slice(0, 180),
    permisosActivos,
    eventos: [...buffer],
  };
}
