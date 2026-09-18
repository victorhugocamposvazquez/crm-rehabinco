export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cron eliminado: el scheduler vive en el worker crawler. */
export async function GET() {
  return Response.json(
    { ok: false, error: "Cron desactivado. Usa el worker crawler." },
    { status: 410 }
  );
}

export async function POST() {
  return GET();
}
