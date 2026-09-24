import { encolarFicha } from "@/lib/captacion/brightdata/fichas";
import { mapearBrightDataIdealista } from "@/lib/captacion/brightdata/idealista";
import { guardarAnuncioPipeline } from "@/lib/captacion/pipeline/guardar";
import { createAdminClient } from "@/lib/supabase/admin";

export type ResultadoIngesta = {
  nuevos: number;
  actualizados: number;
  omitidos: number;
  conTelefono: number;
  conFecha: number;
  errores: string[];
};

/** Cada registro (listado o ficha) entra por el pipeline común. Sin teléfono sigue siendo un anuncio. */
export async function ingestarIdealistaBrightData(
  registros: Record<string, unknown>[],
  ahoraIso = new Date().toISOString(),
  opts?: { paralelo?: number }
): Promise<ResultadoIngesta> {
  const supabase = createAdminClient();
  const resultado: ResultadoIngesta = { nuevos: 0, actualizados: 0, omitidos: 0, conTelefono: 0, conFecha: 0, errores: [] };
  const paralelo = Math.max(1, opts?.paralelo ?? 1);

  for (let i = 0; i < registros.length; i += paralelo) {
    const partes = await Promise.all(
      registros.slice(i, i + paralelo).map(async (registro) => {
        const entrante = mapearBrightDataIdealista(registro);
        if (!entrante) return { nuevos: 0, actualizados: 0, omitidos: 1, conTelefono: 0, conFecha: 0, errores: [] as string[] };
        const guardado = await guardarAnuncioPipeline(supabase, entrante, ahoraIso, registro);
        if (guardado.nuevo && registro.items_en_pagina != null) {
          await encolarFicha(entrante.externo_id, entrante.anunciante).catch(() => undefined);
        }
        return {
          nuevos: guardado.nuevo ? 1 : 0,
          actualizados: guardado.actualizado ? 1 : 0,
          omitidos: 0,
          conTelefono: entrante.contacto_telefono ? 1 : 0,
          conFecha: entrante.publicado_en ? 1 : 0,
          errores: guardado.errores,
        };
      })
    );
    for (const parte of partes) {
      resultado.nuevos += parte.nuevos;
      resultado.actualizados += parte.actualizados;
      resultado.omitidos += parte.omitidos;
      resultado.conTelefono += parte.conTelefono;
      resultado.conFecha += parte.conFecha;
      resultado.errores.push(...parte.errores);
    }
  }

  return resultado;
}
