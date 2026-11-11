import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupportProjectManifest } from "@/lib/support/project-manifest";
import { obtenerOCrearAjustesProyecto, obtenerUsuarioSesionSoporte } from "@/lib/support/service";
import { empresaTieneSoporteActivo } from "@/lib/support/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export async function POST(request: Request) {
  const user = await obtenerUsuarioSesionSoporte();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const manifest = getSupportProjectManifest();
  const settings = await obtenerOCrearAjustesProyecto(manifest.projectKey);
  const evaluacion = empresaTieneSoporteActivo(settings);
  if (!user.isSuperadmin && !evaluacion.activo) {
    return NextResponse.json({ ok: false, error: evaluacion.motivo || "Plan de soporte inactivo." }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Archivo no recibido." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "La imagen supera los 5 MB." }, { status: 400 });
  }

  const mime = file.type || "image/png";
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json({ ok: false, error: "Formato no admitido (usa PNG, JPG, WEBP o GIF)." }, { status: 400 });
  }

  const ext = mime.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "png";
  const safeName = (file.name || `captura.${ext}`).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const admin = createAdminClient();
  const { error } = await admin.storage.from("support-attachments").upload(path, buffer, {
    contentType: mime,
    upsert: false,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const { data: signed } = await admin.storage.from("support-attachments").createSignedUrl(path, 3600);

  return NextResponse.json({
    ok: true,
    attachment: {
      path,
      nombre: safeName,
      mime,
      signedUrl: signed?.signedUrl,
    },
  });
}
