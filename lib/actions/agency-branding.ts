"use server";

import { revalidatePath } from "next/cache";
import { isAdmin, parseRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type MarcaGuardada = {
  name: string;
  color: string;
  pdf_theme: "light" | "dark";
  phone: string | null;
  email: string | null;
  web: string | null;
  logo_light_path: string | null;
  logo_dark_path: string | null;
};

type Result = { ok: true } | { ok: false; error: string };

export async function guardarMarcaAgencia(formData: FormData): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Debes iniciar sesión." };
  const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!isAdmin(parseRole(perfil?.role))) return { ok: false, error: "Solo quien administra la agencia puede cambiar la marca." };

  const { data: tenantId, error: tenantError } = await supabase.rpc("avm_current_tenant");
  if (tenantError || typeof tenantId !== "string") return { ok: false, error: "Sin agencia." };

  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "").trim();
  const theme = String(formData.get("pdf_theme") ?? "light");
  if (!name) return { ok: false, error: "Falta el nombre de la agencia." };
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return { ok: false, error: "El color tiene que ser un hexadecimal de 6 dígitos." };
  if (theme !== "light" && theme !== "dark") return { ok: false, error: "Tema no válido." };

  const { data: actual } = await supabase
    .from("agency_branding")
    .select("logo_light_path, logo_dark_path")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const admin = createAdminClient();
  const logoLight = await subirLogo(admin, tenantId, formData.get("logo_light"), "logo-light", actual?.logo_light_path ?? null);
  const logoDark = await subirLogo(admin, tenantId, formData.get("logo_dark"), "logo-dark", actual?.logo_dark_path ?? null);
  if (esError(logoLight)) return logoLight;
  if (esError(logoDark)) return logoDark;

  const { error } = await supabase.from("agency_branding").upsert({
    tenant_id: tenantId,
    name,
    color,
    pdf_theme: theme,
    phone: vacio(formData.get("phone")),
    email: vacio(formData.get("email")),
    web: vacio(formData.get("web")),
    logo_light_path: logoLight,
    logo_dark_path: logoDark,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/valoraciones/ajustes");
  return { ok: true };
}

function esError(value: string | null | Result): value is Result {
  return typeof value === "object" && value !== null && "ok" in value;
}

function vacio(value: FormDataEntryValue | null): string | null {
  const texto = String(value ?? "").trim();
  return texto || null;
}

async function subirLogo(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  entry: FormDataEntryValue | null,
  nombre: string,
  anterior: string | null,
): Promise<string | null | Result> {
  if (!(entry instanceof File) || entry.size === 0) return anterior;
  if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(entry.type)) {
    return { ok: false, error: "El logo tiene que ser PNG, JPG, WEBP o SVG." };
  }
  const ext = entry.type === "image/svg+xml" ? "svg" : entry.type === "image/jpeg" ? "jpg" : entry.type === "image/webp" ? "webp" : "png";
  const ruta = `${tenantId}/branding/${nombre}.${ext}`;
  const bytes = Buffer.from(await entry.arrayBuffer());
  const { error } = await admin.storage.from("avm-reports").upload(ruta, bytes, { contentType: entry.type, upsert: true });
  if (error) return { ok: false, error: error.message };
  return ruta;
}
