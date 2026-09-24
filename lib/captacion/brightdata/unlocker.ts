export type UnlockerConfig = { token: string; zone: string };

export function configUnlocker(): UnlockerConfig | { error: string } {
  const token = process.env.BRIGHTDATA_API_TOKEN?.trim();
  const zone = process.env.UNLOCKER_ZONE?.trim();
  if (!token || !zone) return { error: "Faltan BRIGHTDATA_API_TOKEN o UNLOCKER_ZONE." };
  return { token, zone };
}

export type RespuestaUnlocker = {
  ok: boolean;
  http_status: number;
  content_type: string | null;
  cuerpo: string;
  bytes: number;
};

/** Respuesta cruda del Unlocker (format raw). Dos reintentos en 5xx. */
export async function pedirUnlocker(config: UnlockerConfig, url: string): Promise<RespuestaUnlocker> {
  let ultimo: RespuestaUnlocker = { ok: false, http_status: 0, content_type: null, cuerpo: "", bytes: 0 };
  for (let intento = 0; intento < 3; intento++) {
    const res = await fetch("https://api.brightdata.com/request", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ zone: config.zone, url, format: "raw" }),
    });
    const content_type = res.headers.get("content-type");
    const cuerpo = await res.text();
    const bytes = new TextEncoder().encode(cuerpo).length;
    const base = { http_status: res.status, content_type, cuerpo, bytes };
    if (res.ok) return { ...base, ok: true };
    ultimo = { ...base, ok: false };
    if (res.status < 500 || intento === 2) break;
  }
  return ultimo;
}

/** HTML de una URL vía Web Unlocker. Dos reintentos si Bright Data responde 5xx. */
export async function pedirHtmlUnlocker(config: UnlockerConfig, url: string): Promise<string> {
  const resp = await pedirUnlocker(config, url);
  if (!resp.ok) throw new Error(`Unlocker ${resp.http_status}`);
  return resp.cuerpo;
}
