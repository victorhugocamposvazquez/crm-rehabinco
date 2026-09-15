import { buscarMunicipios, etiquetaMunicipio, MIN_LETRAS_LOCALIDAD } from "@/lib/geo/municipios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.trim().length < MIN_LETRAS_LOCALIDAD) {
    return Response.json({ items: [] });
  }
  const items = buscarMunicipios(q, 16).map((m) => ({
    nombre: m.nombre,
    provincia: m.provincia,
    etiqueta: etiquetaMunicipio(m),
  }));
  return Response.json({ items });
}
