import { createAdminClient } from "@/lib/supabase/admin";

export const PORTALES_API = ["idealista", "fotocasa"] as const;
export type PortalApi = (typeof PORTALES_API)[number];

export type CredencialesPortal = {
  apiKey: string;
  apiSecret: string;
};

const ENV: Record<PortalApi, { key: string; secret: string }> = {
  idealista: { key: "IDEALISTA_API_KEY", secret: "IDEALISTA_API_SECRET" },
  fotocasa: { key: "FOTOCASA_API_KEY", secret: "FOTOCASA_API_SECRET" },
};

export function enmascararClave(valor: string | null | undefined): string | null {
  const v = valor?.trim() ?? "";
  if (!v) return null;
  if (v.length <= 4) return "••••";
  return `${"•".repeat(Math.min(8, Math.max(4, v.length - 4)))}${v.slice(-4)}`;
}

function parEnv(portal: PortalApi): CredencialesPortal | null {
  const names = ENV[portal];
  const apiKey = process.env[names.key]?.trim() ?? "";
  const apiSecret = process.env[names.secret]?.trim() ?? "";
  if (!apiKey || !apiSecret) return null;
  return { apiKey, apiSecret };
}

export function hayClavesEnServidor(portal: PortalApi): boolean {
  return parEnv(portal) != null;
}

export async function leerCredencialesPortal(portal: PortalApi): Promise<CredencialesPortal | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("captacion_portales_credenciales")
      .select("api_key, api_secret")
      .eq("portal", portal)
      .maybeSingle();
    const apiKey = typeof data?.api_key === "string" ? data.api_key.trim() : "";
    const apiSecret = typeof data?.api_secret === "string" ? data.api_secret.trim() : "";
    if (apiKey && apiSecret) return { apiKey, apiSecret };
  } catch {
    // Sin service role o tabla aún no migrada: cae a env.
  }
  return parEnv(portal);
}

export async function guardarCredencialesPortal(
  portal: PortalApi,
  input: { apiKey?: string | null; apiSecret?: string | null; borrar?: boolean; userId: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  if (input.borrar) {
    const { error } = await admin.from("captacion_portales_credenciales").upsert({
      portal,
      api_key: null,
      api_secret: null,
      updated_at: new Date().toISOString(),
      updated_by: input.userId,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }
  const { data: previo } = await admin
    .from("captacion_portales_credenciales")
    .select("api_key, api_secret")
    .eq("portal", portal)
    .maybeSingle();
  const apiKey = (input.apiKey?.trim() || (typeof previo?.api_key === "string" ? previo.api_key : "")).trim();
  const apiSecret = (input.apiSecret?.trim() || (typeof previo?.api_secret === "string" ? previo.api_secret : "")).trim();
  if (!apiKey || !apiSecret) {
    return { ok: false, error: "Hace falta la clave y el secreto." };
  }
  const { error } = await admin.from("captacion_portales_credenciales").upsert({
    portal,
    api_key: apiKey,
    api_secret: apiSecret,
    updated_at: new Date().toISOString(),
    updated_by: input.userId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function estadoCredencialesPortal(portal: PortalApi): Promise<{
  enApp: boolean;
  enServidor: boolean;
  keyHint: string | null;
}> {
  let enApp = false;
  let keyHint: string | null = null;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("captacion_portales_credenciales")
      .select("api_key, api_secret")
      .eq("portal", portal)
      .maybeSingle();
    const apiKey = typeof data?.api_key === "string" ? data.api_key.trim() : "";
    const apiSecret = typeof data?.api_secret === "string" ? data.api_secret.trim() : "";
    enApp = Boolean(apiKey && apiSecret);
    keyHint = enmascararClave(apiKey);
  } catch {
    enApp = false;
  }
  return { enApp, enServidor: hayClavesEnServidor(portal), keyHint };
}
