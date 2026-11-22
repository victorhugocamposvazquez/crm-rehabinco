import type { EstadoNota, MotivoNota } from "./modelo";
import type { ResumenNota } from "./resumen";

/** Fila de notas_simples tal como la devuelve la API. */
export interface NotaSimple {
  id: string;
  user_id: string;
  propiedad_id: string | null;
  ref_catastral: string | null;
  idufir: string | null;
  finca_registral: string | null;
  registro: string | null;
  direccion: string;
  municipio: string | null;
  provincia: string | null;
  titular: string | null;
  motivo: MotivoNota;
  motivo_texto: string | null;
  estado: EstadoNota;
  proveedor: "manual" | "api";
  proveedor_ref: string | null;
  coste_cents: number | null;
  incidencia: string | null;
  pdf_path: string | null;
  documento_id: string | null;
  resumen: ResumenNota | null;
  resumen_modelo: string | null;
  solicitada_en: string;
  recibida_en: string | null;
  created_at: string;
  updated_at: string;
}
