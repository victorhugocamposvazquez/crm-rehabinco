export const EMPRESA_PARTE_VISITA = {
  razonSocial: "REHABINCO, S.L.",
  cif: "B22834005",
  direccion: "Rúa da Merced nº 57, Bajo – 15009 A Coruña",
  lugar: "A Coruña",
} as const;

export const ESTADO_PARTE_LABELS: Record<
  "borrador" | "pendiente_firma" | "firmado",
  string
> = {
  borrador: "Borrador",
  pendiente_firma: "Pendiente de firma",
  firmado: "Firmado",
};

export function formatFechaLargaEs(dateStr: string | null | undefined): string {
  if (!dateStr) return "____ de ________________ de 20____";
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "____ de ________________ de 20____";
  const day = d.getDate();
  const month = d.toLocaleDateString("es-ES", { month: "long" });
  const year = String(d.getFullYear()).slice(-2);
  return `${day} de ${month} de 20${year}`;
}

export function formatHoraVisita(hora: string | null | undefined): string {
  if (!hora) return "—";
  return hora.slice(0, 5);
}

export function buildPublicFirmaUrl(token: string, origin?: string): string {
  const base =
    origin ??
    (typeof window !== "undefined" ? window.location.origin : "") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "";
  return `${base.replace(/\/$/, "")}/firmar/${token}`;
}
