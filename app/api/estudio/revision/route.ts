import { isAdmin, parseRole } from "@/lib/auth/roles";
import { publicarAviso } from "@/lib/alertas/publicar";
import { FORMATS, type FormatId } from "@/lib/estudio/config";
import { nombreCorto, textoRevision } from "@/lib/estudio/revision";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_JSON = 200_000;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });

  const { data: perfil } = await supabase
    .from("profiles")
    .select("role, nombre_completo")
    .eq("id", user.id)
    .maybeSingle();
  if (perfil?.role !== "marketing") {
    return NextResponse.json({ ok: false, error: "Solo el editor de marketing pide la revisión." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { propiedadId?: unknown; state?: unknown; nota?: unknown } | null;
  const propiedadId = typeof body?.propiedadId === "string" ? body.propiedadId : "";
  const state = body?.state;
  if (!propiedadId || !state || typeof state !== "object" || Array.isArray(state)) {
    return NextResponse.json({ ok: false, error: "Falta el diseño." }, { status: 400 });
  }
  const serializado = JSON.stringify(state);
  if (serializado.length > MAX_JSON) {
    return NextResponse.json({ ok: false, error: "El diseño es demasiado grande." }, { status: 400 });
  }
  const formatoRaw = "format" in state && typeof (state as { format?: unknown }).format === "string" ? (state as { format: string }).format : "";
  const formato = formatoRaw in FORMATS ? (formatoRaw as FormatId) : "feed";
  const nota = typeof body?.nota === "string" ? body.nota.trim().slice(0, 500) : "";

  const { data: propiedad } = await supabase
    .from("propiedades")
    .select("id, referencia")
    .eq("id", propiedadId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!propiedad) return NextResponse.json({ ok: false, error: "No encuentro ese inmueble." }, { status: 404 });

  const { data: fila, error } = await supabase
    .from("estudio_revisiones")
    .insert({
      propiedad_id: propiedadId,
      autor_id: user.id,
      nota,
      formato,
      publicacion: JSON.parse(serializado) as Json,
    })
    .select("id")
    .single();
  if (error || !fila) {
    return NextResponse.json({ ok: false, error: error?.message || "No se ha podido enviar la revisión." }, { status: 500 });
  }

  const aviso = textoRevision({
    autor: nombreCorto(perfil.nombre_completo, user.email),
    referencia: propiedad.referencia?.trim() || "un inmueble",
    formato,
    id: fila.id,
  });
  const cuerpo = nota ? `${aviso.cuerpo} ${nota}` : aviso.cuerpo;

  try {
    const admin = createAdminClient();
    // De momento solo el superadministrador (Hugo). Para avisar también a los admin, volver a ["admin", "superadmin"].
    const { data: direccion } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "superadmin")
      .eq("activo", true);
    for (const persona of direccion ?? []) {
      await publicarAviso({
        userId: persona.id,
        clave: `estudio-revision:${fila.id}:${persona.id}`,
        titulo: aviso.titulo,
        cuerpo,
        url: aviso.url,
        canal: "estudio",
      });
    }
  } catch (err) {
    console.error("aviso revision estudio:", err instanceof Error ? err.message : err);
  }

  return NextResponse.json({ ok: true, id: fila.id });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!isAdmin(parseRole(perfil?.role))) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ ok: false, error: "Falta la revisión." }, { status: 400 });
  const { data, error } = await supabase
    .from("estudio_revisiones")
    .update({ estado: "vista" })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message || "No se ha podido marcar." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
