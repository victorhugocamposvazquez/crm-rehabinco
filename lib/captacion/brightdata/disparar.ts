import type { BrightDataIdealistaConfig } from "@/lib/captacion/brightdata/config";

export async function dispararIdealista(
  config: BrightDataIdealistaConfig,
  webhookUrl: string,
  listUrls: string[]
): Promise<{ snapshotId: string }> {
  const urls = [...new Set(listUrls.map((url) => url.trim()).filter(Boolean))];
  if (urls.length === 0) throw new Error("No hay zonas marcadas.");
  const destino = new URL(webhookUrl);
  if (!destino.searchParams.get("token")) destino.searchParams.set("token", config.webhookSecret);
  // En un collector, notify sustituye la entrega configurada y no manda los anuncios.
  // Sin notify ni deliver se usan las Delivery preferences: webhook y lotes de 20.
  const params = config.datasetId.startsWith("c_")
    ? new URLSearchParams({
        collector: config.datasetId,
        queue_next: "1",
      })
    : new URLSearchParams({
        dataset_id: config.datasetId,
        endpoint: destino.toString(),
        auth_header: `Bearer ${config.webhookSecret}`,
        format: "json",
        uncompressed_webhook: "true",
        include_errors: "true",
      });
  const ruta = config.datasetId.startsWith("c_")
    ? "https://api.brightdata.com/dca/trigger"
    : "https://api.brightdata.com/datasets/v3/trigger";
  const res = await fetch(`${ruta}?${params}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(urls.map((url) => ({ url }))),
  });
  const json = (await res.json().catch(() => ({}))) as {
    snapshot_id?: string;
    collection_id?: string;
    error?: string;
  };
  const snapshotId = json.collection_id || json.snapshot_id;
  if (!res.ok || !snapshotId) {
    throw new Error(json.error || `Bright Data respondió ${res.status}.`);
  }
  return { snapshotId };
}

export async function descargarSnapshot(token: string, snapshotId: string): Promise<unknown> {
  const esCollector = snapshotId.startsWith("j_") || snapshotId.startsWith("d");
  const ruta = esCollector
    ? `https://api.brightdata.com/dca/dataset?id=${encodeURIComponent(snapshotId)}`
    : `https://api.brightdata.com/datasets/v3/snapshot/${encodeURIComponent(snapshotId)}?format=json`;
  const res = await fetch(ruta, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 202) return { pendiente: true };
  if (!res.ok) {
    const texto = await res.text();
    throw new Error(texto.slice(0, 300) || `Snapshot ${res.status}.`);
  }
  const data = await res.json();
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const estado = String((data as { status?: unknown; Status?: unknown }).status ?? (data as { Status?: unknown }).Status ?? "");
    if (/running|collecting|building|starting|pending/i.test(estado)) return { pendiente: true };
  }
  return data;
}
