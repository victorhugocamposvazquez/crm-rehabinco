import { aplicarMarcaAgua, urlOrigenPermitida } from "@/lib/inmuebles/marca-agua";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  const origen = new URL(request.url).searchParams.get("u")?.trim() ?? "";
  if (!origen || !urlOrigenPermitida(origen)) {
    return new Response("Foto no válida.", { status: 400 });
  }

  let respuesta: Response;
  try {
    respuesta = await fetch(origen, {
      headers: { Accept: "image/*,*/*" },
      cache: "force-cache",
    });
  } catch {
    return new Response("No se ha podido leer la foto.", { status: 502 });
  }
  if (!respuesta.ok) {
    return new Response("No se ha podido leer la foto.", { status: 502 });
  }

  const tipo = respuesta.headers.get("content-type") ?? "";
  if (tipo && !tipo.startsWith("image/") && !tipo.includes("octet-stream")) {
    return new Response("El archivo no es una imagen.", { status: 415 });
  }

  const bruto = Buffer.from(await respuesta.arrayBuffer());
  if (!bruto.length) return new Response("Foto vacía.", { status: 502 });

  let marcada: Buffer;
  try {
    marcada = await aplicarMarcaAgua(bruto);
  } catch {
    return new Response("No se ha podido poner la marca de agua.", { status: 500 });
  }

  return new Response(new Uint8Array(marcada), {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=2592000, stale-while-revalidate=86400, immutable",
    },
  });
}
