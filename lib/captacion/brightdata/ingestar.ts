import { encolarFicha } from "@/lib/captacion/brightdata/fichas";
import { mapearBrightDataIdealista } from "@/lib/captacion/brightdata/idealista";
import { INGESTA_PARALELO_DEFAULT } from "@/lib/captacion/brightdata/rafaga-config";
import {
  cargarPreviosAnuncios,
  guardarAnuncioPipeline,
  pasadaCompletaAnterior,
} from "@/lib/captacion/pipeline/guardar";
import { createAdminClient } from "@/lib/supabase/admin";

export type ResultadoIngesta = {
  nuevos: number;
  actualizados: number;
  omitidos: number;
  sinCambios: number;
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
  const resultado: ResultadoIngesta = {
    nuevos: 0,
    actualizados: 0,
    omitidos: 0,
    sinCambios: 0,
    conTelefono: 0,
    conFecha: 0,
    errores: [],
  };
  const paralelo = Math.max(1, Math.min(5, opts?.paralelo ?? INGESTA_PARALELO_DEFAULT));

  // Un mismo externo_id dos veces en la página + paralelo ⇒ doble INSERT (no hay UNIQUE estricto).
  const porExterno = new Map<string, { registro: Record<string, unknown>; entrante: NonNullable<ReturnType<typeof mapearBrightDataIdealista>> }>();
  const omitidosMarcador: Array<{ registro: Record<string, unknown>; entrante: null }> = [];
  for (const registro of registros) {
    const entrante = mapearBrightDataIdealista(registro);
    if (!entrante) {
      omitidosMarcador.push({ registro, entrante: null });
      continue;
    }
    porExterno.set(entrante.externo_id, { registro, entrante });
  }
  const mapeados = [...omitidosMarcador, ...porExterno.values()];
  resultado.omitidos += Math.max(0, registros.length - omitidosMarcador.length - porExterno.size);

  const externos = [...porExterno.keys()];
  const [previos, pasadaIso] = await Promise.all([
    cargarPreviosAnuncios(supabase, "idealista", externos),
    pasadaCompletaAnterior(supabase),
  ]);

  for (let i = 0; i < mapeados.length; i += paralelo) {
    const partes = await Promise.all(
      mapeados.slice(i, i + paralelo).map(async ({ registro, entrante }) => {
        if (!entrante) {
          return { nuevos: 0, actualizados: 0, omitidos: 1, sinCambios: 0, conTelefono: 0, conFecha: 0, errores: [] as string[] };
        }
        const guardado = await guardarAnuncioPipeline(supabase, entrante, ahoraIso, registro, {
          previo: previos.get(entrante.externo_id) ?? null,
          pasadaCompletaAnteriorIso: pasadaIso,
        });
        if (guardado.nuevo && registro.items_en_pagina != null) {
          await encolarFicha(entrante.externo_id, entrante.anunciante).catch(() => undefined);
        }
        return {
          nuevos: guardado.nuevo ? 1 : 0,
          actualizados: guardado.actualizado ? 1 : 0,
          omitidos: 0,
          sinCambios: guardado.sinCambios ? 1 : 0,
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
      resultado.sinCambios += parte.sinCambios;
      resultado.conTelefono += parte.conTelefono;
      resultado.conFecha += parte.conFecha;
      resultado.errores.push(...parte.errores);
    }
  }

  return resultado;
}
