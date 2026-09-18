import { normalizarTelefono } from "../../../../lib/captacion/pipeline/normalize.js";
import { extraerInitialProps } from "../shared/extract-json.js";
import { caracteristicasDesdeAttributes, caracteristicasDesdeTags, mergeCaracteristicas } from "./caracteristicas.js";

function buscarPhone(obj: unknown): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const rec = obj as Record<string, unknown>;
  for (const key of ["phone1", "phone", "contactPhone", "telefono"]) {
    const v = rec[key];
    if (typeof v === "string" && v.trim()) {
      const e164 = normalizarTelefono(v);
      if (e164) return e164;
    }
  }
  for (const v of Object.values(rec)) {
    if (v && typeof v === "object") {
      const found = buscarPhone(v);
      if (found) return found;
    }
  }
  return undefined;
}

function buscarNombre(obj: unknown): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const rec = obj as Record<string, unknown>;
  for (const key of ["userName", "sellerName", "contactName", "name"]) {
    const v = rec[key];
    if (typeof v === "string" && v.trim() && !v.includes("http")) return v.trim();
  }
  for (const v of Object.values(rec)) {
    if (v && typeof v === "object") {
      const found = buscarNombre(v);
      if (found) return found;
    }
  }
  return undefined;
}

type AdDetalle = {
  tags?: Array<{ type?: string; text?: string }>;
  attributes?: Array<{ type?: string; value?: string; valueFormatted?: string }>;
  location?: { geolocation?: { latitude?: number; longitude?: number } };
  author?: { userName?: string };
};

export function parseDetailMilanunciosHtml(body: string): {
  contacto_telefono?: string;
  contacto_nombre?: string;
  superficie?: number;
  habitaciones?: number;
  banos?: number;
  planta?: string;
  lat?: number;
  lng?: number;
  geo_aproximada?: boolean;
} {
  const props = extraerInitialProps(body) as { ad?: AdDetalle } | null;
  const ad = props?.ad;
  const tel = buscarPhone(props);
  const nombre = buscarNombre(ad?.author ?? props);
  const car = mergeCaracteristicas(
    caracteristicasDesdeTags(ad?.tags),
    caracteristicasDesdeAttributes(ad?.attributes)
  );
  const geo = ad?.location?.geolocation;
  return {
    ...(tel ? { contacto_telefono: tel } : {}),
    ...(nombre ? { contacto_nombre: nombre } : {}),
    ...(car.superficie != null ? { superficie: car.superficie } : {}),
    ...(car.habitaciones != null ? { habitaciones: car.habitaciones } : {}),
    ...(car.banos != null ? { banos: car.banos } : {}),
    ...(car.planta ? { planta: car.planta } : {}),
    ...(geo?.latitude != null ? { lat: geo.latitude, lng: geo.longitude, geo_aproximada: true } : {}),
  };
}
