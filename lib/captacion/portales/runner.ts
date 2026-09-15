import { createAdminClient } from "@/lib/supabase/admin";
import { cronZonaAutorizado } from "@/lib/catastro-host/zone-tick";
import {
  buscarIdealista,
  idealistaConfigurado,
  mapearIdealista,
  paramsIdealistaDesdeAlerta,
} from "./idealista";
import { filtrarParticular, fusionarAnuncio, desaparecidosTrasSync, type AnuncioGuardado } from "./sync";
import { centroDeZonas } from "./zonas";
import type { AlertaCaptacion, FuentePortal } from "./modelo";
import { parseFuentePortal } from "./modelo";

export { cronZonaAutorizado as cronPortalesAutorizado };

const MAX_PAGINAS = 4;

function parseAlerta(row: Record<string, unknown>): AlertaCaptacion {
  return {
    id: String(row.id),
    nombre: String(row.nombre),
    portales: ((row.portales as unknown[]) ?? []).map(parseFuentePortal).filter((p): p is FuentePortal => Boolean(p)),
    zonas: (row.zonas as string[]) ?? [],
    center_lat: typeof row.center_lat === "number" ? row.center_lat : null,
    center_lng: typeof row.center_lng === "number" ? row.center_lng : null,
    radio_m: typeof row.radio_m === "number" ? row.radio_m : 15000,
    operacion: row.operacion === "alquiler" ? "alquiler" : "venta",
    tipo: typeof row.tipo === "string" ? row.tipo : null,
    precio_max: row.precio_max == null ? null : Number(row.precio_max),
    m2_min: row.m2_min == null ? null : Number(row.m2_min),
    solo_particulares: Boolean(row.solo_particulares),
    frecuencia: row.frecuencia === "hora" || row.frecuencia === "6h" ? row.frecuencia : "diaria",
    activa: Boolean(row.activa),
    comercial_id: typeof row.comercial_id === "string" ? row.comercial_id : null,
    created_by: String(row.created_by),
    last_sync_at: typeof row.last_sync_at === "string" ? row.last_sync_at : null,
  };
}

export async function ejecutarSyncPortales(): Promise<{
  ok: boolean;
  error?: string;
  alertas: number;
  nuevos: number;
  bajadas: number;
  retirados: number;
  omitidas: string[];
}> {
  if (!(await idealistaConfigurado())) {
    return { ok: false, error: "Faltan las claves de Idealista.", alertas: 0, nuevos: 0, bajadas: 0, retirados: 0, omitidas: [] };
  }
  const admin = createAdminClient();
  const { data: filas, error } = await admin.from("captacion_alertas").select("*").eq("activa", true);
  if (error) {
    return { ok: false, error: error.message, alertas: 0, nuevos: 0, bajadas: 0, retirados: 0, omitidas: [] };
  }
  const alertas = (filas ?? []).map((row) => parseAlerta(row as Record<string, unknown>));
  const ahora = new Date().toISOString();
  let nuevos = 0;
  let bajadas = 0;
  let retirados = 0;
  const omitidas: string[] = [];
  const vistos: Array<{ fuente: string; externo_id: string }> = [];

  const { data: todosPrevios } = await admin
    .from("captacion_anuncios")
    .select("id, fuente, externo_id, precio, tags, fase, alerta_id, desaparecido_en");
  const previos = new Map(
    ((todosPrevios ?? []) as AnuncioGuardado[]).map((row) => [`${row.fuente}:${row.externo_id}`, row])
  );

  for (const alerta of alertas) {
    if (!alerta.portales.includes("idealista")) {
      omitidas.push(`${alerta.nombre}: sin conector activo`);
      continue;
    }
    const centro = centroDeZonas(alerta.zonas, {
      lat: alerta.center_lat,
      lng: alerta.center_lng,
      radio: alerta.radio_m,
    });
    if (!centro) {
      omitidas.push(`${alerta.nombre}: zona sin coordenadas`);
      continue;
    }
    for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
      const params = paramsIdealistaDesdeAlerta({
        operacion: alerta.operacion,
        tipo: alerta.tipo,
        precio_max: alerta.precio_max,
        m2_min: alerta.m2_min,
        lat: centro.lat,
        lng: centro.lng,
        radio_m: centro.radio,
        numPage: pagina,
      });
      const resultado = await buscarIdealista(params).catch((err: unknown) => {
        omitidas.push(`${alerta.nombre}: ${err instanceof Error ? err.message : "error Idealista"}`);
        return null;
      });
      if (!resultado) break;
      const mapeados = filtrarParticular(
        resultado.elementList.map(mapearIdealista).filter((item): item is NonNullable<typeof item> => Boolean(item)),
        alerta.solo_particulares
      );
      for (const item of mapeados) {
        vistos.push({ fuente: item.fuente, externo_id: item.externo_id });
        const previo = previos.get(`${item.fuente}:${item.externo_id}`) ?? null;
        const patch = fusionarAnuncio(previo, item, ahora, alerta.id);
        if (patch.esNuevo) {
          const { data: creado, error: errIns } = await admin
            .from("captacion_anuncios")
            .upsert(patch.row as never, { onConflict: "fuente,externo_id" })
            .select("id, comercial_id")
            .single();
          if (errIns || !creado) continue;
          nuevos += 1;
          previos.set(`${item.fuente}:${item.externo_id}`, {
            id: creado.id,
            fuente: item.fuente,
            externo_id: item.externo_id,
            precio: item.precio,
            tags: (patch.row.tags as string[]) ?? [],
            fase: "novedad",
            alerta_id: alerta.id,
            desaparecido_en: null,
          });
          if (alerta.comercial_id) {
            await admin.from("captacion_anuncios").update({ comercial_id: alerta.comercial_id }).eq("id", creado.id);
          }
          await admin.from("captacion_anuncios_actividad").insert({
            anuncio_id: creado.id,
            tipo: "detectado",
            detalle: `Detectado por «${alerta.nombre}»`,
          });
          const destinos = [alerta.comercial_id, alerta.created_by].filter(Boolean) as string[];
          for (const userId of new Set(destinos)) {
            await admin.from("captacion_notificaciones").insert({
              user_id: userId,
              tipo: "nuevos",
              titulo: `Anuncio nuevo en «${alerta.nombre}»`,
              detalle: item.titulo,
              anuncio_id: creado.id,
            });
          }
        } else if (previo) {
          await admin.from("captacion_anuncios").update(patch.row as never).eq("id", previo.id);
          const bajada = patch.eventos.find((e) => e.tipo === "bajada");
          if (bajada && bajada.tipo === "bajada") {
            bajadas += 1;
            await admin.from("captacion_anuncios_actividad").insert({
              anuncio_id: previo.id,
              tipo: "bajada",
              detalle: `Bajada de precio ${bajada.de.toLocaleString("es-ES")} → ${bajada.a.toLocaleString("es-ES")} €`,
            });
          }
        }
      }
      if (pagina >= resultado.totalPages) break;
    }

    await admin.from("captacion_alertas").update({ last_sync_at: ahora, updated_at: ahora }).eq("id", alerta.id);
  }

  const existentesIdealista = [...previos.values()].filter((a) => a.fuente === "idealista");
  const caidos = desaparecidosTrasSync(existentesIdealista, vistos, ahora);
  for (const item of caidos) {
    retirados += 1;
    const previo = existentesIdealista.find((a) => a.id === item.id);
    const faseSiguiente = ["contacto", "visita", "negociando"].includes(previo?.fase ?? "")
      ? "perdido"
      : previo?.fase;
    await admin
      .from("captacion_anuncios")
      .update({
        desaparecido_en: ahora,
        updated_at: ahora,
        ...(faseSiguiente === "perdido" ? { fase: "perdido" } : {}),
      })
      .eq("id", item.id);
    await admin.from("captacion_anuncios_actividad").insert({
      anuncio_id: item.id,
      tipo: "retirado",
      detalle: "Anuncio retirado del portal",
    });
  }

  return { ok: true, alertas: alertas.length, nuevos, bajadas, retirados, omitidas };
}
