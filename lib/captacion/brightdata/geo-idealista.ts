/** Coordenadas aproximadas embebidas en listados/fichas Idealista (staticmap center=). */

export type GeoIdealista = { latitude: number; longitude: number };

function parseCenter(url: string): GeoIdealista | null {
  const m = url.match(/center=(-?\d+(?:\.\d+)?)(?:%2C|,)(-?\d+(?:\.\d+)?)/i);
  if (!m) return null;
  const latitude = Number(m[1]);
  const longitude = Number(m[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

/** Mapa adId → coords desde `listingMultimediaCarrousels` del listado. */
export function coordsListadoIdealista(html: string): Map<string, GeoIdealista> {
  const out = new Map<string, GeoIdealista>();
  const idx = html.indexOf("listingMultimediaCarrousels:");
  if (idx < 0) return out;
  const start = html.indexOf("{", idx);
  if (start < 0) return out;
  let depth = 0;
  let end = -1;
  for (let i = start; i < html.length; i += 1) {
    const c = html[i];
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end < 0) return out;
  const bloque = html.slice(start, end);
  for (const match of bloque.matchAll(/"(\d{5,})"\s*:\s*\{[\s\S]*?"map"\s*:\s*\{\s*"src"\s*:\s*"([^"]+)"/g)) {
    const geo = parseCenter(match[2] ?? "");
    if (geo) out.set(match[1]!, geo);
  }
  return out;
}

/** Coordenadas en ficha: `mapConfig` o staticmap en carrusel. */
export function coordsFichaIdealista(html: string): GeoIdealista | null {
  const mapCfg = html.match(/mapConfig\s*=\s*\{[\s\S]*?latitude\s*:\s*'([^']*)'[\s\S]*?longitude\s*:\s*'([^']*)'/);
  if (mapCfg) {
    const latitude = Number(mapCfg[1]);
    const longitude = Number(mapCfg[2]);
    if (Number.isFinite(latitude) && Number.isFinite(longitude) && (latitude !== 0 || longitude !== 0)) {
      return { latitude, longitude };
    }
  }
  const staticMap = html.match(/staticmap\?[^"']*center=(-?\d+(?:\.\d+)?)(?:%2C|,)(-?\d+(?:\.\d+)?)/i);
  if (staticMap) {
    const latitude = Number(staticMap[1]);
    const longitude = Number(staticMap[2]);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) return { latitude, longitude };
  }
  return null;
}
