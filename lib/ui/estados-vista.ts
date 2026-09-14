export function colorEstado(estado: string): string {
  const e = estado.toLowerCase();
  if (e === "disponible" || e === "aceptado" || e === "convertido" || e === "pagada" || e === "firmado" || e === "activa" || e === "hecha") {
    return "#0B7461";
  }
  if (e === "reservada" || e === "enviado" || e === "emitida" || e === "pendiente_firma" || e === "hoy") {
    return "#B98A16";
  }
  if (e === "vendida" || e === "alquilada" || e === "presentado") {
    return "#2B4A8A";
  }
  if (e === "rechazado" || e === "vencida") {
    return "#A33B2A";
  }
  if (e === "baja" || e === "inactivo" || e === "cerrada") {
    return "#B3ADA3";
  }
  return "#8A938F";
}

export function formatEuro(
  valor: number | null | undefined,
  opts?: { fraction?: number; signed?: boolean }
): string {
  if (valor == null || !Number.isFinite(valor)) return "—";
  const n = Number(valor);
  const formatted = n.toLocaleString("es-ES", {
    minimumFractionDigits: opts?.fraction ?? 0,
    maximumFractionDigits: opts?.fraction ?? 0,
  });
  const sign = opts?.signed && n < 0 ? "" : "";
  return `${sign}${formatted} €`;
}

export function formatFechaCorta(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

export function telWhatsApp(telefono: string | null | undefined): string | null {
  if (!telefono) return null;
  const digits = telefono.replace(/\D/g, "");
  if (digits.length < 9) return null;
  const withCc = digits.startsWith("34") ? digits : `34${digits}`;
  return `https://wa.me/${withCc}`;
}
