import { createClient } from "@/lib/supabase/server";
import { type InmuebleWeb, webPublicaDe } from "@/lib/web/modelo";
import { combinarCatalogo, inmuebleCrmDe } from "./catalogo";
import type { CatalogoCorporativa, InmuebleCorporativa } from "./types";

function inmueblesDeWeb(lista: InmuebleWeb[]): InmuebleCorporativa[] {
  return lista.flatMap((item) => {
    const fila = inmuebleCrmDe({
      referencia: item.referencia,
      titulo: item.titulo,
      localidad: item.localidad,
      tipo_inmueble: item.tipo_inmueble,
      tipo_operacion: item.tipo_operacion,
      precio_venta: item.precio_venta,
      precio_alquiler: item.precio_alquiler,
      superficie_m2: item.superficie_m2,
      habitaciones: item.habitaciones,
      banos: item.banos,
      descripcion: item.descripcion,
      fotos: item.fotos,
    });
    return fila ? [fila] : [];
  });
}

async function escaparatePublicarWeb(): Promise<InmuebleCorporativa[]> {
  const supabase = await createClient();
  const { data: escaparate, error } = await supabase.rpc("web_escaparate");
  if (error || !Array.isArray(escaparate)) return [];
  return escaparate.flatMap((fila) => {
    if (!fila || typeof fila !== "object") return [];
    const item = inmuebleCrmDe(fila as Record<string, unknown>);
    return item ? [item] : [];
  });
}

export async function cargarCatalogoCorporativa(): Promise<CatalogoCorporativa> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("web_publica");
  const web = webPublicaDe(data);
  const publicado = web?.sitio.publicado === true;

  const crm =
    publicado && web ? inmueblesDeWeb(web.inmuebles) : await escaparatePublicarWeb();

  return { publicado, inmuebles: combinarCatalogo(crm) };
}
