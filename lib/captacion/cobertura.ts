export type BusquedaCobertura = {
  mode?: string;
  postalCode?: string | null;
  municipio?: string | null;
  provincia?: string | null;
  streetsFound?: number | null;
  streetsProcessed?: number | null;
  complete?: boolean | null;
  status?: string | null;
  updatedAt?: string | null;
};

export type CoberturaCp = {
  postalCode: string;
  municipio: string;
  provincia: string;
  streetsFound: number;
  streetsProcessed: number;
  complete: boolean;
  updatedAt: string | null;
};

export function filaCoberturaDesdeBusqueda(input: BusquedaCobertura): CoberturaCp | null {
  const postalCode = input.postalCode?.trim() ?? "";
  if (!/^\d{5}$/.test(postalCode)) return null;
  if (input.mode && input.mode !== "POSTAL_CODE") return null;
  return {
    postalCode,
    municipio: input.municipio?.trim() ?? "",
    provincia: input.provincia?.trim() ?? "",
    streetsFound: Number(input.streetsFound ?? 0),
    streetsProcessed: Number(input.streetsProcessed ?? 0),
    complete: Boolean(input.complete),
    updatedAt: input.updatedAt ?? null,
  };
}

export function agregarCoberturaTerritorio(filas: BusquedaCobertura[]): CoberturaCp[] {
  const mapa = new Map<string, CoberturaCp>();
  for (const raw of filas) {
    const fila = filaCoberturaDesdeBusqueda(raw);
    if (!fila) continue;
    const previa = mapa.get(fila.postalCode);
    if (!previa) {
      mapa.set(fila.postalCode, fila);
      continue;
    }
    const masReciente =
      (fila.updatedAt ?? "") > (previa.updatedAt ?? "") ? fila : previa;
    mapa.set(fila.postalCode, {
      ...masReciente,
      streetsFound: Math.max(previa.streetsFound, fila.streetsFound),
      streetsProcessed: Math.max(previa.streetsProcessed, fila.streetsProcessed),
      complete: previa.complete || fila.complete,
    });
  }
  return [...mapa.values()].sort((a, b) => a.postalCode.localeCompare(b.postalCode));
}
