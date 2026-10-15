import { isAdmin, parseRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import {
  contenidoDe,
  esDiseno,
  esTipoBloque,
  webPublicaDe,
  type BloqueWeb,
  type EditorWebDatos,
  type WebPublica,
} from "./modelo";

export async function cargarWebPublica(referencia?: string): Promise<WebPublica | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("web_publica", { p_referencia: referencia ?? null });
  if (error) return null;
  return webPublicaDe(data);
}

export async function cargarEditorWeb(): Promise<
  { ok: true; datos: EditorWebDatos } | { ok: false; motivo: "sesion" | "permiso" | "vacio" }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, motivo: "sesion" };
  const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!isAdmin(parseRole(perfil?.role))) return { ok: false, motivo: "permiso" };

  const { data: tenantId } = await supabase.rpc("avm_current_tenant");
  if (typeof tenantId !== "string") return { ok: false, motivo: "vacio" };

  const [sitio, bloques, marca] = await Promise.all([
    supabase.from("web_sitio").select("diseno, publicado, dominio").eq("tenant_id", tenantId).maybeSingle(),
    supabase.from("web_bloques").select("id, tipo, orden, visible, contenido").eq("tenant_id", tenantId).order("orden"),
    supabase.from("agency_branding").select("name, phone, email").eq("tenant_id", tenantId).maybeSingle(),
  ]);

  if (sitio.error || !sitio.data || bloques.error) return { ok: false, motivo: "vacio" };
  const fila = sitio.data as { diseno?: unknown; publicado?: unknown; dominio?: unknown };
  if (!esDiseno(fila.diseno)) return { ok: false, motivo: "vacio" };
  const dominio = typeof fila.dominio === "string" && fila.dominio.trim() ? fila.dominio.trim().toLowerCase() : null;

  const lista = ((bloques.data ?? []) as Array<Record<string, unknown>>).flatMap((row) => {
    if (typeof row.id !== "string" || !esTipoBloque(row.tipo)) return [];
    return [{
      id: row.id,
      tipo: row.tipo,
      orden: typeof row.orden === "number" ? row.orden : 0,
      visible: row.visible !== false,
      contenido: contenidoDe(row.contenido),
    } satisfies BloqueWeb];
  });

  const marcaFila = (marca.data ?? null) as { name?: string | null; phone?: string | null; email?: string | null } | null;
  return {
    ok: true,
    datos: {
      diseno: fila.diseno,
      publicado: fila.publicado === true,
      dominio,
      marca: {
        nombre: marcaFila?.name?.trim() || "Rehabinco",
        telefono: marcaFila?.phone ?? null,
        email: marcaFila?.email ?? null,
      },
      bloques: lista.sort((a, b) => a.orden - b.orden),
    },
  };
}
