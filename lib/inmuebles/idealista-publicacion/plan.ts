export type AccionSyncIdealista = "nada" | "marcar_espera" | "publicar" | "desactivar" | "incompleto" | "baja_pendiente";

export function planSyncIdealista(input: {
  publicar: boolean;
  motivos: string[];
  anuncios: number;
  apiLista: boolean;
  tieneAnuncio: boolean;
}): { accion: AccionSyncIdealista; mensaje: string | null } {
  if (input.publicar && input.motivos.length) {
    return { accion: "incompleto", mensaje: input.motivos.join(", ") };
  }
  if (input.publicar && !input.apiLista) {
    return {
      accion: "marcar_espera",
      mensaje: null,
    };
  }
  if (input.publicar && input.anuncios > 0) {
    return { accion: "publicar", mensaje: null };
  }
  if (!input.publicar && input.tieneAnuncio && input.apiLista) {
    return { accion: "desactivar", mensaje: null };
  }
  if (!input.publicar && input.tieneAnuncio) {
    return { accion: "baja_pendiente", mensaje: null };
  }
  return { accion: "nada", mensaje: null };
}

export function etiquetaEstadoIdealista(estado: string | null | undefined, publicar: boolean): string | null {
  if (!publicar && estado !== "pendiente_baja" && estado !== "error") return null;
  if (estado === "publicado") return "En Idealista";
  if (estado === "esperando_api") return "Idealista · esperando API";
  if (estado === "incompleto") return "Idealista · faltan datos";
  if (estado === "error") return "Idealista · no publicado";
  if (estado === "pendiente_baja") return "Idealista · baja pendiente";
  if (estado === "despublicado") return null;
  if (publicar) return "Idealista · sin enviar";
  return null;
}
