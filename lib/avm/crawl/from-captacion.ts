import type { SupabaseClient } from "@supabase/supabase-js";
import { plantaDesdeTexto, pistaEstado, slugZona, type MarketListingCard, type PortalMercado, type TipoPrincipal } from "../market/card";
import { guardarTarjetas } from "./upsert";

/** Por defecto apagado. No genera peticiones: solo vuelca tarjetas que captación ya tiene. */
export function ingestaDesdeCaptacionActiva(): boolean {
  return process.env.AVM_INGEST_FROM_CAPTACION === "true";
}

export type TarjetaYaDescargada = {
  portal: string;
  portalId: string;
  url: string | null;
  title: string | null;
  operation: "venta" | "alquiler";
  propertyType: string | null;
  agency: boolean | null;
  price: number | null;
  surface: number | null;
  rooms: number | null;
  bathrooms: number | null;
  floor: string | null;
  zone: string | null;
  postcode: string | null;
  lat: number | null;
  lng: number | null;
  municipality: string | null;
  geoAproximada: boolean;
};

const PORTALES = new Set<PortalMercado>(["fotocasa", "habitaclia", "pisos", "idealista"]);

function portalDe(valor: string): PortalMercado | null {
  if (valor === "pisos.com") return "pisos";
  return PORTALES.has(valor as PortalMercado) ? (valor as PortalMercado) : null;
}

function municipioDe(nombre: string | null): string | null {
  const t = (nombre ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  if (/^a coruna( capital)?$/.test(t)) return "15030";
  return null;
}

function tipoDe(valor: string | null): TipoPrincipal | null {
  const t = (valor ?? "").toLowerCase();
  if (t === "piso" || t === "apartment" || t === "flat") return "apartment";
  if (t === "casa" || t === "house" || t === "chalet") return "house";
  return null;
}

export function tarjetaDesdeCaptacion(origen: TarjetaYaDescargada): MarketListingCard | null {
  const portal = portalDe(origen.portal);
  const mainType = tipoDe(origen.propertyType);
  if (!portal || !mainType || origen.price == null || origen.price <= 0 || !origen.portalId) return null;
  const coords = !origen.geoAproximada && origen.lat != null && origen.lng != null;
  return {
    portal,
    portalId: origen.portalId,
    url: origen.url,
    operation: origen.operation === "alquiler" ? "rent" : "sale",
    mainType,
    propertyType: origen.propertyType,
    title: origen.title,
    price: origen.price,
    surface: origen.surface,
    rooms: origen.rooms,
    bathrooms: origen.bathrooms,
    floor: plantaDesdeTexto(origen.floor),
    hasElevator: null,
    isExterior: null,
    hasGarage: null,
    hasTerrace: null,
    conditionHint: pistaEstado(origen.title),
    isAgency: origen.agency,
    zoneSlug: slugZona(origen.zone),
    lat: coords ? origen.lat : null,
    lng: coords ? origen.lng : null,
    locationPrecision: coords ? "exact" : null,
    postcode: origen.postcode,
    municipalityCode: municipioDe(origen.municipality),
  };
}

export async function volcarTarjetaCaptacion(db: SupabaseClient, origen: TarjetaYaDescargada, hoy = new Date().toISOString().slice(0, 10)): Promise<void> {
  if (!ingestaDesdeCaptacionActiva()) return;
  const card = tarjetaDesdeCaptacion(origen);
  if (!card) return;
  await guardarTarjetas(db, [card], hoy);
}
