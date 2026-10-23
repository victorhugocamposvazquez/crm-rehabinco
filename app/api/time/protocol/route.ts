import { escribirAudit, sesionFichaje } from "@/lib/time/server";

export const runtime = "nodejs";

export async function GET() {
  const sesion = await sesionFichaje();
  if (!sesion) return Response.json({ ok: false, error: "No autenticado." }, { status: 401 });
  const { data } = await sesion.supabase.from("fichaje_protocolo").select("*").eq("id", 1).maybeSingle();
  return Response.json({ ok: true, protocolo: data });
}

export async function POST(request: Request) {
  const sesion = await sesionFichaje();
  if (!sesion?.admin) return Response.json({ ok: false, error: "Solo administración." }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return Response.json({ ok: false, error: "Falta el PDF." }, { status: 400 });
  }

  const path = `protocolo/registro-jornada.pdf`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await sesion.supabase.storage.from("fichajes").upload(path, bytes, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (upErr) return Response.json({ ok: false, error: upErr.message }, { status: 500 });

  const { data, error } = await sesion.supabase
    .from("fichaje_protocolo")
    .update({
      pdf_path: path,
      uploaded_at: new Date().toISOString(),
      uploaded_by: sesion.userId,
    })
    .eq("id", 1)
    .select("*")
    .single();
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  await escribirAudit(sesion.supabase, {
    actorId: sesion.userId,
    actorLabel: sesion.nombre,
    action: "protocolo",
    detail: "Protocolo de registro subido",
    origin: "panel-admin",
  });

  return Response.json({ ok: true, protocolo: data });
}
