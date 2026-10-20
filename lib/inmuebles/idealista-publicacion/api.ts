const TOKEN_URL = "https://api.idealista.com/oauth/token";

export function rutasPublicacionIdealista(baseUrl: string) {
  const base = baseUrl.replace(/\/$/, "");
  return {
    crear: `${base}/properties`,
    actualizar: (id: string) => `${base}/properties/${encodeURIComponent(id)}`,
    desactivar: (id: string) => `${base}/properties/${encodeURIComponent(id)}/deactivate`,
  };
}

export async function tokenPublicacionIdealista(clientId: string, clientSecret: string): Promise<string> {
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const texto = await res.text();
  if (!res.ok) {
    throw new Error(mensajeIdealista(res.status, texto) || `Idealista no ha aceptado las credenciales (${res.status}).`);
  }
  let json: { access_token?: string } = {};
  try {
    json = JSON.parse(texto) as { access_token?: string };
  } catch {
    throw new Error("Idealista no ha devuelto un token.");
  }
  if (!json.access_token) throw new Error("Idealista no ha devuelto un token.");
  return json.access_token;
}

function mensajeIdealista(status: number, texto: string): string {
  const recorte = texto.replace(/\s+/g, " ").trim().slice(0, 280);
  if (!recorte) return "";
  try {
    const json = JSON.parse(texto) as { error_description?: string; message?: string; error?: string };
    const msg = json.error_description || json.message || json.error;
    if (msg) return String(msg).slice(0, 280);
  } catch {
    // cuerpo no JSON
  }
  return `${status}: ${recorte}`;
}

async function llamar(
  url: string,
  method: "POST" | "PUT",
  token: string,
  body: unknown
): Promise<{ ok: true; json: unknown } | { ok: false; error: string }> {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const texto = await res.text();
  if (!res.ok) {
    return { ok: false, error: mensajeIdealista(res.status, texto) || `Idealista ha respondido ${res.status}.` };
  }
  if (!texto.trim()) return { ok: true, json: null };
  try {
    return { ok: true, json: JSON.parse(texto) as unknown };
  } catch {
    return { ok: true, json: null };
  }
}

export function idAnuncioIdealista(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const directo = o.propertyId ?? o.id ?? o.propertyCode;
  if (directo != null && String(directo).trim()) return String(directo).trim();
  const anidado = o.property;
  if (anidado && typeof anidado === "object") {
    const p = anidado as Record<string, unknown>;
    const id = p.propertyId ?? p.id ?? p.propertyCode;
    if (id != null && String(id).trim()) return String(id).trim();
  }
  return null;
}

export async function publicarAnuncioIdealista(opts: {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  feedKey: string;
  anuncio: Record<string, unknown>;
  anuncioId?: string | null;
}): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  let token: string;
  try {
    token = await tokenPublicacionIdealista(opts.clientId, opts.clientSecret);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se ha podido autenticar con Idealista." };
  }
  const rutas = rutasPublicacionIdealista(opts.baseUrl);
  const cuerpo = { feedKey: opts.feedKey, property: opts.anuncio };
  const idPrevio = opts.anuncioId?.trim();
  const respuesta = idPrevio
    ? await llamar(rutas.actualizar(idPrevio), "PUT", token, cuerpo)
    : await llamar(rutas.crear, "POST", token, cuerpo);
  if (!respuesta.ok) return respuesta;
  return { ok: true, id: idAnuncioIdealista(respuesta.json) ?? idPrevio ?? null };
}

export async function desactivarAnuncioIdealista(opts: {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  feedKey: string;
  anuncioId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  let token: string;
  try {
    token = await tokenPublicacionIdealista(opts.clientId, opts.clientSecret);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se ha podido autenticar con Idealista." };
  }
  const rutas = rutasPublicacionIdealista(opts.baseUrl);
  const respuesta = await llamar(rutas.desactivar(opts.anuncioId), "POST", token, { feedKey: opts.feedKey });
  if (!respuesta.ok) return respuesta;
  return { ok: true };
}
