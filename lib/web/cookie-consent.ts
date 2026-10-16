export const COOKIE_CONSENT_NAME = "rh_cookie_consent";
export const COOKIE_CONSENT_MAX_AGE = 60 * 60 * 24 * 365;

export type CategoriaCookie = "necessary" | "preferences" | "analytics" | "marketing";

export type ConsentimientoCookies = {
  v: 1;
  necessary: true;
  preferences: boolean;
  analytics: boolean;
  marketing: boolean;
  ts: number;
};

export const CONSENTIMIENTO_SOLO_NECESARIAS: ConsentimientoCookies = {
  v: 1,
  necessary: true,
  preferences: false,
  analytics: false,
  marketing: false,
  ts: 0,
};

export const CONSENTIMIENTO_TODAS: ConsentimientoCookies = {
  v: 1,
  necessary: true,
  preferences: true,
  analytics: true,
  marketing: true,
  ts: 0,
};

function normalizarConsentimiento(data: ConsentimientoCookies | null): ConsentimientoCookies | null {
  if (data?.v !== 1 || data.necessary !== true) return null;
  return {
    v: 1,
    necessary: true,
    preferences: Boolean(data.preferences),
    analytics: Boolean(data.analytics),
    marketing: Boolean(data.marketing),
    ts: typeof data.ts === "number" ? data.ts : 0,
  };
}

export function parseConsentimiento(raw: string | null | undefined): ConsentimientoCookies | null {
  if (!raw) return null;
  try {
    return normalizarConsentimiento(JSON.parse(raw) as ConsentimientoCookies);
  } catch {
    try {
      return normalizarConsentimiento(JSON.parse(decodeURIComponent(raw)) as ConsentimientoCookies);
    } catch {
      return null;
    }
  }
}

export function serializarConsentimiento(c: Omit<ConsentimientoCookies, "ts"> & { ts?: number }): string {
  const payload: ConsentimientoCookies = {
    ...c,
    necessary: true,
    ts: c.ts ?? Date.now(),
  };
  return encodeURIComponent(JSON.stringify(payload));
}

export function etiquetaCategoria(cat: CategoriaCookie): string {
  switch (cat) {
    case "necessary":
      return "Necesarias";
    case "preferences":
      return "Preferencias";
    case "analytics":
      return "Analíticas";
    case "marketing":
      return "Marketing";
  }
}

export function descripcionCategoria(cat: CategoriaCookie): string {
  switch (cat) {
    case "necessary":
      return "Imprescindibles para el funcionamiento básico y recordar tu elección de cookies.";
    case "preferences":
      return "Recuerdan opciones de navegación para personalizar tu experiencia.";
    case "analytics":
      return "Nos permiten medir el uso del sitio de forma agregada y anónima.";
    case "marketing":
      return "Relacionadas con publicidad o redes cuando estén activas.";
  }
}
