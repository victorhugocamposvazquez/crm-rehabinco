import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { estudioEnPrueba } from "@/lib/auth/roles";
import { exigirEquipoArchivo } from "@/lib/inmuebles/archivo-servidor";
import type { CreativeState } from "@/lib/estudio/data";
import type { FormatId } from "@/lib/estudio/config";
import type { Json } from "@/lib/supabase/types";

export const maxDuration = 60;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORMATOS: FormatId[] = ["post", "feed", "reel", "story", "fb"];

export async function POST(req: Request) {
  const acceso = await exigirEquipoArchivo();
  if (acceso.error || !acceso.user) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  const { data: perfil } = await acceso.supabase.from("profiles").select("role").eq("id", acceso.user.id).maybeSingle();
  if (estudioEnPrueba(perfil?.role)) {
    return NextResponse.json({ ok: false, error: "En modo prueba no se guarda el diseño." }, { status: 403 });
  }
  const form = await req.formData();
  const propiedadId = String(form.get("propiedadId") || "");
  const estadoRaw = String(form.get("estado") || "");
  const texto = String(form.get("texto") || "");
  if (!propiedadId || !estadoRaw) {
    return NextResponse.json({ ok: false, error: "Faltan datos." }, { status: 400 });
  }
  let estado: CreativeState & { slides?: { template?: string }[] };
  try {
    estado = JSON.parse(estadoRaw) as CreativeState & { slides?: { template?: string }[] };
  } catch {
    return NextResponse.json({ ok: false, error: "El estado no es válido." }, { status: 400 });
  }
  const plantilla = estado.template || estado.slides?.[0]?.template || "galeria";
  const objetivo = estado.goal || "nuevo";
  const { data: propiedad } = await acceso.supabase.from("propiedades").select("id").eq("id", propiedadId).is("deleted_at", null).maybeSingle();
  if (!propiedad) {
    return NextResponse.json({ ok: false, error: "No encuentro ese inmueble." }, { status: 404 });
  }

  const id = randomUUID();
  const archivos: Record<string, string> = {};
  for (const formato of FORMATOS) {
    const archivo = form.get(`png_${formato}`);
    if (!(archivo instanceof File) || archivo.size === 0) continue;
    const path = `${propiedadId}/creatividades/${id}/${formato}.png`;
    const { error } = await acceso.supabase.storage.from("inmuebles").upload(path, archivo, {
      contentType: "image/png",
      upsert: false,
    });
    if (error) {
      return NextResponse.json({ ok: false, error: "No se ha podido guardar la imagen." }, { status: 500 });
    }
    archivos[formato] = path;
  }
  for (let i = 0; i < 10; i += 1) {
    const archivo = form.get(`png_pieza_${i}`);
    if (!(archivo instanceof File) || archivo.size === 0) break;
    const path = `${propiedadId}/creatividades/${id}/pieza-${i}.png`;
    const { error } = await acceso.supabase.storage.from("inmuebles").upload(path, archivo, {
      contentType: "image/png",
      upsert: false,
    });
    if (error) {
      return NextResponse.json({ ok: false, error: "No se ha podido guardar la imagen." }, { status: 500 });
    }
    archivos[`pieza_${i}`] = path;
  }

  const { error: insertError } = await acceso.supabase.from("creatividades").insert({
    id,
    propiedad_id: propiedadId,
    autor_id: acceso.user.id,
    estado: estado as unknown as Json,
    objetivo,
    plantilla,
    archivos: archivos as unknown as Json,
    texto_publicacion: texto || null,
  });
  if (insertError) {
    return NextResponse.json({ ok: false, error: "No se ha podido guardar la creatividad." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id });
}
