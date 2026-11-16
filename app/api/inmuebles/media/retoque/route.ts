import { SELECT_INMUEBLE_MEDIA } from "@/lib/inmuebles/archivo";
import { exigirEquipoArchivo } from "@/lib/inmuebles/archivo-servidor";
import { presetRetoque } from "@/lib/inmuebles/retoque-presets";
import { retocarFotoGemini } from "@/lib/inmuebles/retoque-gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TOPE_BYTES = 20_000_000;

export async function POST(request: Request) {
  const acceso = await exigirEquipoArchivo();
  if (!acceso.user) return Response.json({ ok: false, error: acceso.error }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { propiedadId?: unknown; mediaId?: unknown; preset?: unknown } | null;
  const propiedadId = typeof body?.propiedadId === "string" ? body.propiedadId : "";
  const mediaId = typeof body?.mediaId === "string" ? body.mediaId : "";
  const preset = presetRetoque(typeof body?.preset === "string" ? body.preset : "");
  if (!propiedadId || !mediaId || !preset) {
    return Response.json({ ok: false, error: "Elige una foto del anuncio y un retoque." }, { status: 400 });
  }

  const { data: origen, error: lectura } = await acceso.supabase
    .from("inmueble_media")
    .select("id, propiedad_id, tipo, path")
    .eq("id", mediaId)
    .eq("propiedad_id", propiedadId)
    .maybeSingle();
  if (lectura || !origen || origen.tipo !== "foto") {
    return Response.json({ ok: false, error: "Esa foto no está en el anuncio." }, { status: 404 });
  }

  const descarga = await acceso.supabase.storage.from("inmuebles").download(origen.path);
  if (descarga.error || !descarga.data) {
    return Response.json({ ok: false, error: "No se ha podido leer la foto original." }, { status: 400 });
  }
  if (descarga.data.size > TOPE_BYTES) {
    return Response.json({ ok: false, error: "La foto pesa demasiado para retocarla." }, { status: 400 });
  }

  let jpeg: Buffer;
  try {
    jpeg = await retocarFotoGemini({ imagen: Buffer.from(await descarga.data.arrayBuffer()), prompt: preset.prompt });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "No se ha podido retocar la foto.";
    return Response.json({ ok: false, error: mensaje }, { status: 502 });
  }

  const path = `${propiedadId}/retocadas/${crypto.randomUUID()}.jpg`;
  const subida = await acceso.supabase.storage.from("inmuebles").upload(path, jpeg, {
    contentType: "image/jpeg",
    upsert: false,
    cacheControl: "3600",
  });
  if (subida.error) return Response.json({ ok: false, error: subida.error.message }, { status: 400 });

  const { data: ultima } = await acceso.supabase
    .from("inmueble_media")
    .select("orden")
    .eq("propiedad_id", propiedadId)
    .eq("tipo", "retocada")
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();

  const publica = acceso.supabase.storage.from("inmuebles").getPublicUrl(path);
  const { data: fila, error: alta } = await acceso.supabase
    .from("inmueble_media")
    .insert({
      propiedad_id: propiedadId,
      user_id: acceso.user.id,
      tipo: "retocada",
      path,
      url: publica.publicUrl,
      orden: (ultima?.orden ?? -1) + 1,
      portada: false,
      origen_id: origen.id,
      retoque: preset.id,
    })
    .select(SELECT_INMUEBLE_MEDIA)
    .single();
  if (alta || !fila) {
    await acceso.supabase.storage.from("inmuebles").remove([path]);
    return Response.json({ ok: false, error: alta?.message ?? "No se ha podido guardar el retoque." }, { status: 400 });
  }
  return Response.json({ ok: true, media: fila });
}
