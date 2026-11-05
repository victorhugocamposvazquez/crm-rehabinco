const RUTA_API = "/api/media/marca";

/** Solo fotos del bucket del CRM. Evita usar el endpoint como proxy abierto. */
export function urlOrigenPermitida(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    if (!parsed.pathname.includes("/storage/v1/object/public/inmuebles/")) return false;
    const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    if (supabase) {
      try {
        if (parsed.host === new URL(supabase).host) return true;
      } catch {
        // sigue con el patrón genérico
      }
    }
    return parsed.host.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

export function yaTieneMarca(url: string): boolean {
  return url.includes(RUTA_API);
}

/**
 * URL pública con logo Rehabinco. Idealista y la web la usan;
 * el CRM sigue mostrando el original.
 */
export function urlFotoConMarca(url: string, siteUrl?: string): string {
  const limpia = url.trim();
  if (!limpia || yaTieneMarca(limpia) || !urlOrigenPermitida(limpia)) return limpia;
  const base = (siteUrl ?? "").replace(/\/$/, "");
  const q = encodeURIComponent(limpia);
  return base ? `${base}${RUTA_API}?u=${q}` : `${RUTA_API}?u=${q}`;
}

export function urlsFotosConMarca(urls: string[], siteUrl?: string): string[] {
  return urls.map((url) => urlFotoConMarca(url, siteUrl)).filter(Boolean);
}
