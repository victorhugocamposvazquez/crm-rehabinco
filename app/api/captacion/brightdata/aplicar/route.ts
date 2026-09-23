export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sustituido por la ingesta del listado. */
export async function POST() {
  return Response.json({ ok: false, error: "Esta ruta ya no se usa." }, { status: 410 });
}
