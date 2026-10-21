export const HOST_CRM = "crm.rehabinco.es";

export type DecisionHost =
  | { tipo: "crm" }
  | { tipo: "reescribir"; pathname: string }
  | { tipo: "canonical"; pathname: string }
  | { tipo: "al-crm"; pathname: string };

export function hostDe(valor: string | null | undefined): string {
  return (valor ?? "").split(",")[0]?.trim().split(":")[0]?.trim().toLowerCase().replace(/\.$/, "") ?? "";
}

export function esHostCrm(host: string): boolean {
  return (
    host === HOST_CRM ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".vercel.app") ||
    host.endsWith(".localhost")
  );
}

/** Dominio sin protocolo ni ruta. Null si no es un nombre válido o es el del CRM. */
export function normalizarDominio(valor: string): string | null {
  let texto = valor.trim().toLowerCase();
  texto = texto.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "");
  if (!texto || texto.includes(":") || texto.includes(" ")) return null;
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(texto)) return null;
  if (esHostCrm(texto)) return null;
  return texto;
}

export function dominioParaGuardar(valor: string): { ok: true; dominio: string | null } | { ok: false; error: string } {
  if (!valor.trim()) return { ok: true, dominio: null };
  const dominio = normalizarDominio(valor);
  if (!dominio) return { ok: false, error: "Escribe un dominio como web.rehabinco.es, sin https. El CRM se queda en crm.rehabinco.es." };
  return { ok: true, dominio };
}

export function decisionHost(host: string, pathname: string, dominio: string | null): DecisionHost {
  if (!dominio || esHostCrm(host) || host !== dominio) return { tipo: "crm" };
  if (pathname === "/web" || pathname === "/web/") return { tipo: "canonical", pathname: "/" };
  if (pathname === "/web/inmuebles" || pathname.startsWith("/web/inmuebles/")) {
    return { tipo: "canonical", pathname: pathname.slice("/web".length) };
  }
  if (pathname === "/web/aviso-legal" || pathname === "/web/politica-cookies" || pathname === "/web/politica-privacidad") {
    return { tipo: "canonical", pathname: pathname.slice("/web".length) };
  }
  if (pathname === "/" || pathname === "") return { tipo: "reescribir", pathname: "/web" };
  if (pathname === "/inmuebles" || pathname.startsWith("/inmuebles/")) {
    return { tipo: "reescribir", pathname: `/web${pathname}` };
  }
  if (pathname === "/aviso-legal" || pathname === "/politica-cookies" || pathname === "/politica-privacidad") {
    return { tipo: "reescribir", pathname: `/web${pathname}` };
  }
  if (pathname === "/api" || pathname.startsWith("/api/")) return { tipo: "crm" };
  return { tipo: "al-crm", pathname };
}

export function prefijoSitio(enDominio: boolean): "" | "/web" {
  return enDominio ? "" : "/web";
}

export function hrefInicio(enDominio: boolean): string {
  return enDominio ? "/" : "/web";
}

export function hrefInmueble(enDominio: boolean, referencia: string): string {
  const ref = encodeURIComponent(referencia);
  return enDominio ? `/inmuebles/${ref}` : `/web/inmuebles/${ref}`;
}

export function hrefInmuebles(enDominio: boolean, modo?: "venta" | "alquiler", q?: string): string {
  const base = enDominio ? "/inmuebles" : "/web/inmuebles";
  const params = new URLSearchParams();
  if (modo) params.set("modo", modo);
  if (q?.trim()) params.set("q", q.trim());
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function hrefAvisoLegal(enDominio: boolean): string {
  return enDominio ? "/aviso-legal" : "/web/aviso-legal";
}

export function hrefPoliticaCookies(enDominio: boolean): string {
  return enDominio ? "/politica-cookies" : "/web/politica-cookies";
}

export function hrefPoliticaPrivacidad(enDominio: boolean): string {
  return enDominio ? "/politica-privacidad" : "/web/politica-privacidad";
}
