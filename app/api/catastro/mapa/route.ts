import { createClient } from "@/lib/supabase/server";
import { parseRecuadro } from "@/lib/catastro/mapa/inspire";
import { edificiosDeRecuadro } from "@/lib/catastro/mapa/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

/** GET ?bbox=sur,oeste,norte,este → edificios y portales del Catastro en ese recuadro. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "Sesión expirada" }, { status: 401 });

  const recuadro = parseRecuadro(new URL(request.url).searchParams.get("bbox"));
  if (!recuadro) {
    return Response.json({ ok: false, error: "Acerca más el mapa para ver los edificios." }, { status: 400 });
  }
  try {
    const r = await edificiosDeRecuadro(recuadro);
    return Response.json({ ok: true, recuadro, ...r });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: `El Catastro no responde ahora mismo (${msg}).` }, { status: 502 });
  }
}
