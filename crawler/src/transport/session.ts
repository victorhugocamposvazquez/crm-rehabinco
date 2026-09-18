const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

type SesionPortal = {
  userAgent: string;
  cookies: Map<string, string>;
};

const sesiones = new Map<string, SesionPortal>();

export function sesionPortal(portalId: string): SesionPortal {
  let s = sesiones.get(portalId);
  if (!s) {
    s = { userAgent: USER_AGENT, cookies: new Map() };
    sesiones.set(portalId, s);
  }
  return s;
}

export function cookieHeader(cookies: Map<string, string>): string | undefined {
  if (cookies.size === 0) return undefined;
  return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

export function actualizarCookies(cookies: Map<string, string>, setCookie: string | string[] | null): void {
  if (!setCookie) return;
  const lineas = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const linea of lineas) {
    const par = linea.split(";")[0]?.trim();
    if (!par) continue;
    const eq = par.indexOf("=");
    if (eq <= 0) continue;
    cookies.set(par.slice(0, eq), par.slice(eq + 1));
  }
}
