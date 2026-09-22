import type { BrightDataIdealistaConfig } from "@/lib/captacion/brightdata/config";

export async function dispararIdealista(
  config: BrightDataIdealistaConfig,
  webhookUrl: string
): Promise<{ snapshotId: string }> {
  const destino = new URL(webhookUrl);
  if (!destino.searchParams.get("token")) destino.searchParams.set("token", config.webhookSecret);
  const params = new URLSearchParams({
    dataset_id: config.datasetId,
    endpoint: destino.toString(),
    auth_header: `Bearer ${config.webhookSecret}`,
    format: "json",
    uncompressed_webhook: "true",
    include_errors: "true",
  });
  const res = await fetch(`https://api.brightdata.com/datasets/v3/trigger?${params}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([{ url: config.listUrl }]),
  });
  const json = (await res.json().catch(() => ({}))) as { snapshot_id?: string; error?: string };
  if (!res.ok || !json.snapshot_id) {
    throw new Error(json.error || `Bright Data respondió ${res.status}.`);
  }
  return { snapshotId: json.snapshot_id };
}

export async function descargarSnapshot(token: string, snapshotId: string): Promise<unknown> {
  const res = await fetch(
    `https://api.brightdata.com/datasets/v3/snapshot/${encodeURIComponent(snapshotId)}?format=json`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (res.status === 202) return { pendiente: true };
  if (!res.ok) {
    const texto = await res.text();
    throw new Error(texto.slice(0, 300) || `Snapshot ${res.status}.`);
  }
  return res.json();
}
