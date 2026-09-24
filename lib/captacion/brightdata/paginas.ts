import { aplicarFicha, marcarFichaPendiente } from "@/lib/captacion/brightdata/fichas";
import { ingestarIdealistaBrightData } from "@/lib/captacion/brightdata/ingestar";
import { parsearListadoIdealista } from "@/lib/captacion/brightdata/parse-listado";
import { anotarLote, cerrarRecogidaLocal, sumarVistos } from "@/lib/captacion/brightdata/recogidas";
import { configUnlocker, pedirHtmlUnlocker } from "@/lib/captacion/brightdata/unlocker";
import { ZONA_PROVINCIA_48H } from "@/lib/captacion/brightdata/zonas";
import { createAdminClient } from "@/lib/supabase/admin";

const TOPE = 60;

type Pagina = {
  id: string;
  recogida_id: string | null;
  url: string;
  zona_id: string;
  page: number;
  tipo?: string | null;
};

export async function encolarPaginas(
  recogidaId: string,
  paginas: Array<{ url: string; zona_id: string; page: number }>
): Promise<void> {
  if (paginas.length === 0) return;
  const { error } = await createAdminClient()
    .from("captacion_paginas_pendientes")
    .upsert(
      paginas.map((pagina) => ({
        recogida_id: recogidaId,
        url: pagina.url,
        zona_id: pagina.zona_id,
        page: pagina.page,
        estado: "pendiente",
      })),
      { onConflict: "recogida_id,url", ignoreDuplicates: true }
    );
  if (error) throw new Error(error.message);
}

/** Hasta 20 páginas pendientes. Cierra la recogida cuando no queda ninguna. */
export async function procesarPaginasPendientes(limite = 20): Promise<{ paginas: number; cerradas: string[] }> {
  const config = configUnlocker();
  if ("error" in config) throw new Error(config.error);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("captacion_paginas_pendientes")
    .select("id, recogida_id, url, zona_id, page, tipo")
    .eq("estado", "pendiente")
    .or(`reintentar_en.is.null,reintentar_en.lte.${new Date().toISOString()}`)
    .order("prioridad", { ascending: true })
    .order("page", { ascending: true })
    .limit(limite);
  if (error) throw new Error(error.message);
  const paginas = (data ?? []) as Pagina[];
  const tocadas = new Set<string>();
  for (const pagina of paginas) {
    if (pagina.tipo === "ficha") {
      try {
        const html = await pedirHtmlUnlocker(config, pagina.url);
        const resultado = await aplicarFicha(html, pagina.url);
        await supabase
          .from("captacion_paginas_pendientes")
          .update({ estado: resultado === "ok" ? "hecha" : "pendiente" })
          .eq("id", pagina.id);
        if (resultado !== "ok") await marcarFichaPendiente((pagina.url.match(/\/inmueble\/(\d+)/) || [])[1] ?? "");
      } catch {
        await marcarFichaPendiente((pagina.url.match(/\/inmueble\/(\d+)/) || [])[1] ?? "");
      }
      continue;
    }
    if (pagina.recogida_id) tocadas.add(pagina.recogida_id);
    try {
      const html = await pedirHtmlUnlocker(config, pagina.url);
      const listado = parsearListadoIdealista(html, pagina.url);
      const n = listado.items.length;
      const sinListado = n === 0 && !listado.sin_resultados;
      const registros = (n === 0 ? [{}] : listado.items).map((item) => ({
        ...item,
        zona_url: pagina.url,
        zona_id: pagina.zona_id,
        page: pagina.page,
        final_url: listado.final_url,
        sin_listado: sinListado,
        items_en_pagina: n,
      }));
      await ingestarIdealistaBrightData(registros);
      if (pagina.recogida_id && pagina.zona_id !== ZONA_PROVINCIA_48H) {
        await anotarLote(pagina.recogida_id, registros);
        await sumarVistos(pagina.recogida_id, pagina.zona_id, listado.items.map((item) => item.externo_id), sinListado);
      }
      if (pagina.recogida_id && listado.next_url && pagina.page < TOPE) {
        await encolarPaginas(pagina.recogida_id, [{ url: listado.next_url, zona_id: pagina.zona_id, page: pagina.page + 1 }]);
      } else if (pagina.recogida_id && listado.next_url && pagina.page >= TOPE) {
        await supabase.from("captacion_recogidas").update({ incompleta: true }).eq("collection_id", pagina.recogida_id);
      }
      await supabase.from("captacion_paginas_pendientes").update({ estado: "hecha" }).eq("id", pagina.id);
    } catch (error) {
      await supabase.from("captacion_paginas_pendientes").update({ estado: "error" }).eq("id", pagina.id);
      if (pagina.zona_id !== ZONA_PROVINCIA_48H) await sumarVistos(pagina.recogida_id, pagina.zona_id, [], true);
      console.error(error instanceof Error ? error.message : "Página de listado fallida");
    }
  }
  const cerradas: string[] = [];
  for (const recogidaId of tocadas) {
    const { count } = await supabase
      .from("captacion_paginas_pendientes")
      .select("id", { count: "exact", head: true })
      .eq("recogida_id", recogidaId)
      .eq("estado", "pendiente");
    if ((count ?? 0) === 0 && (await cerrarRecogidaLocal(recogidaId))) cerradas.push(recogidaId);
  }
  return { paginas: paginas.length, cerradas };
}
