import { createClient } from "@/lib/supabase/server";
import { webPublicaDe } from "@/lib/web/modelo";
import { combinarCatalogo, inmuebleCrmDe } from "./catalogo";
import type { CatalogoCorporativa, InmuebleCorporativa } from "./types";

async function escaparateCrm(): Promise<InmuebleCorporativa[]> {
  const supabase = await createClient();
  const { data: escaparate, error } = await supabase.rpc("web_escaparate");
  if (error || !Array.isArray(escaparate)) return [];
  return escaparate.flatMap((fila) => {
    if (!fila || typeof fila !== "object") return [];
    const item = inmuebleCrmDe(fila as Record<string, unknown>);
    return item ? [item] : [];
  });
}

async function sitioPublicado(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("web_publica");
  return webPublicaDe(data)?.sitio.publicado === true;
}

export async function cargarCatalogoCorporativa(): Promise<CatalogoCorporativa> {
  const [crm, publicado] = await Promise.all([escaparateCrm(), sitioPublicado()]);
  return { publicado, inmuebles: combinarCatalogo(crm) };
}
