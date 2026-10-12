import { avmCronAutorizado } from "@/lib/avm/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function responder(request: Request): Promise<Response> {
  if (!avmCronAutorizado(request)) {
    return Response.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  return Response.json({ ok: true, service: "avm" });
}

export async function GET(request: Request) {
  return responder(request);
}

export async function POST(request: Request) {
  return responder(request);
}
