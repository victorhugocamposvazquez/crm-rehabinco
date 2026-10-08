export type FilaFiltroDemanda = {
  tipo_operacion: string;
  tipos_inmueble?: string[] | null;
  zonas?: string[] | null;
  comercial_id?: string | null;
  cliente?: string | null;
  comercial?: string | null;
};

export type FiltroListadoDemanda = {
  q: string;
  operacion: string;
  tipo: string;
  zona: string;
  comercialId: string;
};

export const FILTRO_LISTADO_VACIO: FiltroListadoDemanda = {
  q: "",
  operacion: "",
  tipo: "",
  zona: "",
  comercialId: "",
};

export function hayFiltroListado(filtro: FiltroListadoDemanda): boolean {
  return Boolean(filtro.q.trim() || filtro.operacion || filtro.tipo || filtro.zona || filtro.comercialId);
}

export function pasaFiltroDemanda(fila: FilaFiltroDemanda, filtro: FiltroListadoDemanda): boolean {
  if (filtro.operacion) {
    const encaja =
      fila.tipo_operacion === filtro.operacion || (filtro.operacion !== "ambos" && fila.tipo_operacion === "ambos");
    if (!encaja) return false;
  }
  if (filtro.tipo && !(fila.tipos_inmueble ?? []).includes(filtro.tipo)) return false;
  if (filtro.zona && !(fila.zonas ?? []).some((zona) => zona.trim() === filtro.zona)) return false;
  if (filtro.comercialId && fila.comercial_id !== filtro.comercialId) return false;

  const q = filtro.q.trim().toLowerCase();
  if (!q) return true;
  const texto = [fila.cliente, fila.comercial, ...(fila.zonas ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return texto.includes(q);
}
