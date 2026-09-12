/**
 * URL de Google Maps derivada solo de la dirección oficial persistida.
 * No geocodifica, no llama a Google, no inventa campos.
 */
import { numeroSecundarioOficial } from "../search-ui";

export type FincaParaMaps = {
  address: {
    sigla?: string | null;
    via?: string | null;
    numero?: string | null;
    numero2?: string | null;
    literal?: string | null;
    municipio?: string | null;
    provincia?: string | null;
  };
  postalCode?: string | null;
  postalCodes?: string[];
};

const MAPS_SEARCH = "https://www.google.com/maps/search/?api=1&query=";

function numeroOficialMaps(finca: FincaParaMaps): string {
  const numero = finca.address.numero?.trim() ?? "";
  if (!numero) return "";
  return `${numero}${numeroSecundarioOficial(finca)}`;
}

function viaOficialMaps(finca: FincaParaMaps): string {
  return [finca.address.sigla?.trim(), finca.address.via?.trim(), numeroOficialMaps(finca)]
    .filter(Boolean)
    .join(" ");
}

function localidadOficialMaps(finca: FincaParaMaps): string {
  const cp = finca.postalCode?.trim() || finca.postalCodes?.find((item) => item.trim()) || "";
  return [cp, finca.address.municipio?.trim(), finca.address.provincia?.trim()]
    .filter(Boolean)
    .join(" ");
}

/** Consulta de Maps: vía oficial + localidad, o literal oficial si no hay vía. */
export function consultaGoogleMaps(finca: FincaParaMaps): string | null {
  const via = viaOficialMaps(finca);
  const localidad = localidadOficialMaps(finca);
  const literal = finca.address.literal?.trim() ?? "";
  if (via && localidad) return `${via}, ${localidad}`;
  if (literal && localidad) return `${literal}, ${localidad}`;
  if (via) return via;
  if (literal) return literal;
  if (localidad) return localidad;
  return null;
}

export function crearGoogleMapsUrl(finca: FincaParaMaps): string | null {
  const consulta = consultaGoogleMaps(finca);
  if (!consulta) return null;
  return `${MAPS_SEARCH}${encodeURIComponent(consulta)}`;
}
