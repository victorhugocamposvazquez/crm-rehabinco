import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { exigirEquipoArchivo } from "@/lib/inmuebles/archivo-servidor";
import type { FormatId } from "@/lib/estudio/config";
import { instagramConfigurado, repartoInstagram } from "@/lib/estudio/instagram";
import { borrarCuentaInstagram, leerCuentaInstagram, publicarEnInstagram, refrescarSiHaceFalta } from "@/lib/estudio/instagram-publicar";
import type { Json } from "@/lib/supabase/types";
import type { CreativeState } from "@/lib/estudio/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const ORDEN: FormatId[] = ["post", "feed", "fb", "story"];

export async function GET() {
  const acceso = await exigirEquipoArchivo();
  if (acceso.error || !acceso.user) return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  const cuenta = await leerCuentaInstagram().catch(() => null);
  return NextResponse.json({
    ok: true,
    configurado: instagramConfigurado(),
    conectado: Boolean(cuenta),
    username: cuenta?.username ?? null,
  });
}

export async function DELETE() {
  const acceso = await exigirEquipoArchivo();
  if (acceso.error || !acceso.user) return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  await borrarCuentaInstagram();
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  const acceso = await exigirEquipoArchivo();
  if (acceso.error || !acceso.user) return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  if (!instagramConfigurado()) {
    return NextResponse.json({ ok: false, error: "Falta la app de Instagram en el servidor." }, { status: 400 });
  }
  const cuenta = await leerCuentaInstagram().catch(() => null);
  if (!cuenta) {
    return NextResponse.json({ ok: false, error: "Instagram no está conectado. Enlázalo en Ajustes → Publicación." }, { status: 400 });
  }

  const form = await req.formData();
  const propiedadId = String(form.get("propiedadId") || "");
  const texto = String(form.get("texto") || "").slice(0, 2200);
  const estadoRaw = String(form.get("estado") || "");
  if (!propiedadId) return NextResponse.json({ ok: false, error: "Falta el inmueble." }, { status: 400 });

  const { data: propiedad } = await acceso.supabase.from("propiedades").select("id").eq("id", propiedadId).is("deleted_at", null).maybeSingle();
  if (!propiedad) return NextResponse.json({ ok: false, error: "No encuentro ese inmueble." }, { status: 404 });

  const id = randomUUID();
  const rutas: Partial<Record<FormatId, string>> = {};
  const urls: Partial<Record<FormatId, string>> = {};
  for (const formato of ORDEN) {
    const archivo = form.get(`png_${formato}`);
    if (!(archivo instanceof File) || archivo.size === 0) continue;
    const path = `${propiedadId}/creatividades/${id}/${formato}.png`;
    const { error } = await acceso.supabase.storage.from("inmuebles").upload(path, archivo, { contentType: "image/png", upsert: false });
    if (error) return NextResponse.json({ ok: false, error: "No se ha podido preparar la imagen." }, { status: 500 });
    rutas[formato] = path;
    urls[formato] = acceso.supabase.storage.from("inmuebles").getPublicUrl(path).data.publicUrl;
  }

  const elegidos = ORDEN.filter((f) => urls[f]);
  const reparto = repartoInstagram(elegidos);
  if (!reparto.feed.length && !reparto.historia.length) {
    return NextResponse.json({ ok: false, error: "Elige al menos un formato." }, { status: 400 });
  }

  try {
    const vigente = await refrescarSiHaceFalta(cuenta);
    await publicarEnInstagram(vigente, {
      feed: reparto.feed.map((f) => urls[f]!),
      historia: reparto.historia[0] ? urls[reparto.historia[0]]! : null,
      texto,
    });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Instagram no ha publicado.";
    return NextResponse.json({ ok: false, error: mensaje }, { status: 502 });
  }

  let estado: CreativeState | null = null;
  try { estado = JSON.parse(estadoRaw) as CreativeState; } catch { estado = null; }
  if (estado) {
    await acceso.supabase.from("creatividades").insert({
      id,
      propiedad_id: propiedadId,
      autor_id: acceso.user.id,
      estado: estado as unknown as Json,
      objetivo: estado.goal,
      plantilla: estado.template,
      archivos: rutas as unknown as Json,
      texto_publicacion: texto || null,
    });
  }
  return NextResponse.json({ ok: true });
}
