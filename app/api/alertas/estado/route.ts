import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin, parseRole } from "@/lib/auth/roles";
import { estadoSistemaAvisos } from "@/lib/alertas/estado-sistema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!isSuperAdmin(parseRole(profile?.role))) {
    return NextResponse.json({ ok: false, error: "Solo el superadministrador." }, { status: 403 });
  }

  try {
    const estado = await estadoSistemaAvisos();
    return NextResponse.json({ ok: true, ...estado });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo leer el estado." },
      { status: 500 }
    );
  }
}
