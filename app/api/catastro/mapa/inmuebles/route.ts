import { createClient } from "@/lib/supabase/server";
import { getCatastroClient } from "@/lib/catastro/client";
import type { InmuebleEdificio } from "@/lib/catastro/mapa/inspire";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** GET ?ref=XXXXXXXXXXXXXX → inmuebles de la parcela (Catastro DNPRC, en vivo). */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "Sesión expirada" }, { status: 401 });

  const ref = (new URL(request.url).searchParams.get("ref") ?? "").trim().toUpperCase();
  if (!/^[0-9A-Z]{14}$/.test(ref)) return Response.json({ ok: false, error: "Referencia inválida." }, { status: 400 });
  try {
    const r = await getCatastroClient().consultarReferencia({ refCat: ref });
    if (r.error && !r.results.length) return Response.json({ ok: false, error: r.error.descripcion || "Sin datos." }, { status: 404 });
    const inmuebles: InmuebleEdificio[] = r.results
      .filter((i) => i.referenciaCatastral)
      .map((i) => ({
        ref: i.referenciaCatastral as string,
        planta: i.direccion.planta,
        puerta: i.direccion.puerta,
        escalera: i.direccion.escalera,
        uso: i.uso,
        superficie: i.superficie,
      }));
    return Response.json({ ok: true, ref, inmuebles });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
