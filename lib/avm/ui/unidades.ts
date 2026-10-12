import { ordenarUnidades, plantaNumero, type TwinUnit } from "../twin-builder";

export { ordenarUnidades };

const PUERTAS: Record<string, string> = {
  DR: "Dcha",
  DCHA: "Dcha",
  DE: "Dcha",
  IZ: "Izq",
  IZQ: "Izq",
  IZDA: "Izq",
  CT: "Centro",
  CN: "Centro",
  C: "Centro",
};

export function etiquetaPuerta(door: string | null): string | null {
  if (!door?.trim()) return null;
  const t = door.trim().toUpperCase();
  return PUERTAS[t] ?? door.trim();
}

export function etiquetaPlanta(floor: string | null): string | null {
  const n = plantaNumero(floor);
  if (n == null) return floor?.trim() ? `Planta ${floor.trim()}` : null;
  if (n === 0) return "Planta baja";
  if (n < 0) return "Sótano";
  return `Planta ${n}`;
}

/** "Planta 3 · Dcha · 86 m²" */
export function etiquetaUnidad(u: TwinUnit): string {
  const partes = [etiquetaPlanta(u.floor), etiquetaPuerta(u.door)];
  if (u.surface) partes.push(`${u.surface} m²`);
  return partes.filter(Boolean).join(" · ");
}

export function unidadesAgrupadas(units: TwinUnit[]): { viviendas: TwinUnit[]; otros: TwinUnit[] } {
  const orden = ordenarUnidades(units);
  return {
    viviendas: orden.filter((u) => u.isDwelling),
    otros: orden.filter((u) => !u.isDwelling),
  };
}
