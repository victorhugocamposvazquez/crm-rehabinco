export const TIPOS_PAPELERA = ["parte_visita", "contrato_arras", "usuario"] as const;
export type TipoPapelera = (typeof TIPOS_PAPELERA)[number];

export const ACCIONES_PAPELERA = ["eliminar", "crear"] as const;
export type AccionPapelera = (typeof ACCIONES_PAPELERA)[number];

export const TIPO_PAPELERA_LABEL: Record<TipoPapelera, string> = {
  parte_visita: "Parte de visita",
  contrato_arras: "Contrato de arras",
  usuario: "Usuario",
};

export const ACCION_PAPELERA_LABEL: Record<AccionPapelera, string> = {
  eliminar: "Eliminar",
  crear: "Crear",
};

export type PapeleraItem = {
  id: string;
  tipo: TipoPapelera;
  accion: AccionPapelera;
  entity_id: string | null;
  etiqueta: string;
  snapshot: Record<string, unknown>;
  solicitado_por: string;
  created_at: string;
  resuelto_at: string | null;
  resolucion: string | null;
  solicitante?: { nombre_completo?: string | null; email?: string | null } | null;
};

export type SnapshotUsuarioCrear = {
  email: string;
  password: string;
  role: string;
};

export type SnapshotUsuarioEliminar = {
  userId: string;
  email: string | null;
  nombre: string | null;
  role: string | null;
};
