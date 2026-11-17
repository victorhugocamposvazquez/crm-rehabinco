import { createAdminClient } from "@/lib/supabase/admin";
import { INSTAGRAM_GRAPH } from "./instagram";

type Cuenta = { ig_user_id: string; username: string; access_token: string; expires_at: string };

const FILA = "cuenta";

export async function leerCuentaInstagram(): Promise<Cuenta | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("instagram_conexion").select("ig_user_id, username, access_token, expires_at").eq("id", FILA).maybeSingle();
  if (!data?.access_token || !data.ig_user_id) return null;
  return data as Cuenta;
}

export async function guardarCuentaInstagram(cuenta: Cuenta) {
  const admin = createAdminClient();
  const { error } = await admin.from("instagram_conexion").upsert({ id: FILA, ...cuenta, updated_at: new Date().toISOString() });
  if (error) throw new Error("No se ha podido guardar la conexión con Instagram.");
}

export async function borrarCuentaInstagram() {
  const admin = createAdminClient();
  await admin.from("instagram_conexion").delete().eq("id", FILA);
}

async function jsonInstagram(url: string, init?: RequestInit) {
  const respuesta = await fetch(url, init);
  const cuerpo = await respuesta.json().catch(() => ({})) as { error?: { message?: string }; id?: string; access_token?: string; expires_in?: number; user_id?: string; username?: string; status_code?: string; data?: { access_token?: string; user_id?: string }[] };
  if (!respuesta.ok) throw new Error(cuerpo.error?.message || "Instagram no ha respondido.");
  return cuerpo;
}

export async function canjearCodigoInstagram(code: string, redirectUri: string) {
  const respuesta = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.INSTAGRAM_APP_ID!.trim(),
      client_secret: process.env.INSTAGRAM_APP_SECRET!.trim(),
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    }),
  });
  const cuerpo = await respuesta.json().catch(() => ({})) as { access_token?: string; user_id?: string | number; data?: { access_token?: string; user_id?: string | number }[]; error_message?: string };
  const primero = cuerpo.data?.[0];
  const token = cuerpo.access_token || primero?.access_token;
  if (!respuesta.ok || !token) throw new Error(cuerpo.error_message || "Instagram no ha aceptado el enlace.");
  return token;
}

export async function cambiarPorTokenLargo(corto: string) {
  const secreto = process.env.INSTAGRAM_APP_SECRET!.trim();
  const largo = await jsonInstagram(`https://graph.instagram.com/access_token?${new URLSearchParams({ grant_type: "ig_exchange_token", client_secret: secreto, access_token: corto })}`);
  if (!largo.access_token) throw new Error("Instagram no ha dado un token de larga duración.");
  return { token: largo.access_token, expiresIn: largo.expires_in ?? 60 * 24 * 3600 };
}

export async function refrescarSiHaceFalta(cuenta: Cuenta): Promise<Cuenta> {
  const queda = new Date(cuenta.expires_at).getTime() - Date.now();
  if (queda > 7 * 24 * 3600 * 1000) return cuenta;
  const largo = await jsonInstagram(`https://graph.instagram.com/refresh_access_token?${new URLSearchParams({ grant_type: "ig_refresh_token", access_token: cuenta.access_token })}`);
  if (!largo.access_token) return cuenta;
  const siguiente = { ...cuenta, access_token: largo.access_token, expires_at: new Date(Date.now() + (largo.expires_in ?? 60 * 24 * 3600) * 1000).toISOString() };
  await guardarCuentaInstagram(siguiente);
  return siguiente;
}

export async function perfilInstagram(token: string) {
  const perfil = await jsonInstagram(`${INSTAGRAM_GRAPH}/me?${new URLSearchParams({ fields: "user_id,username", access_token: token })}`);
  const id = perfil.user_id || perfil.id;
  if (!id) throw new Error("Instagram no ha dicho qué cuenta es.");
  return { igUserId: String(id), username: perfil.username || "instagram" };
}

async function crearMedio(igUserId: string, token: string, campos: Record<string, string>) {
  const creado = await jsonInstagram(`${INSTAGRAM_GRAPH}/${igUserId}/media`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...campos, access_token: token }),
  });
  if (!creado.id) throw new Error("Instagram no ha preparado la imagen.");
  return creado.id;
}

async function esperarMedio(token: string, id: string) {
  for (let i = 0; i < 8; i += 1) {
    const estado = await jsonInstagram(`${INSTAGRAM_GRAPH}/${id}?${new URLSearchParams({ fields: "status_code", access_token: token })}`);
    if (estado.status_code === "FINISHED") return;
    if (estado.status_code === "ERROR") throw new Error("Instagram ha rechazado la imagen.");
    await new Promise((resolver) => setTimeout(resolver, 1500));
  }
  throw new Error("Instagram está tardando demasiado en preparar la imagen.");
}

async function publicarMedio(igUserId: string, token: string, creationId: string) {
  const publicado = await jsonInstagram(`${INSTAGRAM_GRAPH}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ creation_id: creationId, access_token: token }),
  });
  if (!publicado.id) throw new Error("Instagram no ha publicado.");
  return publicado.id;
}

/** Una imagen, varias (carrusel) o una historia. Las URLs tienen que ser públicas. */
export async function publicarEnInstagram(cuenta: Cuenta, piezas: { feed: string[]; historia: string | null; texto: string }) {
  const { ig_user_id: igUserId, access_token: token } = cuenta;
  const ids: string[] = [];
  if (piezas.feed.length === 1) {
    const medio = await crearMedio(igUserId, token, { image_url: piezas.feed[0], caption: piezas.texto });
    await esperarMedio(token, medio);
    ids.push(await publicarMedio(igUserId, token, medio));
  } else if (piezas.feed.length > 1) {
    const hijos: string[] = [];
    for (const url of piezas.feed) {
      const hijo = await crearMedio(igUserId, token, { image_url: url, is_carousel_item: "true" });
      await esperarMedio(token, hijo);
      hijos.push(hijo);
    }
    const carrusel = await crearMedio(igUserId, token, { media_type: "CAROUSEL", children: hijos.join(","), caption: piezas.texto });
    await esperarMedio(token, carrusel);
    ids.push(await publicarMedio(igUserId, token, carrusel));
  }
  if (piezas.historia) {
    const historia = await crearMedio(igUserId, token, { image_url: piezas.historia, media_type: "STORIES" });
    await esperarMedio(token, historia);
    ids.push(await publicarMedio(igUserId, token, historia));
  }
  if (!ids.length) throw new Error("No hay ninguna imagen para publicar.");
  return ids;
}
