import { createClient } from "@/lib/supabase/server";
import { vapidPublica } from "@/lib/alertas/config";

export const runtime = "nodejs";

export async function GET() {
  const key = vapidPublica();
  if (!key) return Response.json({ key: null });
  return Response.json({ key });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const cuerpo = (await request.json()) as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  if (!cuerpo.endpoint || !cuerpo.keys?.p256dh || !cuerpo.keys?.auth) {
    return Response.json({ ok: false, error: "Suscripción incompleta." }, { status: 400 });
  }
  const { error } = await supabase.from("crm_push_subs").upsert(
    {
      user_id: user.id,
      endpoint: cuerpo.endpoint,
      p256dh: cuerpo.keys.p256dh,
      auth: cuerpo.keys.auth,
    },
    { onConflict: "endpoint" }
  );
  if (error) return Response.json({ ok: false, error: error.message }, { status: 400 });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const cuerpo = (await request.json().catch(() => null)) as { endpoint?: string } | null;
  if (cuerpo?.endpoint) {
    await supabase.from("crm_push_subs").delete().eq("user_id", user.id).eq("endpoint", cuerpo.endpoint);
  } else {
    await supabase.from("crm_push_subs").delete().eq("user_id", user.id);
  }
  return Response.json({ ok: true });
}
