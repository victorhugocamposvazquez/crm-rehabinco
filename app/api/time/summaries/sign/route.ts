import { escribirAudit, sesionFichaje } from "@/lib/time/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const sesion = await sesionFichaje();
  if (!sesion) return Response.json({ ok: false, error: "No autenticado." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { month?: string } | null;
  if (!body?.month || !/^\d{4}-\d{2}$/.test(body.month)) {
    return Response.json({ ok: false, error: "Mes no válido." }, { status: 400 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;
  const ua = request.headers.get("user-agent")?.slice(0, 400) ?? null;

  const { data: existing } = await sesion.supabase
    .from("fichaje_monthly_summaries")
    .select("*")
    .eq("user_id", sesion.userId)
    .eq("month", body.month)
    .maybeSingle();

  let row = existing;
  if (!row) {
    const { data: created, error } = await sesion.supabase
      .from("fichaje_monthly_summaries")
      .insert({
        user_id: sesion.userId,
        month: body.month,
        days: 0,
        ordinary_min: 0,
        extra_min: 0,
      })
      .select("*")
      .single();
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    row = created;
  }

  if (row.signed_at) {
    return Response.json({ ok: true, summary: row, already: true });
  }

  const { data: updated, error: updErr } = await sesion.supabase
    .from("fichaje_monthly_summaries")
    .update({
      signed_at: new Date().toISOString(),
      signature_ip: ip,
      signature_ua: ua,
    })
    .eq("id", row.id)
    .select("*")
    .single();
  if (updErr) return Response.json({ ok: false, error: updErr.message }, { status: 500 });

  await escribirAudit(sesion.supabase, {
    actorId: sesion.userId,
    actorLabel: sesion.nombre,
    action: "firma",
    detail: `Firma conformidad ${body.month}`,
    origin: "pwa",
  });

  return Response.json({ ok: true, summary: updated });
}
