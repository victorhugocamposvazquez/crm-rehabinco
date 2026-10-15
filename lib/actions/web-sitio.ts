"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { isAdmin, parseRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { contenidoDe, esDiseno, esTipoBloque, type ContenidoBloque, type DisenoWeb } from "@/lib/web/modelo";

type Result = { ok: true } | { ok: false; error: string };

const TIPOS_FOTO = new Set(["image/png", "image/jpeg", "image/webp"]);

async function sesionAdmin(): Promise<{ tenantId: string } | Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Debes iniciar sesión." };
  const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!isAdmin(parseRole(perfil?.role))) return { ok: false, error: "Solo dirección puede editar la web." };
  const { data: tenantId, error } = await supabase.rpc("avm_current_tenant");
  if (error || typeof tenantId !== "string") return { ok: false, error: "Sin agencia." };
  return { tenantId };
}

function fallo(valor: { tenantId: string } | Result): valor is Result {
  return "ok" in valor;
}

function refrescar() {
  revalidatePath("/web");
  revalidatePath("/web/gestionar");
}

export async function cambiarDisenoWeb(diseno: DisenoWeb): Promise<Result> {
  if (!esDiseno(diseno)) return { ok: false, error: "Diseño no válido." };
  const sesion = await sesionAdmin();
  if (fallo(sesion)) return sesion;
  const supabase = await createClient();
  const { error } = await supabase
    .from("web_sitio")
    .update({ diseno, updated_at: new Date().toISOString() })
    .eq("tenant_id", sesion.tenantId);
  if (error) return { ok: false, error: error.message };
  refrescar();
  return { ok: true };
}

export async function cambiarWebPublicada(publicado: boolean): Promise<Result> {
  const sesion = await sesionAdmin();
  if (fallo(sesion)) return sesion;
  const supabase = await createClient();
  const { error } = await supabase
    .from("web_sitio")
    .update({ publicado, updated_at: new Date().toISOString() })
    .eq("tenant_id", sesion.tenantId);
  if (error) return { ok: false, error: error.message };
  refrescar();
  return { ok: true };
}

async function bloqueDe(id: string, tenantId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("web_bloques")
    .select("id, tipo, orden, contenido")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error || !data) return null;
  const fila = data as { id: string; tipo: unknown; orden: number; contenido: unknown };
  if (!esTipoBloque(fila.tipo)) return null;
  return { ...fila, tipo: fila.tipo, contenido: contenidoDe(fila.contenido) };
}

export async function guardarBloqueWeb(id: string, contenido: ContenidoBloque): Promise<Result> {
  const sesion = await sesionAdmin();
  if (fallo(sesion)) return sesion;
  const bloque = await bloqueDe(id, sesion.tenantId);
  if (!bloque) return { ok: false, error: "No está ese bloque." };
  const limpio = contenidoDe(contenido);
  const supabase = await createClient();
  const { error } = await supabase
    .from("web_bloques")
    .update({ contenido: limpio, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", sesion.tenantId);
  if (error) return { ok: false, error: error.message };
  refrescar();
  return { ok: true };
}

export async function cambiarVisibleBloque(id: string, visible: boolean): Promise<Result> {
  const sesion = await sesionAdmin();
  if (fallo(sesion)) return sesion;
  const supabase = await createClient();
  const { error } = await supabase
    .from("web_bloques")
    .update({ visible, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", sesion.tenantId);
  if (error) return { ok: false, error: error.message };
  refrescar();
  return { ok: true };
}

export async function moverBloqueWeb(id: string, direccion: "arriba" | "abajo"): Promise<Result> {
  const sesion = await sesionAdmin();
  if (fallo(sesion)) return sesion;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("web_bloques")
    .select("id, orden")
    .eq("tenant_id", sesion.tenantId)
    .order("orden");
  if (error) return { ok: false, error: error.message };
  const lista = (data ?? []) as Array<{ id: string; orden: number }>;
  const indice = lista.findIndex((b) => b.id === id);
  const vecino = direccion === "arriba" ? indice - 1 : indice + 1;
  if (indice < 0 || vecino < 0 || vecino >= lista.length) return { ok: true };
  const actual = lista[indice];
  const otro = lista[vecino];
  if (!actual || !otro) return { ok: true };
  const ahora = new Date().toISOString();
  const primero = await supabase.from("web_bloques").update({ orden: otro.orden, updated_at: ahora }).eq("id", actual.id);
  const segundo = await supabase.from("web_bloques").update({ orden: actual.orden, updated_at: ahora }).eq("id", otro.id);
  if (primero.error || segundo.error) return { ok: false, error: primero.error?.message || segundo.error?.message || "No se ha podido mover." };
  refrescar();
  return { ok: true };
}

function extension(tipo: string): string {
  if (tipo === "image/jpeg") return "jpg";
  if (tipo === "image/webp") return "webp";
  return "png";
}

async function borrarFoto(path: string | null | undefined) {
  if (!path) return;
  const admin = createAdminClient();
  await admin.storage.from("web").remove([path]);
}

export async function subirFotoBloque(id: string, formData: FormData): Promise<Result> {
  const sesion = await sesionAdmin();
  if (fallo(sesion)) return sesion;
  const bloque = await bloqueDe(id, sesion.tenantId);
  if (!bloque) return { ok: false, error: "No está ese bloque." };
  if (bloque.tipo !== "hero" && bloque.tipo !== "galeria") return { ok: false, error: "Este bloque no lleva foto." };
  const archivo = formData.get("foto");
  if (!(archivo instanceof File) || archivo.size === 0) return { ok: false, error: "Elige una foto." };
  if (!TIPOS_FOTO.has(archivo.type)) return { ok: false, error: "La foto tiene que ser PNG, JPG o WEBP." };
  if (archivo.size > 5 * 1024 * 1024) return { ok: false, error: "La foto pasa de 5 MB." };

  const ruta = `${sesion.tenantId}/${id}/${randomUUID()}.${extension(archivo.type)}`;
  const bytes = Buffer.from(await archivo.arrayBuffer());
  const admin = createAdminClient();
  const { error: subida } = await admin.storage.from("web").upload(ruta, bytes, { contentType: archivo.type, upsert: false });
  if (subida) return { ok: false, error: subida.message };
  const { data: publica } = admin.storage.from("web").getPublicUrl(ruta);
  const url = publica.publicUrl;
  const contenido = bloque.contenido;
  const siguiente: ContenidoBloque =
    bloque.tipo === "hero"
      ? { ...contenido, imagen_url: url, imagen_path: ruta }
      : { ...contenido, imagenes: [...contenido.imagenes, { url, alt: "", path: ruta }] };
  if (bloque.tipo === "hero") await borrarFoto(contenido.imagen_path);
  const supabase = await createClient();
  const { error } = await supabase
    .from("web_bloques")
    .update({ contenido: siguiente, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", sesion.tenantId);
  if (error) return { ok: false, error: error.message };
  refrescar();
  return { ok: true };
}

export async function quitarFotoBloque(id: string, path: string): Promise<Result> {
  const sesion = await sesionAdmin();
  if (fallo(sesion)) return sesion;
  const bloque = await bloqueDe(id, sesion.tenantId);
  if (!bloque) return { ok: false, error: "No está ese bloque." };
  const contenido = bloque.contenido;
  const siguiente: ContenidoBloque =
    contenido.imagen_path === path
      ? { ...contenido, imagen_url: null, imagen_path: null }
      : { ...contenido, imagenes: contenido.imagenes.filter((foto) => foto.path !== path) };
  await borrarFoto(path);
  const supabase = await createClient();
  const { error } = await supabase
    .from("web_bloques")
    .update({ contenido: siguiente, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", sesion.tenantId);
  if (error) return { ok: false, error: error.message };
  refrescar();
  return { ok: true };
}
