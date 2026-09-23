import { URL_PARTICULARES_CORUNA } from "@/lib/captacion/brightdata/idealista";

export type BrightDataIdealistaConfig = {
  token: string;
  datasetId: string;
  fichaCollectorId: string;
  webhookSecret: string;
  listUrl: string;
};

export function configBrightDataIdealista(): BrightDataIdealistaConfig | { error: string } {
  const token = process.env.BRIGHTDATA_API_TOKEN?.trim();
  const datasetId = process.env.BRIGHTDATA_IDEALISTA_DATASET_ID?.trim();
  const webhookSecret = process.env.BRIGHTDATA_WEBHOOK_SECRET?.trim();
  if (!token || !datasetId || !webhookSecret) {
    return {
      error:
        "Faltan BRIGHTDATA_API_TOKEN, BRIGHTDATA_IDEALISTA_DATASET_ID o BRIGHTDATA_WEBHOOK_SECRET.",
    };
  }
  return {
    token,
    datasetId,
    fichaCollectorId: process.env.BRIGHTDATA_IDEALISTA_FICHA_COLLECTOR_ID?.trim() || datasetId,
    webhookSecret,
    listUrl: process.env.BRIGHTDATA_IDEALISTA_URL?.trim() || URL_PARTICULARES_CORUNA,
  };
}

export function webhookAutorizado(request: Request, secret: string): boolean {
  const auth = request.headers.get("authorization")?.trim() ?? "";
  const header = request.headers.get("x-webhook-secret")?.trim() ?? "";
  const token = new URL(request.url).searchParams.get("token")?.trim() ?? "";
  return auth === `Bearer ${secret}` || header === secret || token === secret;
}

export function urlWebhookPublica(request: Request): string {
  const fija = process.env.BRIGHTDATA_WEBHOOK_URL?.trim();
  if (fija) return fija.replace(/\/$/, "");
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    "";
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}/api/captacion/brightdata`;
}
