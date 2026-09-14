import { fincaUiDesdeRecord } from "@/lib/catastro/explorer/history-ui";
import type { FincaBusquedaUi } from "@/lib/catastro/search-ui";
import { nombreComercial } from "./finca-assignment";
import { parseEstadoCaptacion, type EstadoCaptacion } from "@/lib/captacion/estados";

export type FincaCaptacionApi = {
  finca: FincaBusquedaUi;
  fincaReference: string;
  comercialId: string;
  comercialNombre: string;
  assignedAt: string | null;
  estado: EstadoCaptacion;
  proximaAccion: string | null;
  proximaAccionEn: string | null;
  propertyId: string | null;
};

type AssignmentRow = {
  finca_reference: string;
  comercial_id: string;
  assigned_at?: string | null;
  profiles?: { nombre_completo?: string | null; email?: string | null } | null;
  catastro_explorer_pipeline?: {
    estado?: string | null;
    proxima_accion?: string | null;
    proxima_accion_en?: string | null;
  } | null;
};

export function filaCaptacionDesdeAssignment(
  row: AssignmentRow,
  finca: Parameters<typeof fincaUiDesdeRecord>[0] | undefined,
  propertyId: string | null
): FincaCaptacionApi | null {
  if (!finca) return null;
  const pipeline = Array.isArray(row.catastro_explorer_pipeline)
    ? row.catastro_explorer_pipeline[0]
    : row.catastro_explorer_pipeline;
  const profiles = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return {
    finca: fincaUiDesdeRecord(finca),
    fincaReference: row.finca_reference,
    comercialId: row.comercial_id,
    comercialNombre: nombreComercial(profiles ?? {}),
    assignedAt: row.assigned_at ?? null,
    estado: parseEstadoCaptacion(pipeline?.estado),
    proximaAccion: pipeline?.proxima_accion ?? null,
    proximaAccionEn: pipeline?.proxima_accion_en ?? null,
    propertyId,
  };
}
