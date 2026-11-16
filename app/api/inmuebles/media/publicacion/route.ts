import { readFile } from "node:fs/promises";
import path from "node:path";
import { SELECT_INMUEBLE_MEDIA } from "@/lib/inmuebles/archivo";
import { exigirEquipoArchivo } from "@/lib/inmuebles/archivo-servidor";
import { renderPublicacion } from "@/lib/inmuebles/publicacion-render";
import { normalizarPlantillaRedes, type FichaParaPublicacion } from "@/lib/inmuebles/publicacion-plantilla";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TOPE_BYTES = 20_000_000;

async function logoPorDefecto(): Promise<Buffer | null> {
  try {
    return await readFile(path.join(process.cwd(), "public/images/logo-web.png"));
  } catch {
    return null;
  }
}

async function logoRemoto(url: string): Promise<Buffer | null> {
  try {
    const respuesta = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!respuesta.ok) return null;
    const bytes = Buffer.from(await respuesta.arrayBuffer());
    return bytes.length && bytes.length < 4_000_000 ? bytes : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const acceso = await exigirEquipoArchivo();
  if (!acceso.user) return Response.json({ ok: false, error: acceso.error }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    propiedadId?: unknown;
    mediaId?: unknown;
    plantilla?: unknown;
  } | null;
  const propiedadId = typeof body?.propiedadId === "string" ? body.propiedadId : "";
  const mediaId = typeof body?.mediaId === "string" ? body.mediaId : "";
  const plantilla = normalizarPlantillaRedes(body?.plantilla);
  if (!propiedadId || !mediaId || !body?.plantilla) {
    return Response.json({ ok: false, error: "Elige una foto y una plantilla." }, { status: 400 });
  }

  const [piso, origen, empresa] = await Promise.all([
    acceso.supabase
      .from("propiedades")
      .select("titulo, localidad, tipo_operacion, precio_venta, precio_alquiler, superficie_m2, superficie_construida, habitaciones, referencia")
      .eq("id", propiedadId)
      .maybeSingle(),
    acceso.supabase
      .from("inmueble_media")
      .select("id, propiedad_id, tipo, path")
      .eq("id", mediaId)
      .eq("propiedad_id", propiedadId)
      .maybeSingle(),
    acceso.supabase.from("empresa_facturacion").select("razon_social, logo_url").limit(1).maybeSingle(),
  ]);

  if (piso.error || !piso.data) return Response.json({ ok: false, error: "No se ha encontrado el piso." }, { status: 404 });
  if (origen.error || !origen.data || (origen.data.tipo !== "foto" && origen.data.tipo !== "retocada")) {
    return Response.json({ ok: false, error: "Elige una foto del anuncio o un retoque." }, { status: 404 });
  }

  const descarga = await acceso.supabase.storage.from("inmuebles").download(origen.data.path);
  if (descarga.error || !descarga.data) {
    return Response.json({ ok: false, error: "No se ha podido leer la foto." }, { status: 400 });
  }
  if (descarga.data.size > TOPE_BYTES) {
    return Response.json({ ok: false, error: "La foto pesa demasiado." }, { status: 400 });
  }

  const marca = empresa.data?.razon_social?.trim() || "Rehabinco";
  const logoUrl = empresa.data?.logo_url?.trim() || "";
  const logo = logoUrl.startsWith("http") ? (await logoRemoto(logoUrl)) ?? (await logoPorDefecto()) : await logoPorDefecto();
  const ficha = piso.data as FichaParaPublicacion;

  let png: Buffer;
  try {
    png = await renderPublicacion({
      foto: Buffer.from(await descarga.data.arrayBuffer()),
      plantilla,
      ficha,
      marca,
      logo,
    });
  } catch {
    return Response.json({ ok: false, error: "No se ha podido componer la publicación." }, { status: 400 });
  }

  const ruta = `${propiedadId}/publicaciones/${crypto.randomUUID()}.png`;
  const subida = await acceso.supabase.storage.from("inmuebles").upload(ruta, png, {
    contentType: "image/png",
    upsert: false,
    cacheControl: "3600",
  });
  if (subida.error) return Response.json({ ok: false, error: subida.error.message }, { status: 400 });

  const { data: ultima } = await acceso.supabase
    .from("inmueble_media")
    .select("orden")
    .eq("propiedad_id", propiedadId)
    .eq("tipo", "publicacion")
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: publica } = acceso.supabase.storage.from("inmuebles").getPublicUrl(ruta);
  const { data: fila, error: alta } = await acceso.supabase
    .from("inmueble_media")
    .insert({
      propiedad_id: propiedadId,
      user_id: acceso.user.id,
      tipo: "publicacion",
      path: ruta,
      url: publica.publicUrl,
      orden: (ultima?.orden ?? -1) + 1,
      portada: false,
      origen_id: origen.data.id,
      retoque: plantilla.formato,
    })
    .select(SELECT_INMUEBLE_MEDIA)
    .single();
  if (alta || !fila) {
    await acceso.supabase.storage.from("inmuebles").remove([ruta]);
    return Response.json({ ok: false, error: alta?.message ?? "No se ha podido guardar la publicación." }, { status: 400 });
  }

  const referencia = ficha.referencia?.trim() || "piso";
  const archivo = plantilla.formato === "ig-historia" ? "instagram-historia" : plantilla.formato === "fb-post" ? "facebook" : "instagram-cuadrado";
  return Response.json({
    ok: true,
    media: fila,
    nombre: `${referencia}-${archivo}.png`,
    pngBase64: png.toString("base64"),
  });
}
