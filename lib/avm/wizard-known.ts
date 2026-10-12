import { ETIQUETA_MAIN_TYPE, ETIQUETA_PROPERTY_TYPE } from "./ui/labels";
import { EXTRAS_KEYS } from "./wizard-groups";
import type { Twin } from "./types";

const LBL: Partial<Record<keyof Twin, string>> = {
  mainType: "Tipo",
  propertyType: "Subtipo",
  builtSurface: "Superficie",
  floorOfFlat: "Planta",
  numberOfFloors: "Plantas",
  side: "Orientación",
  hasElevator: "Ascensor",
  constructionYear: "Año",
  landSurface: "Parcela",
  buildingCondition: "Estado",
  isRenovated: "Reformado",
  renovationYear: "Reforma",
  numberOfBedrooms: "Dormitorios",
  numberOfBathrooms: "Baños",
  numberOfIndoorParkings: "Garaje",
  numberOfOutdoorParkings: "Plazas ext.",
  hasBalcony: "Terraza",
  balconySurface: "Terraza",
  hasView: "Vistas",
  hasSwimmingPool: "Piscina",
  hasGarden: "Jardín",
  hasStorageRoom: "Trastero",
  hasFireplace: "Chimenea",
  relationship: "Relación",
  saleHorizon: "Venta",
};

export type FilaConocido = {
  key: string;
  label: string;
  value: string;
  source: string | null;
  unknown: boolean;
};

function fmtField(f: keyof Twin, v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (f === "mainType" && typeof v === "string") return ETIQUETA_MAIN_TYPE[v as NonNullable<Twin["mainType"]>] ?? String(v);
  if (f === "propertyType" && typeof v === "string")
    return ETIQUETA_PROPERTY_TYPE[v as NonNullable<Twin["propertyType"]>] ?? String(v);
  if (f === "builtSurface" || f === "landSurface" || f === "balconySurface") return `${v} m²`;
  if (f === "floorOfFlat") return Number(v) === 0 ? "Bajo" : `${v}ª`;
  if (f === "side") return v === "exterior" ? "Exterior" : "Interior";
  if (f === "buildingCondition") {
    return { 5: "Excelente", 4: "Bueno", 3: "Aceptable", 2: "Malo", 1: "Ruina" }[v as number] ?? String(v);
  }
  if (f === "numberOfIndoorParkings") return Number(v) === 0 ? "No" : `${v} plaza${Number(v) > 1 ? "s" : ""}`;
  if (typeof v === "boolean") return v ? "Sí" : "No";
  return String(v);
}

export function filasConocidas(
  twin: Twin,
  unknown: Set<string>,
  sources: Partial<Record<keyof Twin, string>>,
): FilaConocido[] {
  const rows: FilaConocido[] = [];
  if (twin.address.formattedAddress) {
    rows.push({
      key: "address",
      label: "Dirección",
      value: twin.address.formattedAddress.replace(", 15004 A Coruña", ""),
      source: null,
      unknown: false,
    });
  }
  if (twin.address.catastralRef) {
    rows.push({
      key: "catastralRef",
      label: "Ref. catastral",
      value: `…${twin.address.catastralRef.slice(-8)}`,
      source: null,
      unknown: false,
    });
  }
  for (const f of Object.keys(LBL) as (keyof Twin)[]) {
    if (f === "propertyType" && twin.propertyType === twin.mainType) continue;
    if (EXTRAS_KEYS.includes(f as (typeof EXTRAS_KEYS)[number]) && twin[f] !== true) continue;
    const v = twin[f];
    const formatted = fmtField(f, v);
    if (formatted !== null) {
      rows.push({
        key: String(f),
        label: LBL[f] ?? String(f),
        value: formatted,
        source: sources[f] ?? null,
        unknown: false,
      });
    } else if (unknown.has(String(f))) {
      rows.push({
        key: String(f),
        label: LBL[f] ?? String(f),
        value: "no lo sé",
        source: null,
        unknown: true,
      });
    }
  }
  return rows;
}
