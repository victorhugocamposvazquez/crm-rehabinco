type LdResidence = {
  "@type"?: string;
  "@id"?: string;
  url?: string;
  name?: string;
  description?: string;
  image?: string;
  address?: { addressLocality?: string; addressRegion?: string; streetAddress?: string };
  geo?: { latitude?: string | number; longitude?: string | number };
};

export type PisosMeta = {
  id: string;
  url?: string;
  titulo?: string;
  descripcion?: string;
  precio?: number;
  municipio?: string;
  provincia?: string;
  lat?: number;
  lng?: number;
  fotos?: string[];
  tipo?: string;
};

function parseCoord(v: string | number | undefined): number | undefined {
  if (v == null) return undefined;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

function tipoDesdeUrl(path: string): string {
  const m = path.match(/\/(?:comprar|alquilar)\/([a-z_]+)-/i);
  const raw = m?.[1]?.replace(/_/g, " ") ?? "piso";
  if (raw.includes("atico")) return "atico";
  if (raw.includes("casa") || raw.includes("chalet")) return "casa";
  if (raw.includes("local")) return "local";
  if (raw.includes("garaje")) return "garaje";
  return "piso";
}

function ldBlocks(html: string): LdResidence[] {
  const out: LdResidence[] = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const j = JSON.parse(m[1]) as LdResidence;
      const t = j["@type"];
      if (t === "SingleFamilyResidence" || t === "Apartment" || t === "House") out.push(j);
    } catch {
      /* ignore */
    }
  }
  return out;
}

function metaHtml(html: string): Map<string, Partial<PisosMeta>> {
  const map = new Map<string, Partial<PisosMeta>>();
  for (const m of html.matchAll(
    /<div id="(\d+\.\d+)"[^>]*data-lnk-href="([^"]+)"[\s\S]*?(?=<div id="\d+\.\d+"|<div class="pagination|$)/g
  )) {
    const id = m[1];
    const block = m[0];
    const href = m[2];
    const precioRaw = block.match(/ad-preview__price[^>]*>\s*([\d.]+)/)?.[1];
    const titulo = block.match(/ad-preview__title[^>]*>([^<]+)/)?.[1]?.trim();
    const desc = block.match(/ad-preview__description[^>]*>([\s\S]*?)<\/p>/)?.[1];
    map.set(id, {
      url: href.startsWith("http") ? href : `https://www.pisos.com${href}`,
      titulo,
      precio: precioRaw ? Number(precioRaw.replace(/\./g, "")) : undefined,
      descripcion: desc ? desc.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : undefined,
    });
  }
  return map;
}

export function listadoPisosDesdeHtml(html: string): { items: PisosMeta[]; totalResultados: number } {
  const meta = metaHtml(html);
  const items: PisosMeta[] = [];
  for (const ld of ldBlocks(html)) {
    const id = ld["@id"];
    if (!id) continue;
    const extra = meta.get(id) ?? {};
    const path = ld.url ?? extra.url ?? "";
    const img = ld.image ?? ld.photo?.contentUrl;
    items.push({
      id,
      url: extra.url ?? (path.startsWith("http") ? path : path ? `https://www.pisos.com${path}` : undefined),
      titulo: extra.titulo ?? (ld.name?.trim() || undefined),
      descripcion: extra.descripcion ?? (ld.description?.trim() || undefined),
      precio: extra.precio,
      municipio: ld.address?.addressLocality ?? extra.municipio,
      provincia: ld.address?.addressRegion,
      lat: parseCoord(ld.geo?.latitude),
      lng: parseCoord(ld.geo?.longitude),
      fotos: img ? [img.startsWith("http") ? img : `https:${img}`] : undefined,
      tipo: path ? tipoDesdeUrl(path) : "piso",
    });
  }
  const totalMatch = html.match(/(\d+)\s+resultados/i);
  const totalResultados = totalMatch ? Number(totalMatch[1]) : items.length;
  return { items, totalResultados };
}
