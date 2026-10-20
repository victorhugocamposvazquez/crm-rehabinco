import { ejecutarVolcadoIdealista } from "@/lib/inmuebles/idealista-publicacion/ejecutar";
import { configListaParaFtp, leerConfigIdealistaPublicacion } from "@/lib/inmuebles/idealista-publicacion/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function cronAutorizado(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return new URL(request.url).searchParams.get("secret") === secret;
}

async function ejecutar(request: Request) {
  if (!cronAutorizado(request)) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  const cfg = await leerConfigIdealistaPublicacion();
  if (!configListaParaFtp(cfg)) {
    return Response.json({ ok: false, error: "Idealista: ILC o FTP incompletos." }, { status: 400 });
  }
  const resultado = await ejecutarVolcadoIdealista();
  return Response.json(resultado, { status: resultado.ok ? 200 : 500 });
}

export async function GET(request: Request) {
  return ejecutar(request);
}

export async function POST(request: Request) {
  return ejecutar(request);
}
