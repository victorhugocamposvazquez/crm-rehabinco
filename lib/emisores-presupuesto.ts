import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type EmisorPresupuestoSlug = "rehabinco" | "garal";

export type EmisorPresupuesto = {
  id: string;
  slug: EmisorPresupuestoSlug;
  nombre_corto: string;
  razon_social: string;
  nif: string;
  direccion: string;
  codigo_postal: string;
  localidad: string;
  provincia: string;
  telefono: string;
  email: string;
  iban: string;
  numero_cuenta_bancaria: string;
  logo_url: string;
  activo: boolean;
};

function mapRow(row: Database["public"]["Tables"]["emisores_presupuesto"]["Row"]): EmisorPresupuesto {
  const t = (s: string | null | undefined) => (s?.trim() ? s.trim() : "");
  return {
    id: row.id,
    slug: row.slug,
    nombre_corto: t(row.nombre_corto) || row.slug,
    razon_social: t(row.razon_social),
    nif: t(row.nif),
    direccion: t(row.direccion),
    codigo_postal: t(row.codigo_postal),
    localidad: t(row.localidad),
    provincia: t(row.provincia),
    telefono: t(row.telefono),
    email: t(row.email),
    iban: t(row.iban),
    numero_cuenta_bancaria: t(row.numero_cuenta_bancaria),
    logo_url: t(row.logo_url),
    activo: row.activo,
  };
}

export async function listEmisoresPresupuesto(
  supabase: SupabaseClient<Database>
): Promise<EmisorPresupuesto[]> {
  const { data, error } = await supabase
    .from("emisores_presupuesto")
    .select("*")
    .eq("activo", true)
    .order("nombre_corto");

  if (error || !data) return [];
  return data
    .map(mapRow)
    .sort((a, b) => {
      if (a.slug === "rehabinco") return -1;
      if (b.slug === "rehabinco") return 1;
      return a.nombre_corto.localeCompare(b.nombre_corto, "es");
    });
}

export async function fetchEmisorPresupuesto(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<EmisorPresupuesto | null> {
  const { data, error } = await supabase
    .from("emisores_presupuesto")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data);
}

export async function fetchEmisorPresupuestoPorSlug(
  supabase: SupabaseClient<Database>,
  slug: EmisorPresupuestoSlug
): Promise<EmisorPresupuesto | null> {
  const { data, error } = await supabase
    .from("emisores_presupuesto")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data);
}
