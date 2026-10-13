/**
 * Errores conocidos de OpenStreetMap que no deben volver a puntuar mal
 * cuando se recarga el mapa.
 *
 * La Dehesa de San Pablo es un mesón de jamón. OSM la marca como pub.
 * La excepción vale solo a 200 m de Juan Flórez: otro local con el mismo
 * nombre, en otra ciudad, sigue siendo pub.
 */
import type { EnvCategory } from "./ui/icons";

export type CorreccionOsm = {
  nombre: string;
  amenity: string;
  lat: number;
  lng: number;
  radioM: number;
  layer: string;
  category: EnvCategory;
  sense: "positive" | "negative" | "info";
  nota: string;
  amenityCorregido: string;
};

export const CORRECCIONES_OSM: CorreccionOsm[] = [
  {
    nombre: "La Dehesa",
    amenity: "pub",
    lat: 43.3654271,
    lng: -8.408791,
    radioM: 200,
    layer: "osm_poi",
    category: "hospitality",
    sense: "info",
    nota: "Mesón y jamonería en San Pablo. OSM lo marca como pub.",
    amenityCorregido: "restaurant",
  },
];

/** Una jamonería etiquetada como pub es una tienda, en cualquier ciudad. */
export function esJamoneria(nombre: string): boolean {
  return /jamoner[ií]a/i.test(nombre);
}

function metros(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = 6_371_000;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function correccionDeLugar(
  nombre: string | null | undefined,
  amenity: string | null | undefined,
  lat: number,
  lng: number,
): CorreccionOsm | null {
  const limpio = (nombre ?? "").trim();
  if (!limpio || !amenity) return null;
  return (
    CORRECCIONES_OSM.find(
      (c) =>
        c.amenity === amenity &&
        c.nombre.localeCompare(limpio, "es", { sensitivity: "accent" }) === 0 &&
        metros(lat, lng, c.lat, c.lng) <= c.radioM,
    ) ?? null
  );
}
