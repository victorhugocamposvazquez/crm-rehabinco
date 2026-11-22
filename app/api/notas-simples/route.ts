import { notaReutilizable, validarSolicitud, type NotaResumen } from "@/lib/notas-simples/modelo";
import { proveedorActivo } from "@/lib/notas-simples/proveedor";
import { COLUMNAS_NOTA, sesionNotas, sinSesion } from "@/lib/notas-simples/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Listado de notas simples del equipo (las 300 más recientes). */
export async function GET() {
  const { supabase, user } = await sesionNotas();
  if (!user) return sinSesion();
  const { data, error } = await supabase.from("notas_simples").select(COLUMNAS_NOTA).order("created_at", { ascending: false }).limit(300);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, notas: data ?? [] });
}

/**
 * Pide una nota simple. Si ya hay una de la misma finca en curso o recibida en
 * los últimos 90 días, la devuelve (409) para no pagarla dos veces, salvo `forzar`.
 */
export async function POST(request: Request) {
  const { supabase, user } = await sesionNotas();
  if (!user) return sinSesion();
  let cuerpo: Record<string, unknown> = {};
  try {
    cuerpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "Cuerpo inválido." }, { status: 400 });
  }
  const v = validarSolicitud(cuerpo);
  if (!v.ok) return Response.json({ ok: false, error: v.errores.join(" "), errores: v.errores }, { status: 400 });
  const s = v.solicitud;

  if (cuerpo.forzar !== true && (s.refCatastral || s.idufir)) {
    let q = supabase.from("notas_simples").select("id, estado, ref_catastral, idufir, recibida_en, created_at").limit(50);
    q = s.refCatastral ? q.like("ref_catastral", `${s.refCatastral.slice(0, 14)}%`) : q.eq("idufir", s.idufir!);
    const { data } = await q;
    const previa = notaReutilizable((data ?? []) as NotaResumen[], s);
    if (previa) return Response.json({ ok: false, duplicada: previa, error: "Ya hay una nota de esta finca." }, { status: 409 });
  }

  const proveedor = proveedorActivo();
  const { data, error } = await supabase
    .from("notas_simples")
    .insert({
      user_id: user.id,
      propiedad_id: s.propiedadId,
      ref_catastral: s.refCatastral,
      idufir: s.idufir,
      finca_registral: s.fincaRegistral,
      registro: s.registro,
      direccion: s.direccion,
      municipio: s.municipio,
      provincia: s.provincia,
      titular: s.titular,
      motivo: s.motivo,
      motivo_texto: s.motivoTexto,
      estado: "solicitada",
      proveedor: proveedor.id,
      coste_cents: proveedor.precioCents,
    })
    .select(COLUMNAS_NOTA)
    .single();
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, nota: data, instrucciones: proveedor.instrucciones(s) });
}
