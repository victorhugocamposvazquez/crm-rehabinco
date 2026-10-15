import { isAdmin, parseRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import {
  aptoParaWeb,
  contenidoDe,
  esDiseno,
  esTipoBloque,
  webPublicaDe,
  type BloqueWeb,
  type EditorWebDatos,
  type InmuebleWeb,
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

  const [sitio, bloques, marca, inmuebles] = await Promise.all([
    supabase.from("web_sitio").select("diseno, publicado, dominio").eq("tenant_id", tenantId).maybeSingle(),
    supabase.from("web_bloques").select("id, tipo, orden, visible, contenido").eq("tenant_id", tenantId).order("orden"),
    supabase.from("agency_branding").select("name, phone, email, web, logo_light_path, logo_dark_path").eq("tenant_id", tenantId).maybeSingle(),
    supabase
      .from("propiedades")
      .select("referencia, titulo, direccion, localidad, tipo_inmueble, tipo_operacion, precio_venta, precio_alquiler, superficie_construida, superficie_m2, habitaciones, banos, descripcion, estado, publicar_web, inmueble_media(url, portada, orden, tipo)")
      .eq("publicar_web", true),
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

  const marcaFila = (marca.data ?? null) as {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    web?: string | null;
    logo_light_path?: string | null;
    logo_dark_path?: string | null;
  } | null;
  const logoClaro = marcaFila?.logo_light_path?.trim() || null;
  const logoOscuro = marcaFila?.logo_dark_path?.trim() || null;
  return {
    ok: true,
    datos: {
      diseno: fila.diseno,
      publicado: fila.publicado === true,
      dominio,
      logoClaro,
      logoOscuro,
      marca: {
        nombre: marcaFila?.name?.trim() || "Rehabinco",
        telefono: marcaFila?.phone ?? null,
        email: marcaFila?.email ?? null,
        web: marcaFila?.web?.trim() || null,
        logo: fila.diseno === "noche" ? logoOscuro || logoClaro : logoClaro || logoOscuro,
      },
      bloques: lista.sort((a, b) => a.orden - b.orden),
      inmuebles: inmueblesEditor(inmuebles.data),
    },
  };
}

function inmueblesEditor(filas: unknown): InmuebleWeb[] {
  if (!Array.isArray(filas)) return [];
  return filas.flatMap((fila) => {
    if (!fila || typeof fila !== "object") return [];
    const row = fila as Record<string, unknown>;
    const titulo = (typeof row.titulo === "string" && row.titulo.trim()) || (typeof row.direccion === "string" && row.direccion.trim()) || "";
    const superficie = typeof row.superficie_construida === "number" ? row.superficie_construida : typeof row.superficie_m2 === "number" ? row.superficie_m2 : null;
    const item: InmuebleWeb = {
      referencia: typeof row.referencia === "string" ? row.referencia : "",
      titulo,
      localidad: typeof row.localidad === "string" ? row.localidad : "",
      tipo_inmueble: typeof row.tipo_inmueble === "string" ? row.tipo_inmueble : null,
      tipo_operacion: typeof row.tipo_operacion === "string" ? row.tipo_operacion : "venta",
      precio_venta: typeof row.precio_venta === "number" ? row.precio_venta : null,
      precio_alquiler: typeof row.precio_alquiler === "number" ? row.precio_alquiler : null,
      superficie_m2: superficie,
      habitaciones: typeof row.habitaciones === "number" ? row.habitaciones : null,
      banos: typeof row.banos === "number" ? row.banos : null,
      descripcion: typeof row.descripcion === "string" ? row.descripcion : "",
      fotos: fotosDe(row.inmueble_media),
    };
    const estado = typeof row.estado === "string" ? row.estado : null;
    return aptoParaWeb({ ...item, estado }) ? [item] : [];
  }).sort((a, b) => a.referencia.localeCompare(b.referencia));
}

function fotosDe(media: unknown): string[] {
  if (!Array.isArray(media)) return [];
  return media
    .flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const foto = item as { url?: unknown; tipo?: unknown; portada?: unknown; orden?: unknown };
      if (foto.tipo !== "foto" || typeof foto.url !== "string" || !foto.url.trim()) return [];
      return [{
        url: foto.url,
        portada: foto.portada === true,
        orden: typeof foto.orden === "number" ? foto.orden : 0,
      }];
    })
    .sort((a, b) => Number(b.portada) - Number(a.portada) || a.orden - b.orden)
    .map((foto) => foto.url);
}
