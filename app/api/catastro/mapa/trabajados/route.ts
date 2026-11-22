import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REF = /^[0-9A-Z]{14}$/;

async function sesion() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** GET ?refs=A,B,C → cuáles de esas parcelas tienes marcadas como trabajadas. */
export async function GET(request: Request) {
  const { supabase, user } = await sesion();
  if (!user) return Response.json({ ok: false, error: "Sesión expirada" }, { status: 401 });
  const refs = (new URL(request.url).searchParams.get("refs") ?? "")
    .split(",")
    .map((r) => r.trim().toUpperCase())
    .filter((r) => REF.test(r))
    .slice(0, 2000);
  if (!refs.length) return Response.json({ ok: true, trabajados: [] });
  const { data, error } = await supabase
    .from("catastro_mapa_trabajados")
    .select("parcel_ref")
    .eq("user_id", user.id)
    .in("parcel_ref", refs);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, trabajados: (data ?? []).map((r) => r.parcel_ref) });
}

/** PUT { ref, trabajado } → marca o desmarca la parcela. */
export async function PUT(request: Request) {
  const { supabase, user } = await sesion();
  if (!user) return Response.json({ ok: false, error: "Sesión expirada" }, { status: 401 });
  let cuerpo: { ref?: unknown; trabajado?: unknown } = {};
  try {
    cuerpo = (await request.json()) as typeof cuerpo;
  } catch {
    return Response.json({ ok: false, error: "Cuerpo inválido." }, { status: 400 });
  }
  const ref = typeof cuerpo.ref === "string" ? cuerpo.ref.trim().toUpperCase() : "";
  if (!REF.test(ref) || typeof cuerpo.trabajado !== "boolean") {
    return Response.json({ ok: false, error: "Marca inválida." }, { status: 400 });
  }
  const q = cuerpo.trabajado
    ? supabase.from("catastro_mapa_trabajados").upsert({ user_id: user.id, parcel_ref: ref }, { onConflict: "user_id,parcel_ref", ignoreDuplicates: true })
    : supabase.from("catastro_mapa_trabajados").delete().eq("user_id", user.id).eq("parcel_ref", ref);
  const { error } = await q;
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, ref, trabajado: cuerpo.trabajado });
}
