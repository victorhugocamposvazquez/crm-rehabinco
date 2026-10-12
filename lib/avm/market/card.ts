export type PortalRastreo = "fotocasa" | "habitaclia" | "pisos";
/** `idealista` solo entra por el volcado opcional de captación, nunca por el rastreador. */
export type PortalMercado = PortalRastreo | "idealista";
export type OperacionMercado = "sale" | "rent";
export type TipoPrincipal = "apartment" | "house";
export type PrecisionUbicacion = "exact" | "street" | "zone";

/** Tarjeta de listado. Sin teléfono, sin nombre y sin fotos. */
export type MarketListingCard = {
  portal: PortalMercado;
  portalId: string;
  url: string | null;
  operation: OperacionMercado;
  mainType: TipoPrincipal;
  propertyType: string | null;
  title: string | null;
  price: number;
  surface: number | null;
  rooms: number | null;
  bathrooms: number | null;
  floor: number | null;
  hasElevator: boolean | null;
  isExterior: boolean | null;
  hasGarage: boolean | null;
  hasTerrace: boolean | null;
  conditionHint: string | null;
  isAgency: boolean | null;
  zoneSlug: string | null;
  lat: number | null;
  lng: number | null;
  locationPrecision: PrecisionUbicacion | null;
  postcode: string | null;
  municipalityCode: string | null;
};

export function slugZona(nombre: string | null | undefined): string | null {
  if (!nombre?.trim()) return null;
  const s = nombre
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return s || null;
}

/** Pista de estado a partir del título o las etiquetas, no de un código opaco del portal. */
export function pistaEstado(texto: string | null | undefined): string | null {
  const t = (texto ?? "").toLowerCase();
  if (!t.trim()) return null;
  if (/a reformar|para reformar|para entrar a reformar/.test(t)) return "reformar";
  if (/obra nueva|a estrenar|\bnuev[oa]\b/.test(t)) return "nuevo";
  if (/buen estado|reformad/.test(t)) return "buen estado";
  return null;
}

export function plantaDesdeTexto(texto: string | null | undefined): number | null {
  if (!texto?.trim()) return null;
  const t = texto.toLowerCase();
  if (/\bbajo\b|planta baja|bajos/.test(t)) return 0;
  const n = t.match(/-?\d+/);
  if (!n) return null;
  const v = Number(n[0]);
  return v >= 0 && v <= 40 ? v : null;
}

export function exteriorDesdeTexto(texto: string | null | undefined): boolean | null {
  const t = (texto ?? "").toLowerCase();
  if (/sin ascensor/.test(t)) {
    /* no es exterior */
  }
  if (/\binterior\b/.test(t)) return false;
  if (/\bexterior\b/.test(t)) return true;
  return null;
}

export function ascensorDesdeTexto(texto: string | null | undefined): boolean | null {
  const t = (texto ?? "").toLowerCase();
  if (/sin ascensor/.test(t)) return false;
  if (/con ascensor|\bascensor\b/.test(t)) return true;
  return null;
}
