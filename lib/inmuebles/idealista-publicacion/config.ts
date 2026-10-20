import { createAdminClient } from "@/lib/supabase/admin";

export type IdealistaPublicacionConfig = {
  customerCode: string | null;
  ftpHost: string | null;
  ftpPort: number;
  ftpUser: string | null;
  ftpPassword: string | null;
  ftpSecure: boolean;
  apiClientId: string | null;
  apiClientSecret: string | null;
  apiBaseUrl: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  updatedAt: string | null;
};

function desdeEnv(): Partial<IdealistaPublicacionConfig> {
  return {
    customerCode: process.env.IDEALISTA_ILC?.trim() || null,
    ftpHost: process.env.IDEALISTA_FTP_HOST?.trim() || null,
    ftpUser: process.env.IDEALISTA_FTP_USER?.trim() || null,
    ftpPassword: process.env.IDEALISTA_FTP_PASSWORD?.trim() || null,
    ftpPort: Number(process.env.IDEALISTA_FTP_PORT ?? 21) || 21,
    ftpSecure: process.env.IDEALISTA_FTP_SECURE !== "false",
    contactEmail: process.env.IDEALISTA_CONTACT_EMAIL?.trim() || null,
    contactName: process.env.IDEALISTA_CONTACT_NAME?.trim() || null,
    contactPhone: process.env.IDEALISTA_CONTACT_PHONE?.trim() || null,
    apiClientId: process.env.IDEALISTA_PUBLISH_CLIENT_ID?.trim() || null,
    apiClientSecret: process.env.IDEALISTA_PUBLISH_CLIENT_SECRET?.trim() || null,
    apiBaseUrl: process.env.IDEALISTA_PUBLISH_BASE_URL?.trim() || null,
  };
}

export async function leerConfigIdealistaPublicacion(): Promise<IdealistaPublicacionConfig> {
  const fallback = desdeEnv();
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("idealista_publicacion_config").select("*").eq("id", 1).maybeSingle();
    if (data) {
      return {
        customerCode: data.customer_code?.trim() || fallback.customerCode || null,
        ftpHost: data.ftp_host?.trim() || fallback.ftpHost || null,
        ftpPort: data.ftp_port ?? fallback.ftpPort ?? 21,
        ftpUser: data.ftp_user?.trim() || fallback.ftpUser || null,
        ftpPassword: data.ftp_password?.trim() || fallback.ftpPassword || null,
        ftpSecure: data.ftp_secure ?? fallback.ftpSecure ?? true,
        contactName: data.contact_name?.trim() || fallback.contactName || null,
        contactEmail: data.contact_email?.trim() || fallback.contactEmail || null,
        contactPhone: data.contact_phone?.trim() || fallback.contactPhone || null,
        apiClientId: data.api_client_id?.trim() || fallback.apiClientId || null,
        apiClientSecret: data.api_client_secret?.trim() || fallback.apiClientSecret || null,
        apiBaseUrl: data.api_base_url?.trim() || fallback.apiBaseUrl || null,
        updatedAt: data.updated_at ?? null,
      };
    }
  } catch {
    // tabla aún no migrada
  }
  return {
    customerCode: fallback.customerCode ?? null,
    ftpHost: fallback.ftpHost ?? null,
    ftpPort: fallback.ftpPort ?? 21,
    ftpUser: fallback.ftpUser ?? null,
    ftpPassword: fallback.ftpPassword ?? null,
    ftpSecure: fallback.ftpSecure ?? true,
    contactName: fallback.contactName ?? null,
    contactEmail: fallback.contactEmail ?? null,
    contactPhone: fallback.contactPhone ?? null,
    apiClientId: fallback.apiClientId ?? null,
    apiClientSecret: fallback.apiClientSecret ?? null,
    apiBaseUrl: fallback.apiBaseUrl ?? null,
    updatedAt: null,
  };
}

export type GuardarConfigInput = {
  customerCode?: string | null;
  ftpHost?: string | null;
  ftpPort?: number;
  ftpUser?: string | null;
  ftpPassword?: string | null;
  ftpSecure?: boolean;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  apiClientId?: string | null;
  apiClientSecret?: string | null;
  apiBaseUrl?: string | null;
  userId: string;
};

export async function guardarConfigIdealistaPublicacion(
  input: GuardarConfigInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { data: previo } = await admin.from("idealista_publicacion_config").select("*").eq("id", 1).maybeSingle();

  const customerCode = (input.customerCode?.trim() || previo?.customer_code || "").trim() || null;
  if (customerCode && !/^ilc[a-f0-9]{40}$/i.test(customerCode)) {
    return { ok: false, error: "El código ILC debe empezar por ilc y tener 43 caracteres." };
  }

  const ftpPassword =
    input.ftpPassword?.trim() ||
    (typeof previo?.ftp_password === "string" ? previo.ftp_password : "") ||
    null;
  const apiClientSecret =
    input.apiClientSecret?.trim() ||
    (typeof previo?.api_client_secret === "string" ? previo.api_client_secret : "") ||
    null;
  const apiBaseUrl = normalizarBaseUrl(input.apiBaseUrl?.trim() || previo?.api_base_url || null);
  if (input.apiBaseUrl?.trim() && !apiBaseUrl) {
    return { ok: false, error: "La URL de la API tiene que empezar por https://." };
  }

  const { error } = await admin.from("idealista_publicacion_config").upsert({
    id: 1,
    customer_code: customerCode,
    ftp_host: input.ftpHost?.trim() || previo?.ftp_host || null,
    ftp_port: input.ftpPort ?? previo?.ftp_port ?? 21,
    ftp_user: input.ftpUser?.trim() || previo?.ftp_user || null,
    ftp_password: ftpPassword,
    ftp_secure: input.ftpSecure ?? previo?.ftp_secure ?? true,
    contact_name: input.contactName?.trim() || previo?.contact_name || null,
    contact_email: input.contactEmail?.trim() || previo?.contact_email || null,
    contact_phone: input.contactPhone?.trim() || previo?.contact_phone || null,
    api_client_id: input.apiClientId?.trim() || previo?.api_client_id || null,
    api_client_secret: apiClientSecret,
    api_base_url: apiBaseUrl,
    updated_at: new Date().toISOString(),
    updated_by: input.userId,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

function normalizarBaseUrl(valor: string | null | undefined): string | null {
  const url = (valor ?? "").trim().replace(/\/$/, "");
  if (!url) return null;
  if (!/^https:\/\/.+/i.test(url)) return null;
  return url;
}

export function configListaParaApi(cfg: IdealistaPublicacionConfig): boolean {
  return Boolean(
    cfg.customerCode &&
      /^ilc[a-f0-9]{40}$/i.test(cfg.customerCode) &&
      cfg.apiClientId &&
      cfg.apiClientSecret &&
      cfg.apiBaseUrl &&
      /^https:\/\/.+/i.test(cfg.apiBaseUrl)
  );
}

export function configListaParaFtp(cfg: IdealistaPublicacionConfig): boolean {
  return Boolean(
    cfg.customerCode &&
      /^ilc[a-f0-9]{40}$/i.test(cfg.customerCode) &&
      cfg.ftpHost &&
      cfg.ftpUser &&
      cfg.ftpPassword
  );
}
