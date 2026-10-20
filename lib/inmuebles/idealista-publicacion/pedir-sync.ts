export async function pedirSyncIdealista(propiedadId: string): Promise<{
  ok: boolean;
  estado: string | null;
  mensaje: string | null;
}> {
  const res = await fetch("/api/inmuebles/idealista/sincronizar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ propiedadId }),
  });
  const json = (await res.json()) as { ok?: boolean; estado?: string | null; mensaje?: string | null; error?: string };
  return {
    ok: Boolean(json.ok),
    estado: json.estado ?? null,
    mensaje: json.mensaje ?? json.error ?? null,
  };
}
