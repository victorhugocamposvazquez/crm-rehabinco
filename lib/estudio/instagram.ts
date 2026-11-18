/** Publicación en Instagram. Lo que no habla con la red va aquí, para poder probarlo. */
import type { FormatId } from "./config";

export const INSTAGRAM_GRAPH = "https://graph.instagram.com/v21.0";

export function repartoInstagram(formatos: FormatId[]) {
  const orden: FormatId[] = ["post", "feed", "fb", "reel", "story"];
  const elegidos = orden.filter((f) => formatos.includes(f));
  const vertical = (f: FormatId) => f === "story" || f === "reel";
  return {
    feed: elegidos.filter((f) => !vertical(f)),
    historia: elegidos.filter(vertical),
  };
}

/** Texto del post a partir de lo que se ve en la pieza. Sin campos ocultos. */
export function textoInstagram(datos: {
  titulo: string;
  zona: string;
  precio: string;
  tel: string;
  tituloVisible: boolean;
  zonaVisible: boolean;
  precioVisible: boolean;
  telVisible: boolean;
}) {
  return [
    datos.tituloVisible ? datos.titulo.trim() : "",
    datos.zonaVisible ? datos.zona.trim() : "",
    datos.precioVisible ? datos.precio.trim() : "",
    datos.telVisible ? datos.tel.trim() : "",
  ].filter(Boolean).join("\n");
}

export function instagramConfigurado() {
  return Boolean(process.env.INSTAGRAM_APP_ID?.trim() && process.env.INSTAGRAM_APP_SECRET?.trim());
}

export function urlAutorizacionInstagram(origen: string, state: string) {
  const params = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID!.trim(),
    redirect_uri: `${origen}/api/estudio/instagram/callback`,
    response_type: "code",
    scope: "instagram_business_basic,instagram_business_content_publish",
    state,
  });
  return `https://www.instagram.com/oauth/authorize?${params}`;
}
