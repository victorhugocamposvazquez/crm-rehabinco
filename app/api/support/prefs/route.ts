import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolverEmailPreferidoUsuario } from "@/lib/support/mailer";
import { obtenerUsuarioSesionSoporte } from "@/lib/support/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await obtenerUsuarioSesionSoporte();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const pref = await resolverEmailPreferidoUsuario(user.id, user.email);
  return NextResponse.json({
    ok: true,
    alertEmail: pref.email || user.email || "",
    notifyEmail: pref.notifyEmail,
  });
}

export async function PUT(request: Request) {
  const user = await obtenerUsuarioSesionSoporte();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    alertEmail?: string;
    notifyEmail?: boolean;
  } | null;

  const email = (body?.alertEmail ?? "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { ok: false, error: "Introduce una dirección de correo válida." },
      { status: 400 }
    );
  }

  const notifyEmail = body?.notifyEmail !== false;
  const admin = createAdminClient();
  const { error } = await admin.from("support_user_prefs").upsert(
    {
      user_id: user.id,
      alert_email: email || user.email || null,
      notify_email: notifyEmail,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Actualizar también el email de contacto en sus tickets abiertos para que las respuestas siguientes vayan al nuevo correo
  if (email) {
    await admin
      .from("support_tickets")
      .update({ user_email: email })
      .eq("user_id", user.id)
      .not("estado", "in", '("resuelto","cerrado")');
  }

  return NextResponse.json({
    ok: true,
    alertEmail: email || user.email || "",
    notifyEmail,
  });
}
