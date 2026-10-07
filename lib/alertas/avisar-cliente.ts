/** Avisa al momento tras guardar. El servidor decide a quién y evita duplicados. */
export function avisarEvento(tipo: "mencion" | "cita" | "tarea", id: string) {
  void fetch("/api/alertas/evento", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tipo, id }),
  }).catch(() => undefined);
}
