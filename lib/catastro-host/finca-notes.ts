/**
 * Notas comerciales de una finca. Viven en el host, no en el motor ni en CatastroFinca.
 */
export const NOTAS_FINCA_MAX = 4000;

export type NotaFinca = {
  fincaReference: string;
  notes: string;
  updatedAt: string | null;
};

export function textoNotaFinca(valor: unknown): string {
  if (typeof valor !== "string") return "";
  return valor.replace(/\r\n/g, "\n").slice(0, NOTAS_FINCA_MAX);
}

export function notaDesdeFila(
  fincaReference: string,
  row: { notes?: unknown; updated_at?: unknown } | null
): NotaFinca {
  return {
    fincaReference,
    notes: textoNotaFinca(row?.notes),
    updatedAt: typeof row?.updated_at === "string" ? row.updated_at : null,
  };
}
