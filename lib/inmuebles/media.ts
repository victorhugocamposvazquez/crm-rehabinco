export const LIMITE_FOTO_BYTES = 8_000_000;
export const LIMITE_PLANO_BYTES = 12_000_000;
export const LIMITE_VIDEO_BYTES = 50_000_000;
export const PREFIJO_MEDIA_EXTERNA = "externo/";

export type TipoMediaInmueble = "foto" | "video" | "plano";

export type PresentacionMedia =
  | { kind: "iframe"; src: string; titulo: string }
  | { kind: "video"; src: string }
  | { kind: "link"; href: string };

export function esPathExterno(path: string | null | undefined): boolean {
  return Boolean(path?.startsWith(PREFIJO_MEDIA_EXTERNA));
}

export function limiteMedia(tipo: TipoMediaInmueble): number {
  if (tipo === "video") return LIMITE_VIDEO_BYTES;
  if (tipo === "plano") return LIMITE_PLANO_BYTES;
  return LIMITE_FOTO_BYTES;
}

export function validarArchivoMedia(tipo: TipoMediaInmueble, file: File): string | null {
  if (file.size > limiteMedia(tipo)) {
    const mb = Math.round(limiteMedia(tipo) / 1_000_000);
    return `${file.name} supera ${mb} MB.`;
  }
  const mime = file.type.toLowerCase();
  const nombre = file.name.toLowerCase();
  if (tipo === "foto") {
    if (!mime.startsWith("image/")) return `${file.name} no es una imagen.`;
    return null;
  }
  if (tipo === "video") {
    if (mime.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/.test(nombre)) return null;
    return `${file.name} no es un vídeo.`;
  }
  if (mime === "application/pdf" || nombre.endsWith(".pdf") || mime.startsWith("image/")) return null;
  return `${file.name} no es un plano (PDF o imagen).`;
}

export function acceptMedia(tipo: TipoMediaInmueble): string {
  if (tipo === "foto") return "image/*";
  if (tipo === "video") return "video/mp4,video/webm,video/quicktime";
  return "application/pdf,image/*";
}

function idYoutube(parsed: URL): string | null {
  const host = parsed.hostname.replace(/^www\./, "");
  if (host === "youtu.be") return parsed.pathname.replace(/^\//, "").split("/")[0] || null;
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    if (parsed.searchParams.get("v")) return parsed.searchParams.get("v");
    const partes = parsed.pathname.split("/").filter(Boolean);
    if (partes[0] === "embed" || partes[0] === "shorts" || partes[0] === "live") return partes[1] ?? null;
  }
  return null;
}

function idVimeo(parsed: URL): string | null {
  const host = parsed.hostname.replace(/^www\./, "");
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const partes = parsed.pathname.split("/").filter(Boolean);
    const id = partes[0] === "video" ? partes[1] : partes[0];
    return id && /^\d+$/.test(id) ? id : null;
  }
  return null;
}

export function presentacionDeUrl(url: string | null | undefined): PresentacionMedia | null {
  const cruda = url?.trim();
  if (!cruda) return null;
  let parsed: URL;
  try {
    parsed = new URL(cruda);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(parsed.protocol)) return { kind: "link", href: cruda };
  const host = parsed.hostname.replace(/^www\./, "");
  const yt = idYoutube(parsed);
  if (yt) {
    return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${yt}`, titulo: "Vídeo de YouTube" };
  }
  const vimeo = idVimeo(parsed);
  if (vimeo) {
    return { kind: "iframe", src: `https://player.vimeo.com/video/${vimeo}`, titulo: "Vídeo de Vimeo" };
  }
  if (host.endsWith("matterport.com")) {
    const codigo = parsed.searchParams.get("m");
    const src = codigo
      ? `https://my.matterport.com/show/?m=${encodeURIComponent(codigo)}&play=1`
      : cruda;
    return { kind: "iframe", src, titulo: "Tour 3D Matterport" };
  }
  if (host.endsWith("kuula.co")) {
    return { kind: "iframe", src: cruda, titulo: "Tour 3D Kuula" };
  }
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(parsed.pathname)) {
    return { kind: "video", src: cruda };
  }
  return { kind: "link", href: cruda };
}

function urlDeItemFoto(item: unknown): string | null {
  if (typeof item === "string") {
    const t = item.trim();
    return /^https?:\/\//i.test(t) ? t : null;
  }
  if (!item || typeof item !== "object") return null;
  const rec = item as Record<string, unknown>;
  for (const clave of ["url", "src", "thumbnail", "thumbnailRetina", "uri"]) {
    const v = rec[clave];
    if (typeof v === "string" && /^https?:\/\//i.test(v.trim())) return v.trim();
  }
  return null;
}

export function urlsDeFotosPortal(input: {
  thumb?: string | null;
  fotos?: unknown;
  raw?: Record<string, unknown> | null;
}): string[] {
  const vistas = new Set<string>();
  const add = (valor: string | null | undefined) => {
    const t = valor?.trim();
    if (t && /^https?:\/\//i.test(t)) vistas.add(t);
  };
  add(input.thumb);
  const raw = input.raw ?? {};
  add(typeof raw.thumbnail === "string" ? raw.thumbnail : null);
  add(typeof raw.thumbnailRetina === "string" ? raw.thumbnailRetina : null);
  const grupos = [input.fotos, raw.fotos, raw.multimedia, raw.images, raw.photos];
  for (const grupo of grupos) {
    if (!Array.isArray(grupo)) continue;
    for (const item of grupo) add(urlDeItemFoto(item));
  }
  return [...vistas];
}

export function payloadMediaExterna(input: {
  propiedadId: string;
  userId: string;
  url: string;
  tipo?: TipoMediaInmueble;
  orden: number;
  portada: boolean;
}) {
  return {
    propiedad_id: input.propiedadId,
    user_id: input.userId,
    tipo: input.tipo ?? "foto",
    path: `${PREFIJO_MEDIA_EXTERNA}${crypto.randomUUID()}`,
    url: input.url,
    orden: input.orden,
    portada: input.portada,
  };
}

export function moverMedia<T extends { id: string; orden: number }>(lista: T[], id: string, dir: -1 | 1): T[] | null {
  const ordenada = [...lista].sort((a, b) => a.orden - b.orden);
  const i = ordenada.findIndex((item) => item.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ordenada.length) return null;
  const copia = [...ordenada];
  const tmp = copia[i];
  copia[i] = copia[j];
  copia[j] = tmp;
  return copia.map((item, index) => ({ ...item, orden: index }));
}
