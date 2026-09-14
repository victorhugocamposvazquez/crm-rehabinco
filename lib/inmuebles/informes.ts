export type VisitaInforme = {
  comercialId: string | null;
  fechaVisita: string | null;
  estado: string;
};

export type StockInforme = {
  comercialId: string | null;
  comercialNombre: string;
  estado: string;
};

export type DemandaInforme = {
  id: string;
  matches: number;
};

export function visitasEnSemana(visitas: VisitaInforme[], inicio: string, fin: string): number {
  return visitas.filter((item) => {
    const dia = item.fechaVisita?.slice(0, 10);
    return Boolean(dia && dia >= inicio && dia <= fin);
  }).length;
}

export function stockPorComercial(
  filas: StockInforme[]
): Array<{ comercialId: string; nombre: string; total: number; disponibles: number }> {
  const mapa = new Map<string, { comercialId: string; nombre: string; total: number; disponibles: number }>();
  for (const fila of filas) {
    const id = fila.comercialId ?? "sin-asignar";
    const actual = mapa.get(id) ?? {
      comercialId: id,
      nombre: fila.comercialNombre || "Sin asignar",
      total: 0,
      disponibles: 0,
    };
    actual.total += 1;
    if (fila.estado === "disponible") actual.disponibles += 1;
    mapa.set(id, actual);
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total);
}

export function demandasSinMatching(demandas: DemandaInforme[]): number {
  return demandas.filter((item) => item.matches === 0).length;
}
