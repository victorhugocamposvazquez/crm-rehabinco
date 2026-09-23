import { gunzipSync } from "zlib";
import type { BrightDataIdealistaConfig } from "@/lib/captacion/brightdata/config";
import { parsearRespuestaDataset } from "@/lib/captacion/brightdata/idealista";

/** Webhook o descarga: JSON, un anuncio por línea, o gzip. */
export function leerCuerpoBrightData(bytes: Uint8Array, encoding = ""): unknown {
  const gzip =
    encoding.toLowerCase().includes("gzip") ||
    (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b);
  let texto: string;
  if (gzip) {
    try {
      texto = gunzipSync(Buffer.from(bytes)).toString("utf8");
    } catch {
      texto = new TextDecoder().decode(bytes);
    }
  } else {
    texto = new TextDecoder().decode(bytes);
  }
  return parsearRespuestaDataset(texto);
}

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
        // telefono_ajax llega como objeto y el esquema lo tiene como texto. El CRM no lo usa.
        override_incompatible_schema: "1",
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
    error?: unknown;
    message?: unknown;
    errors?: unknown;
  };
  const snapshotId = json.collection_id || json.snapshot_id;
  if (!res.ok || !snapshotId) {
    throw new Error(`${textoError(json.error ?? json.message ?? json.errors) || "Bright Data no ha aceptado la petición"} (${res.status}).`);
  }
  return { snapshotId };
}

/** Bright Data a veces devuelve el error como objeto; se muestra su texto, no «[object Object]». */
function textoError(valor: unknown): string {
  if (valor == null) return "";
  if (typeof valor === "string") return valor;
  if (Array.isArray(valor)) return valor.map(textoError).filter(Boolean).join("; ");
  if (typeof valor === "object") {
    const rec = valor as Record<string, unknown>;
    const directo = rec.message ?? rec.error ?? rec.detail ?? rec.reason;
    if (typeof directo === "string") return directo;
    return JSON.stringify(valor).slice(0, 300);
  }
  return String(valor);
}

export async function descargarSnapshot(token: string, snapshotId: string): Promise<unknown> {
  const esCollector = snapshotId.startsWith("j_") || snapshotId.startsWith("d");
  const ruta = esCollector
    ? `https://api.brightdata.com/dca/dataset?id=${encodeURIComponent(snapshotId)}`
    : `https://api.brightdata.com/datasets/v3/snapshot/${encodeURIComponent(snapshotId)}?format=json`;
  const res = await fetch(ruta, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 202) return { pendiente: true };
  const texto = await res.text();
  if (!res.ok) {
    throw new Error(texto.slice(0, 300) || `Snapshot ${res.status}.`);
  }
  const data = parsearRespuestaDataset(texto);
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const estado = String((data as { status?: unknown; Status?: unknown }).status ?? (data as { Status?: unknown }).Status ?? "");
    if (/running|collecting|building|starting|pending/i.test(estado)) return { pendiente: true };
  }
  return data;
}
