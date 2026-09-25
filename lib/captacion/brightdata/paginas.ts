import { aplicarFicha, marcarFichaPendiente } from "@/lib/captacion/brightdata/fichas";
import {
  aplicarSoloMensaje,
  aplicarTelefono,
  encolarTelefono,
  externoIdDeUrlTelefono,
  marcarTelefonoPendiente,
} from "@/lib/captacion/brightdata/telefonos";
import { registrarPedidoTelefono, registrarResultadoTelefono, telefonosColaPausada } from "@/lib/captacion/brightdata/telefonos-metricas";
import { ingestarIdealistaBrightData } from "@/lib/captacion/brightdata/ingestar";
import { parsearListadoIdealista } from "@/lib/captacion/brightdata/parse-listado";
import {
  anotarLote,
  intentarCerrarRecogidasAbiertas,
  marcarSospechosaTransporte,
  sumarVistos,
} from "@/lib/captacion/brightdata/recogidas";
import {
  esErrorTransporteUnlocker,
  MAX_INTENTOS_TRANSPORTE_LISTADO,
  motivoTransporteUnlocker,
} from "@/lib/captacion/brightdata/unlocker-transporte";
import type { RespuestaUnlocker } from "@/lib/captacion/brightdata/unlocker";
import { guardarDiagnosticoUnlocker } from "@/lib/captacion/brightdata/unlocker-diagnostico";
import {
  esRespuestaTelefonoUnlockerValida,
  esSoloMensajeTelefonoUnlocker,
} from "@/lib/captacion/brightdata/unlocker-telefono";
import { configUnlocker, pedirHtmlUnlocker, pedirUnlocker } from "@/lib/captacion/brightdata/unlocker";
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
  intentos?: number | null;
};

const ESPERA_TELEFONO_MS = 2000;
const TOPE_TELEFONO = 30;

function dormir(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function manejarTransporteListado(
  supabase: ReturnType<typeof createAdminClient>,
  pagina: Pagina,
  config: { zone: string; token: string },
  resp: RespuestaUnlocker
): Promise<void> {
  await guardarDiagnosticoUnlocker(supabase, pagina.id, config, pagina.url, resp);
  const intentos = pagina.intentos ?? 0;
  const siguiente = intentos + 1;
  const motivo = motivoTransporteUnlocker(resp);
  if (siguiente >= MAX_INTENTOS_TRANSPORTE_LISTADO && pagina.recogida_id && pagina.zona_id !== ZONA_PROVINCIA_48H) {
    await supabase.from("captacion_paginas_pendientes").update({ estado: "error", intentos: siguiente }).eq("id", pagina.id);
    await marcarSospechosaTransporte(pagina.recogida_id, pagina.zona_id, motivo);
    return;
  }
  await supabase.from("captacion_paginas_pendientes").update({ estado: "pendiente", intentos: siguiente }).eq("id", pagina.id);
}

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
        tipo: "listado",
        estado: "pendiente",
      })),
      { onConflict: "recogida_id,url", ignoreDuplicates: true }
    );
  if (error) throw new Error(error.message);
}

/** Hasta 20 páginas pendientes. Cierra la recogida cuando no queda ninguna. */
export async function procesarPaginasPendientes(limite = 20): Promise<{ paginas: number; cerradas: string[]; errores: number }> {
  const config = configUnlocker();
  if ("error" in config) throw new Error(config.error);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("captacion_paginas_pendientes")
    .select("id, recogida_id, url, zona_id, page, tipo, intentos")
    .eq("estado", "pendiente")
    .neq("tipo", "telefono")
    .or(`reintentar_en.is.null,reintentar_en.lte.${new Date().toISOString()}`)
    .order("prioridad", { ascending: true })
    .order("page", { ascending: true })
    .limit(limite);
  if (error) throw new Error(error.message);
  const paginas = (data ?? []) as Pagina[];
  let errores = 0;
  for (const pagina of paginas) {
    if (pagina.tipo === "ficha") {
      try {
        const html = await pedirHtmlUnlocker(config, pagina.url);
        const resultado = await aplicarFicha(html, pagina.url);
        await supabase
          .from("captacion_paginas_pendientes")
          .update({ estado: resultado === "ok" ? "hecha" : "pendiente" })
          .eq("id", pagina.id);
        if (resultado === "ok") {
          const externoId = (pagina.url.match(/\/inmueble\/(\d+)/) || [])[1] ?? "";
          if (externoId) await encolarTelefono(externoId).catch(() => undefined);
        }
        if (resultado !== "ok") await marcarFichaPendiente((pagina.url.match(/\/inmueble\/(\d+)/) || [])[1] ?? "");
      } catch {
        errores += 1;
        await marcarFichaPendiente((pagina.url.match(/\/inmueble\/(\d+)/) || [])[1] ?? "");
      }
      continue;
    }
    try {
      const resp = await pedirUnlocker(config, pagina.url);
      if (esErrorTransporteUnlocker(resp)) {
        await manejarTransporteListado(supabase, pagina, config, resp);
        if ((pagina.intentos ?? 0) + 1 >= MAX_INTENTOS_TRANSPORTE_LISTADO) errores += 1;
        continue;
      }
      const html = resp.cuerpo;
      const listado = parsearListadoIdealista(html, pagina.url);
      const n = listado.items.length;
      const sinListado = n === 0 && !listado.sin_resultados;
      if (sinListado) await guardarDiagnosticoUnlocker(supabase, pagina.id, config, pagina.url, resp);
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
      errores += 1;
      const cuerpo = error instanceof Error ? error.message : "Página de listado fallida";
      await manejarTransporteListado(supabase, pagina, config, {
        ok: false,
        http_status: 0,
        content_type: null,
        cuerpo,
        bytes: new TextEncoder().encode(cuerpo).length,
      });
      console.error(cuerpo);
    }
  }
  const cerradas = await intentarCerrarRecogidasAbiertas();
  let telefonos = 0;
  if (!(await telefonosColaPausada())) {
    const { data: colaTel } = await supabase
      .from("captacion_paginas_pendientes")
      .select("id, url, intentos")
      .eq("estado", "pendiente")
      .eq("tipo", "telefono")
      .or(`reintentar_en.is.null,reintentar_en.lte.${new Date().toISOString()}`)
      .order("prioridad", { ascending: true })
      .limit(TOPE_TELEFONO);
    for (const pagina of (colaTel ?? []) as Pagina[]) {
      if (telefonos > 0) await dormir(ESPERA_TELEFONO_MS);
      telefonos += 1;
      const externoId = externoIdDeUrlTelefono(pagina.url);
      const intentos = pagina.intentos ?? 0;
      try {
        await registrarPedidoTelefono();
        const resp = await pedirUnlocker(config, pagina.url);
        if (esSoloMensajeTelefonoUnlocker(resp)) {
          await aplicarSoloMensaje(externoId, pagina.id);
          continue;
        }
        if (!esRespuestaTelefonoUnlockerValida(resp)) {
          errores += 1;
          await guardarDiagnosticoUnlocker(supabase, pagina.id, config, pagina.url, resp);
          await registrarResultadoTelefono("fallo");
          await marcarTelefonoPendiente(externoId, pagina.id, intentos);
          continue;
        }
        const resultado = await aplicarTelefono(resp.cuerpo, pagina.url);
        if (resultado === "ok" || resultado === "sin_numero") {
          await supabase.from("captacion_paginas_pendientes").update({ estado: "hecha" }).eq("id", pagina.id);
        } else {
          await guardarDiagnosticoUnlocker(supabase, pagina.id, config, pagina.url, resp);
          await marcarTelefonoPendiente(externoId, pagina.id, intentos);
        }
      } catch (error) {
        errores += 1;
        const cuerpo = error instanceof Error ? error.message : "Teléfono fallido";
        await guardarDiagnosticoUnlocker(supabase, pagina.id, config, pagina.url, {
          ok: false,
          http_status: 0,
          content_type: null,
          cuerpo,
          bytes: new TextEncoder().encode(cuerpo).length,
        });
        await registrarResultadoTelefono("fallo");
        await marcarTelefonoPendiente(externoId, pagina.id, intentos);
      }
    }
  }
  return { paginas: paginas.length + telefonos, cerradas, errores };
}
