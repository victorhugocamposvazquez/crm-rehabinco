export type UnlockerConfig = { token: string; zone: string };

export function configUnlocker(): UnlockerConfig | { error: string } {
  const token = process.env.BRIGHTDATA_API_TOKEN?.trim();
  const zone = process.env.UNLOCKER_ZONE?.trim();
  if (!token || !zone) return { error: "Faltan BRIGHTDATA_API_TOKEN o UNLOCKER_ZONE." };
  return { token, zone };
}

/** HTML de una URL vía Web Unlocker. Dos reintentos si Bright Data responde 5xx. */
export async function pedirHtmlUnlocker(config: UnlockerConfig, url: string): Promise<string> {
  let ultimo = "Unlocker no respondió.";
  for (let intento = 0; intento < 3; intento++) {
    const res = await fetch("https://api.brightdata.com/request", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ zone: config.zone, url, format: "raw" }),
    });
    if (res.ok) return await res.text();
    ultimo = `Unlocker ${res.status}`;
    if (res.status < 500 || intento === 2) break;
  }
  throw new Error(ultimo);
}
