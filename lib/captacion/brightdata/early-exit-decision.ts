/** Decisión pura de early-exit (testable sin Supabase). */

export type DecisionEarlyExit =
  | { accion: "omitir_sin_lock"; motivo: "cola_vacia" }
  | { accion: "cerrar_recogidas"; motivo: "cola_vacia" }
  | { accion: "procesar" };

export function decidirEarlyExit(hayCola: boolean, hayRecogidasAbiertas: boolean): DecisionEarlyExit {
  if (hayCola) return { accion: "procesar" };
  if (hayRecogidasAbiertas) return { accion: "cerrar_recogidas", motivo: "cola_vacia" };
  return { accion: "omitir_sin_lock", motivo: "cola_vacia" };
}
