import type { SupabaseClient } from "@supabase/supabase-js";
import "../adapters/habitaclia/index.js";
import "../adapters/pisos/index.js";
import "../adapters/milanuncios/index.js";
import "../adapters/fotocasa/index.js";
import "../adapters/wallapop/index.js";
import { upsertAnuncio } from "../../../lib/captacion/pipeline/upsert.js";
import {
  normalizarAnunciante,
  normalizarM2,
  normalizarMunicipio,
  normalizarOperacion,
  normalizarPrecio,
  normalizarTexto,
  normalizarTipo,
} from "../../../lib/captacion/pipeline/normalize.js";
import type { AnuncioEntrante } from "../../../lib/captacion/portales/modelo.js";
import { adapterDe } from "../adapters/registry.js";
import type { CrawlJob } from "../queue/claim.js";
import { finalizarJob } from "../queue/claim.js";
import { urlListado, zonaDesdeJob } from "../scheduler/zonas.js";
import { esBloqueo, fetchConRespaldo, reintentoPermitido, type FetchResult } from "../transport/http.js";
import { fetchBrowser } from "../transport/browser.js";
import {
  limpiarBloqueoPortal,
  pausarPortalSinProxy,
  portalBloqueado,
  registrarBloqueoPortal,
} from "../transport/circuit-breaker.js";
import { esperaEntrePeticiones, ritmoEfectivo, sleep } from "../transport/rate-limit.js";
import { tieneProxy } from "../env.js";
import { guardarCrudo, rutaCruda } from "./raw-storage.js";
import { debeEncolarDetalle, type Portal } from "../adapters/types.js";

const PARSER_VACIO_MIN_BYTES = 50_000;

function crudoAEntrante(item: import("../adapters/types.js").AnuncioCrudo): AnuncioEntrante {
  const portalId = item.portal_id;
  return {
    fuente: portalId as AnuncioEntrante["fuente"],
    portal_id: portalId as AnuncioEntrante["portal_id"],
    externo_id: item.externo_id,
    url: item.url ?? null,
    titulo: normalizarTexto(item.titulo) ?? "Sin título",
    descripcion: normalizarTexto(item.descripcion),
    operacion: normalizarOperacion(item.operacion),
    tipo: normalizarTipo(item.tipo),
    anunciante: normalizarAnunciante(item.anunciante),
    precio: normalizarPrecio(item.precio),
    superficie: normalizarM2(item.superficie),
    habitaciones: item.habitaciones ?? null,
    banos: item.banos ?? null,
    planta: normalizarTexto(item.planta),
    geo_aproximada: item.geo_aproximada ?? false,
    nombre_comercial: normalizarTexto(item.nombre_comercial),
    direccion: normalizarTexto(item.direccion),
    zona: normalizarTexto(item.zona),
    municipio: normalizarMunicipio(item.municipio),
    codigo_postal: item.codigo_postal ?? null,
    lat: item.lat ?? null,
    lng: item.lng ?? null,
    thumb: item.fotos?.[0] ?? null,
    n_fotos: item.n_fotos ?? item.fotos?.length ?? null,
    fotos: item.fotos,
    contacto_nombre: normalizarTexto(item.contacto_nombre),
    contacto_telefono: item.contacto_telefono ?? null,
    publicado_en: item.publicado_en ?? null,
    raw: item as Record<string, unknown>,
  };
}

async function registrarRun(
  supabase: SupabaseClient,
  job: CrawlJob,
  patch: {
    http_status?: number;
    bloqueado?: boolean;
    estado?: string;
    paginas?: number;
    anuncios_vistos?: number;
    anuncios_nuevos?: number;
    bytes_descargados?: number;
    parser_version?: string;
    error?: string;
    proxyUrl?: string;
  }
): Promise<void> {
  const { error } = await supabase.from("crawl_runs").insert({
    job_id: job.id,
    portal_id: job.portal_id,
    alerta_id: job.alerta_id,
    finished_at: new Date().toISOString(),
    http_status: patch.http_status ?? null,
    bloqueado: patch.bloqueado ?? false,
    estado: patch.estado ?? "ok",
    paginas: patch.paginas ?? 0,
    anuncios_vistos: patch.anuncios_vistos ?? 0,
    anuncios_nuevos: patch.anuncios_nuevos ?? 0,
    bytes_descargados: patch.bytes_descargados ?? 0,
    parser_version: patch.parser_version ?? null,
    error: patch.error ?? null,
    proxy_sesion: patch.proxyUrl?.trim() ? patch.proxyUrl : null,
  });
  if (error) throw new Error(`crawl_runs: ${error.message}`);
}

async function fallarRun(
  supabase: SupabaseClient,
  job: CrawlJob,
  mensaje: string,
  base: {
    http_status?: number;
    paginas?: number;
    anuncios_vistos?: number;
    anuncios_nuevos?: number;
    bytes_descargados?: number;
    parser_version?: string;
    proxyUrl?: string;
  }
): Promise<void> {
  await registrarRun(supabase, job, {
    ...base,
    estado: "error",
    error: mensaje,
  });
  await finalizarJob(supabase, job.id, "error", { error: mensaje });
}

function prevAEntrante(
  prev: Record<string, unknown>,
  extra: Partial<import("../adapters/types.js").AnuncioCrudo>,
  portalId: Portal,
  externoId: string,
  url: string
): AnuncioEntrante {
  return crudoAEntrante({
    portal_id: portalId,
    externo_id: externoId,
    url: String(extra.url ?? prev.url ?? url),
    titulo: String(extra.titulo ?? prev.titulo ?? "Sin título"),
    descripcion: (extra.descripcion ?? prev.descripcion) as string | undefined,
    operacion: (extra.operacion ?? prev.operacion) as string | undefined,
    tipo: (extra.tipo ?? prev.tipo) as string | undefined,
    anunciante: (extra.anunciante ?? prev.anunciante) as string | undefined,
    precio: (extra.precio ?? prev.precio) as number | undefined,
    superficie: (extra.superficie ?? prev.superficie) as number | undefined,
    habitaciones: (extra.habitaciones ?? prev.habitaciones) as number | undefined,
    banos: (extra.banos ?? prev.banos) as number | undefined,
    planta: (extra.planta ?? prev.planta) as string | undefined,
    municipio: (extra.municipio ?? prev.municipio) as string | undefined,
    zona: (extra.zona ?? prev.zona) as string | undefined,
    direccion: (extra.direccion ?? prev.direccion) as string | undefined,
    codigo_postal: (extra.codigo_postal ?? prev.codigo_postal) as string | undefined,
    lat: (extra.lat ?? prev.lat) as number | undefined,
    lng: (extra.lng ?? prev.lng) as number | undefined,
    geo_aproximada: (extra.geo_aproximada ?? prev.geo_aproximada) as boolean | undefined,
    fotos: (extra.fotos ?? prev.fotos) as string[] | undefined,
    n_fotos: (extra.n_fotos ?? prev.n_fotos) as number | undefined,
    contacto_nombre: (extra.contacto_nombre ?? prev.contacto_nombre) as string | undefined,
    contacto_telefono: (extra.contacto_telefono ?? prev.contacto_telefono) as string | undefined,
    nombre_comercial: (extra.nombre_comercial ?? prev.nombre_comercial) as string | undefined,
    publicado_en: (extra.publicado_en ?? prev.publicado_en) as string | undefined,
  });
}

export async function procesarJob(
  supabase: SupabaseClient,
  job: CrawlJob,
  proxyUrl?: string,
  unblockerUrl?: string
): Promise<void> {
  const sinProxy = !tieneProxy({ PROXY_URL: proxyUrl });
  const adapter = adapterDe(job.portal_id as Portal);
  if (!adapter) {
    await finalizarJob(supabase, job.id, "error", { error: `Sin adaptador para ${job.portal_id}` });
    return;
  }
  if (await portalBloqueado(supabase, job.portal_id)) {
    await finalizarJob(supabase, job.id, "bloqueado", {
      error: "Portal en pausa (circuit breaker)",
      bloqueado_hasta: new Date(Date.now() + 3600000).toISOString(),
    });
    return;
  }

  const url =
    job.tipo === "listado"
      ? urlListado(adapter, job, job.alerta_id, job.portal_id)
      : job.url;

  const started = Date.now();
  const referer =
    adapter.referer ??
    (job.portal_id === "pisos.com"
      ? "https://www.pisos.com/"
      : job.portal_id === "wallapop"
        ? "https://es.wallapop.com/"
        : `https://www.${job.portal_id}.es/`);
  const ritmo = ritmoEfectivo(adapter.ritmo, sinProxy);
  let res: FetchResult;
  try {
    await sleep(esperaEntrePeticiones(ritmo.minMs, ritmo.maxMs));
    res =
      adapter.transport === "browser"
        ? await fetchBrowser(job.portal_id, url, { proxyUrl, referer })
        : await fetchConRespaldo(adapter, url, {
            proxyUrl,
            unblockerUrl,
            referer,
            portalId: job.portal_id,
          });
  } catch (err) {
    if (job.intentos < 3) {
      await supabase.from("crawl_jobs").update({ estado: "pendiente" }).eq("id", job.id);
      return;
    }
    await finalizarJob(supabase, job.id, "error", {
      error: err instanceof Error ? err.message : "Error de red",
    });
    return;
  }

  const captchaOBloqueo = esBloqueo(adapter, res) || res.status === 403;
  if (captchaOBloqueo || res.status === 429) {
    let bloqueadoHasta: string;
    if (sinProxy && (captchaOBloqueo || res.status === 403)) {
      bloqueadoHasta = await pausarPortalSinProxy(supabase, job.portal_id);
    } else {
      await registrarBloqueoPortal(supabase, job.portal_id);
      bloqueadoHasta = new Date(Date.now() + 3600000).toISOString();
    }
    await registrarRun(supabase, job, {
      http_status: res.status,
      bloqueado: true,
      estado: "bloqueado",
      bytes_descargados: res.bytes,
      parser_version: adapter.parserVersion,
      error: captchaOBloqueo ? "403/captcha" : `HTTP ${res.status}`,
      proxyUrl,
    });
    await finalizarJob(supabase, job.id, "bloqueado", {
      error: captchaOBloqueo ? "403/captcha" : `Bloqueo HTTP ${res.status}`,
      bloqueado_hasta: bloqueadoHasta,
    });
    return;
  }

  if (!res.status.toString().startsWith("2") && !reintentoPermitido(res.status)) {
    await finalizarJob(supabase, job.id, "error", { error: `HTTP ${res.status}` });
    return;
  }

  const zona = zonaDesdeJob(job).municipio ?? job.portal_id;
  const rawPath = rutaCruda(job.portal_id, zona, res.body);
  const runBase = {
    http_status: res.status,
    bytes_descargados: res.bytes,
    parser_version: adapter.parserVersion,
    proxyUrl,
  };

  try {
    await guardarCrudo(supabase, rawPath, res.body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error storage";
    await fallarRun(supabase, job, msg, { ...runBase, paginas: 0 });
    return;
  }

  let anunciosNuevos = 0;
  let anunciosVistos = 0;
  let paginas = 0;
  const ahora = new Date().toISOString();

  if (job.tipo === "listado") {
    const listado = adapter.parseList({ body: res.body, url });
    anunciosVistos = listado.items.length;
    paginas = 1;

    if (
      res.status === 200 &&
      res.bytes > PARSER_VACIO_MIN_BYTES &&
      listado.items.length === 0
    ) {
      await registrarBloqueoPortal(supabase, job.portal_id);
      await registrarRun(supabase, job, {
        http_status: res.status,
        bloqueado: true,
        estado: "parser_vacio",
        paginas,
        anuncios_vistos: 0,
        anuncios_nuevos: 0,
        bytes_descargados: res.bytes,
        parser_version: adapter.parserVersion,
        error: "parser_vacio",
        proxyUrl,
      });
      await finalizarJob(supabase, job.id, "bloqueado", {
        error: "parser_vacio",
        bloqueado_hasta: new Date(Date.now() + 3600000).toISOString(),
      });
      return;
    }

    for (const item of listado.items) {
      const entrante = crudoAEntrante(item);
      const { data: prev } = await supabase
        .from("captacion_anuncios")
        .select(
          "id, portal_id, externo_id, precio, precio_anterior, tags, fase, alerta_id, desaparecido_en, hash_contenido, raw_path, parser_version, titulo"
        )
        .eq("portal_id", entrante.portal_id ?? entrante.fuente)
        .eq("externo_id", entrante.externo_id)
        .maybeSingle();

      const patch = upsertAnuncio(
        prev as import("../../../lib/captacion/pipeline/upsert.js").AnuncioGuardado | null,
        entrante,
        ahora,
        job.alerta_id,
        { rawPath, parserVersion: adapter.parserVersion }
      );

      let anuncioId = prev?.id as string | undefined;
      if (patch.esNuevo) {
        const { data: inserted, error: insErr } = await supabase
          .from("captacion_anuncios")
          .insert(patch.row as never)
          .select("id")
          .single();
        if (insErr || !inserted) {
          await fallarRun(supabase, job, `insert: ${insErr?.message ?? "sin fila"}`, {
            ...runBase,
            paginas,
            anuncios_vistos: anunciosVistos,
            anuncios_nuevos: anunciosNuevos,
          });
          return;
        }
        anuncioId = inserted.id;
        anunciosNuevos += 1;
      } else if (prev) {
        const { error: updErr } = await supabase
          .from("captacion_anuncios")
          .update(patch.row as never)
          .eq("id", prev.id);
        if (updErr) {
          await fallarRun(supabase, job, `update: ${updErr.message}`, {
            ...runBase,
            paginas,
            anuncios_vistos: anunciosVistos,
            anuncios_nuevos: anunciosNuevos,
          });
          return;
        }
      }

      for (const h of patch.historial) {
        const { error: histErr } = await supabase.from("captacion_anuncios_historial").insert({
          anuncio_id: anuncioId,
          campo: h.campo,
          valor_anterior: h.valor_anterior,
          valor_nuevo: h.valor_nuevo,
        });
        if (histErr) {
          await fallarRun(supabase, job, `historial: ${histErr.message}`, {
            ...runBase,
            paginas,
            anuncios_vistos: anunciosVistos,
            anuncios_nuevos: anunciosNuevos,
          });
          return;
        }
      }

      if (
        debeEncolarDetalle(adapter.detalleNecesario ?? "sin_telefono", {
          esNuevo: patch.esNuevo,
          tieneBuildDetailUrl: Boolean(adapter.buildDetailUrl),
          contactoTelefono: entrante.contacto_telefono,
        }) &&
        adapter.buildDetailUrl
      ) {
        const detailUrl = adapter.buildDetailUrl(item);
        if (detailUrl) {
          const { error: encErr } = await supabase.from("crawl_jobs").insert({
            tipo: "detalle",
            portal_id: job.portal_id,
            alerta_id: job.alerta_id,
            url: detailUrl,
            prioridad: 60,
            payload: { externo_id: item.externo_id },
          });
          if (encErr) {
            await fallarRun(supabase, job, `encolar detalle: ${encErr.message}`, {
              ...runBase,
              paginas,
              anuncios_vistos: anunciosVistos,
              anuncios_nuevos: anunciosNuevos,
            });
            return;
          }
        }
      }
    }

    if (listado.hayMasPaginas) {
      const pagina = Number(job.payload.pagina ?? 1) + 1;
      await supabase.from("crawl_jobs").insert({
        tipo: "listado",
        portal_id: job.portal_id,
        alerta_id: job.alerta_id,
        url: job.url,
        prioridad: job.prioridad,
        payload: { ...job.payload, pagina },
      });
    }
  } else if (job.tipo === "detalle" && adapter.parseDetail) {
    paginas = 1;
    const extra = adapter.parseDetail({ body: res.body, url });
    const externoId = String(job.payload.externo_id ?? "");
    const { data: prev, error: selErr } = await supabase
      .from("captacion_anuncios")
      .select("*")
      .eq("portal_id", job.portal_id)
      .eq("externo_id", externoId)
      .maybeSingle();
    if (selErr) {
      await fallarRun(supabase, job, `select: ${selErr.message}`, { ...runBase, paginas });
      return;
    }
    if (prev) {
      anunciosVistos = 1;
      const merged = prevAEntrante(prev as Record<string, unknown>, extra, job.portal_id as Portal, externoId, url);
      const patch = upsertAnuncio(prev as never, merged, ahora, job.alerta_id, {
        rawPath,
        parserVersion: adapter.parserVersion,
      });
      const { error: updErr } = await supabase
        .from("captacion_anuncios")
        .update(patch.row as never)
        .eq("id", prev.id);
      if (updErr) {
        await fallarRun(supabase, job, `update detalle: ${updErr.message}`, {
          ...runBase,
          paginas,
          anuncios_vistos: anunciosVistos,
        });
        return;
      }
      for (const h of patch.historial) {
        const { error: histErr } = await supabase.from("captacion_anuncios_historial").insert({
          anuncio_id: prev.id,
          campo: h.campo,
          valor_anterior: h.valor_anterior,
          valor_nuevo: h.valor_nuevo,
        });
        if (histErr) {
          await fallarRun(supabase, job, `historial detalle: ${histErr.message}`, {
            ...runBase,
            paginas,
            anuncios_vistos: anunciosVistos,
          });
          return;
        }
      }
    }
  }

  await limpiarBloqueoPortal(supabase, job.portal_id);
  await registrarRun(supabase, job, {
    http_status: res.status,
    estado: "ok",
    paginas,
    anuncios_vistos: anunciosVistos,
    anuncios_nuevos: anunciosNuevos,
    bytes_descargados: res.bytes,
    parser_version: adapter.parserVersion,
    proxyUrl,
  });

  await finalizarJob(supabase, job.id, "ok", {
    resultado: { anuncios_nuevos: anunciosNuevos, anuncios_vistos: anunciosVistos, ms: Date.now() - started },
  });
}
