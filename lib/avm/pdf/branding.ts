import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MarcaPdf, PdfThemeName } from "./model";

export type BrandingRow = {
  tenant_id: string;
  name: string;
  logo_light_path: string | null;
  logo_dark_path: string | null;
  color: string;
  pdf_theme: PdfThemeName;
  phone: string | null;
  email: string | null;
  web: string | null;
};

const BUCKET = "avm-reports";

export async function leerLogo(ruta: string | null, admin: SupabaseClient): Promise<Buffer | null> {
  if (!ruta) return null;
  if (ruta.startsWith("/images/")) {
    try {
      return await readFile(path.join(process.cwd(), "public", ruta));
    } catch {
      return null;
    }
  }
  const { data, error } = await admin.storage.from(BUCKET).download(ruta);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

export async function marcaDeAgencia(
  admin: SupabaseClient,
  tenantId: string,
  agente: { nombre: string | null; telefono: string | null } | null,
): Promise<MarcaPdf> {
  const { data } = await admin.from("agency_branding").select("*").eq("tenant_id", tenantId).maybeSingle();
  const row = data as BrandingRow | null;
  const name = row?.name || "Agencia";
  const [logoLight, logoDark] = await Promise.all([
    leerLogo(row?.logo_light_path ?? null, admin),
    leerLogo(row?.logo_dark_path ?? null, admin),
  ]);
  return {
    name,
    phone: row?.phone ?? null,
    email: row?.email ?? null,
    web: row?.web ?? null,
    color: row?.color || "#121214",
    pdfTheme: row?.pdf_theme === "dark" ? "dark" : "light",
    logoLight,
    logoDark,
    agentName: agente?.nombre?.trim() || "Comercial de la agencia",
    agentPhone: agente?.telefono ?? null,
  };
}

export { BUCKET as BUCKET_INFORMES };
