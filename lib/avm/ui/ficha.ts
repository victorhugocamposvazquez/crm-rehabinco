import type { Twin } from "../types";
import type { FieldSource } from "../twin-builder";
import { ETIQUETA_PROPERTY_TYPE, ETIQUETA_MAIN_TYPE } from "./labels";

export type FilaFicha = { label: string; value: string; catastro: boolean; vacio: boolean };

function esCatastro(fuente: FieldSource | string | undefined): boolean {
  return fuente === "catastro_sede" || fuente === "catastro_local";
}

function textoTipo(t: Twin): string {
  if (t.propertyType) return ETIQUETA_PROPERTY_TYPE[t.propertyType];
  if (t.mainType) return ETIQUETA_MAIN_TYPE[t.mainType];
  return "—";
}

function textoPlanta(t: Twin): string {
  if (t.floorOfFlat == null && t.numberOfFloors == null) return "—";
  const p =
    t.floorOfFlat == null
      ? null
      : t.floorOfFlat === 0
        ? "Planta baja"
        : `${t.floorOfFlat}ª`;
  const total = t.numberOfFloors != null ? ` de ${t.numberOfFloors}` : "";
  return `${p ?? "—"}${p != null ? total : t.numberOfFloors != null ? `${t.numberOfFloors} plantas` : ""}`;
}

function textoSiNo(v: boolean | null): string {
  if (v === null) return "—";
  return v ? "Sí" : "No";
}

function textoEstado(t: Twin): string {
  if (!t.buildingCondition && !t.isRenovated && !t.renovationYear) return "—";
  const partes: string[] = [];
  if (t.buildingCondition) partes.push(`${t.buildingCondition}/5`);
  if (t.isRenovated && t.renovationYear) partes.push(`reformado en ${t.renovationYear}`);
  else if (t.isRenovated) partes.push("reformado");
  else if (t.renovationYear) partes.push(`reforma ${t.renovationYear}`);
  return partes.join(" · ");
}

function textoGaraje(t: Twin): string {
  const i = t.numberOfIndoorParkings ?? 0;
  const o = t.numberOfOutdoorParkings ?? 0;
  if (!i && !o) return t.numberOfIndoorParkings === null && t.numberOfOutdoorParkings === null ? "—" : "No";
  const partes: string[] = [];
  if (i) partes.push(`${i} ${i === 1 ? "plaza cubierta" : "plazas cubiertas"}`);
  if (o) partes.push(`${o} ${o === 1 ? "plaza exterior" : "plazas exteriores"}`);
  return partes.join(" · ");
}

function textoTerraza(t: Twin): string {
  if (t.hasBalcony === null && t.balconySurface == null) return "—";
  if (t.balconySurface) return `Balcón ${t.balconySurface} m²`;
  return textoSiNo(t.hasBalcony);
}

function fila(
  label: string,
  value: string,
  catastro: boolean,
  vacio = value === "—",
): FilaFicha {
  return { label, value, catastro, vacio };
}

/** Orden fijo del prototipo CRM; los nulos muestran «—». */
export function filasFicha(twin: Twin, fieldSources: Partial<Record<string, FieldSource | string>> = {}): FilaFicha[] {
  const dir =
    twin.address.formattedAddress?.trim() ||
    [twin.address.route, twin.address.streetNumber].filter(Boolean).join(" ") ||
    "—";
  const ref = twin.address.catastralRef?.trim() || "—";

  return [
    fila("Dirección", dir, false, dir === "—"),
    fila("Referencia catastral", ref, esCatastro(fieldSources.builtSurface) || esCatastro(fieldSources.mainType) || Boolean(twin.address.catastralRef), ref === "—"),
    fila("Tipo", textoTipo(twin), esCatastro(fieldSources.mainType), !twin.mainType && !twin.propertyType),
    fila("Superficie", twin.builtSurface ? `${twin.builtSurface} m²` : "—", esCatastro(fieldSources.builtSurface), twin.builtSurface == null),
    fila("Planta", textoPlanta(twin), esCatastro(fieldSources.floorOfFlat), twin.floorOfFlat == null && twin.numberOfFloors == null),
    fila("Ascensor", textoSiNo(twin.hasElevator), esCatastro(fieldSources.hasElevator), twin.hasElevator === null),
    fila(
      "Orientación",
      twin.side === "exterior" ? "Exterior" : twin.side === "interior" ? "Interior" : "—",
      esCatastro(fieldSources.side),
      twin.side == null,
    ),
    fila(
      "Año y reforma",
      twin.constructionYear
        ? `${twin.constructionYear}${twin.renovationYear ? ` · reforma ${twin.renovationYear}` : ""}`
        : twin.renovationYear
          ? `reforma ${twin.renovationYear}`
          : "—",
      esCatastro(fieldSources.constructionYear),
      !twin.constructionYear && !twin.renovationYear,
    ),
    fila("Estado", textoEstado(twin), esCatastro(fieldSources.buildingCondition), !twin.buildingCondition && !twin.isRenovated),
    fila(
      "Dormitorios y baños",
      twin.numberOfBedrooms != null || twin.numberOfBathrooms != null
        ? `${twin.numberOfBedrooms ?? "—"} / ${twin.numberOfBathrooms ?? "—"}`
        : "—",
      esCatastro(fieldSources.numberOfBedrooms),
      twin.numberOfBedrooms == null && twin.numberOfBathrooms == null,
    ),
    fila("Garaje", textoGaraje(twin), esCatastro(fieldSources.numberOfIndoorParkings), twin.numberOfIndoorParkings == null && twin.numberOfOutdoorParkings == null),
    fila("Terraza / balcón", textoTerraza(twin), esCatastro(fieldSources.hasBalcony), twin.hasBalcony === null && twin.balconySurface == null),
    fila("Trastero", textoSiNo(twin.hasStorageRoom), esCatastro(fieldSources.hasStorageRoom), twin.hasStorageRoom === null),
    fila("Vistas", textoSiNo(twin.hasView), esCatastro(fieldSources.hasView), twin.hasView === null),
  ];
}
