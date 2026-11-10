/** Umbral: sin verse en portal más de esto → sospecha de retirada. */
export const SOSPECHA_RETIRADO_MS = 36 * 60 * 60 * 1000;

export function horasDesdeVisto(vistoEn: string | null | undefined, ahora = new Date()): number | null {
  if (!vistoEn) return null;
  const t = new Date(vistoEn).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, (ahora.getTime() - t) / 3_600_000);
}

/** Activo en CRM pero no actualizado en portal en demasiado tiempo. */
export function sospechaRetirado(
  a: { desaparecido_en?: string | null; visto_en?: string | null },
  ahora = new Date()
): boolean {
  if (a.desaparecido_en) return false;
  if (!a.visto_en) return true;
  const t = new Date(a.visto_en).getTime();
  if (!Number.isFinite(t)) return true;
  return ahora.getTime() - t >= SOSPECHA_RETIRADO_MS;
}

export function textoUltimaVezPortal(
  vistoEn: string | null | undefined,
  ahora = new Date()
): string {
  const h = horasDesdeVisto(vistoEn, ahora);
  if (h == null) return "Sin fecha de portal";
  if (h < 1) return "Última vez en portal: hace minutos";
  if (h < 24) return `Última vez en portal: hace ${Math.floor(h)} h`;
  const dias = Math.floor(h / 24);
  return `Última vez en portal: hace ${dias} d`;
}
