import type { Twin } from "../types";
import type { FieldSource } from "../twin-builder";

export type FilaFicha = { label: string; value: string; catastro: boolean };

const ETIQUETAS: { key: keyof Twin; label: string; texto: (t: Twin) => string | null }[] = [
  { key: "address", label: "Referencia catastral", texto: (t) => t.address.catastralRef },
  { key: "mainType", label: "Tipo", texto: (t) => (t.mainType ? `${t.propertyType ?? t.mainType}` : null) },
  { key: "builtSurface", label: "Superficie construida", texto: (t) => (t.builtSurface ? `${t.builtSurface} m²` : null) },
  { key: "constructionYear", label: "Año de construcción", texto: (t) => (t.constructionYear ? String(t.constructionYear) : null) },
  { key: "floorOfFlat", label: "Planta", texto: (t) => (t.floorOfFlat != null ? `${t.floorOfFlat}ª${t.numberOfFloors ? ` de ${t.numberOfFloors}` : ""}` : null) },
  { key: "side", label: "Orientación", texto: (t) => (t.side === "exterior" ? "Exterior" : t.side === "interior" ? "Interior" : null) },
  { key: "buildingCondition", label: "Estado", texto: (t) => (t.buildingCondition ? `${t.buildingCondition}/5` : null) },
];

export function filasFicha(twin: Twin, fieldSources: Partial<Record<string, FieldSource | string>> = {}): FilaFicha[] {
  return ETIQUETAS.flatMap((fila) => {
    const value = fila.texto(twin);
    if (!value) return [];
    const fuente = fila.key === "address" ? fieldSources.builtSurface ?? fieldSources.mainType : fieldSources[fila.key];
    const catastro = fuente === "catastro_sede" || fuente === "catastro_local" || (fila.key === "address" && Boolean(twin.address.catastralRef) && (fieldSources.builtSurface === "catastro_sede" || fieldSources.mainType === "catastro_sede"));
    return [{ label: fila.label, value, catastro }];
  });
}
