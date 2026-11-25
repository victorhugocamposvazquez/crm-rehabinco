import type { SolicitudNota } from "./modelo";

/**
 * Proveedor de notas simples. Hoy solo "manual"; cuando haya contrato con un
 * proveedor con API (Registradores, intermediarios) se añade aquí sin tocar
 * pantallas ni base de datos.
 */
export interface ProveedorNotaSimple {
  id: "manual" | "api";
  nombre: string;
  /** Precio orientativo por nota, en céntimos e IVA incluido. */
  precioCents: number;
  plazo: string;
  /** Pasos para quien la tramita (modo manual) o null si es automático. */
  instrucciones(s: SolicitudNota): string[] | null;
}

export const SEDE_REGISTRADORES = "https://sede.registradores.org/";

export const PROVEEDOR_MANUAL: ProveedorNotaSimple = {
  id: "manual",
  nombre: "Sede electrónica del Registro (tramitación por el equipo)",
  precioCents: 1090,
  plazo: "Normalmente en el día; como mucho, 1 o 2 días hábiles",
  instrucciones(s) {
    const busqueda = s.idufir
      ? `IDUFIR/CRU ${s.idufir}`
      : s.refCatastral
        ? `referencia catastral ${s.refCatastral}`
        : `finca ${s.fincaRegistral} del Registro ${s.registro}`;
    return [
      `Entra en la sede de Registradores (${SEDE_REGISTRADORES}) con el certificado de la agencia.`,
      `Pide una nota simple de la ${busqueda}${s.direccion ? ` (${s.direccion})` : ""}.`,
      "Declara el interés legítimo indicado en esta solicitud.",
      "Cuando llegue el PDF, súbelo aquí: el CRM lo lee y lo resume.",
    ];
  },
};

export function proveedorActivo(): ProveedorNotaSimple {
  return PROVEEDOR_MANUAL;
}
