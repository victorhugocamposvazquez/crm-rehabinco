import { createAdminClient } from "@/lib/supabase/admin";
import { anunciosIdealistaDePropiedad } from "../idealista-feed/build";
import { desactivarAnuncioIdealista, publicarAnuncioIdealista } from "./api";
import { cargarPropiedadIdealista, urlSitioPublico } from "./cargar";
import { configListaParaApi, leerConfigIdealistaPublicacion, type IdealistaPublicacionConfig } from "./config";
import { planSyncIdealista } from "./plan";

export type ResultadoSyncIdealista = {
  ok: boolean;
  propiedadId: string;
  estado: string | null;
  mensaje: string | null;
};

function operacionDe(anuncio: Record<string, unknown>): string {
  const op = anuncio.propertyOperation;
  if (op && typeof op === "object" && "operationType" in op) {
    const tipo = (op as { operationType?: unknown }).operationType;
    if (tipo === "rent" || tipo === "sale") return tipo;
  }
  return "sale";
}

async function guardarEstado(
  propiedadId: string,
  estado: string | null,
  error: string | null,
  anuncios?: Record<string, string> | null
) {
  const admin = createAdminClient();
  const patch: Record<string, unknown> = {
    idealista_sync_estado: estado,
    idealista_sync_error: error,
    idealista_synced_at: new Date().toISOString(),
  };
  if (anuncios) patch.idealista_anuncios = anuncios;
  if (estado === "despublicado" || estado === null) patch.idealista_anuncios = anuncios ?? null;
  await admin.from("propiedades").update(patch).eq("id", propiedadId);
}

export async function sincronizarPropiedadIdealista(
  propiedadId: string,
  siteUrl?: string
): Promise<ResultadoSyncIdealista> {
  const cfg = await leerConfigIdealistaPublicacion();
  const propiedad = await cargarPropiedadIdealista(propiedadId, urlSitioPublico(siteUrl));
  if (!propiedad) {
    return { ok: false, propiedadId, estado: null, mensaje: "Inmueble no encontrado." };
  }

  const codigo = cfg.customerCode || "ilc0000000000000000000000000000000000000000";
  const { anuncios, motivos } = anunciosIdealistaDePropiedad(codigo, propiedad, {
    name: cfg.contactName ?? undefined,
    email: cfg.contactEmail ?? undefined,
    phone: cfg.contactPhone ?? undefined,
  });
  const tieneAnuncio = Object.keys(propiedad.anunciosGuardados).length > 0;
  const plan = planSyncIdealista({
    publicar: propiedad.publicar_idealista,
    motivos: propiedad.publicar_idealista ? motivos : [],
    anuncios: anuncios.length,
    apiLista: configListaParaApi(cfg),
    tieneAnuncio,
  });

  if (plan.accion === "nada") {
    await guardarEstado(propiedadId, null, null, null);
    return { ok: true, propiedadId, estado: null, mensaje: null };
  }
  if (plan.accion === "incompleto") {
    await guardarEstado(propiedadId, "incompleto", plan.mensaje);
    return { ok: false, propiedadId, estado: "incompleto", mensaje: plan.mensaje };
  }
  if (plan.accion === "marcar_espera") {
    await guardarEstado(propiedadId, "esperando_api", null);
    return {
      ok: true,
      propiedadId,
      estado: "esperando_api",
      mensaje: "Queda marcado. Se publicará cuando Idealista active la API y peguemos las credenciales en Ajustes.",
    };
  }
  if (plan.accion === "baja_pendiente") {
    await guardarEstado(propiedadId, "pendiente_baja", null);
    return {
      ok: true,
      propiedadId,
      estado: "pendiente_baja",
      mensaje: "La baja en Idealista se enviará cuando la API esté activa.",
    };
  }
  if (plan.accion === "desactivar") {
    return desactivar(propiedadId, cfg, propiedad.anunciosGuardados);
  }
  return publicar(propiedadId, cfg, anuncios, propiedad.anunciosGuardados);
}

async function publicar(
  propiedadId: string,
  cfg: IdealistaPublicacionConfig,
  anuncios: Record<string, unknown>[],
  previos: Record<string, string>
): Promise<ResultadoSyncIdealista> {
  const guardados = { ...previos };
  const errores: string[] = [];
  for (const anuncio of anuncios) {
    const op = operacionDe(anuncio);
    const resultado = await publicarAnuncioIdealista({
      clientId: cfg.apiClientId!,
      clientSecret: cfg.apiClientSecret!,
      baseUrl: cfg.apiBaseUrl!,
      feedKey: cfg.customerCode!,
      anuncio,
      anuncioId: guardados[op] ?? null,
    });
    if (!resultado.ok) {
      errores.push(resultado.error);
      continue;
    }
    if (resultado.id) guardados[op] = resultado.id;
  }
  if (errores.length) {
    await guardarEstado(propiedadId, "error", errores.join(" · "), guardados);
    return { ok: false, propiedadId, estado: "error", mensaje: errores.join(" · ") };
  }
  await guardarEstado(propiedadId, "publicado", null, guardados);
  return { ok: true, propiedadId, estado: "publicado", mensaje: "Publicado en Idealista." };
}

async function desactivar(
  propiedadId: string,
  cfg: IdealistaPublicacionConfig,
  previos: Record<string, string>
): Promise<ResultadoSyncIdealista> {
  const errores: string[] = [];
  for (const id of Object.values(previos)) {
    const resultado = await desactivarAnuncioIdealista({
      clientId: cfg.apiClientId!,
      clientSecret: cfg.apiClientSecret!,
      baseUrl: cfg.apiBaseUrl!,
      feedKey: cfg.customerCode!,
      anuncioId: id,
    });
    if (!resultado.ok) errores.push(resultado.error);
  }
  if (errores.length) {
    await guardarEstado(propiedadId, "error", errores.join(" · "));
    return { ok: false, propiedadId, estado: "error", mensaje: errores.join(" · ") };
  }
  await guardarEstado(propiedadId, "despublicado", null, null);
  return { ok: true, propiedadId, estado: "despublicado", mensaje: "Anuncio retirado de Idealista." };
}

export async function sincronizarMarcadosIdealista(): Promise<{
  ok: boolean;
  total: number;
  publicados: number;
  esperando: number;
  errores: number;
}> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("propiedades")
    .select("id")
    .or("publicar_idealista.eq.true,idealista_sync_estado.eq.pendiente_baja,idealista_sync_estado.eq.esperando_api");
  if (error) throw new Error(error.message);
  let publicados = 0;
  let esperando = 0;
  let errores = 0;
  for (const row of data ?? []) {
    const resultado = await sincronizarPropiedadIdealista(row.id as string);
    if (resultado.estado === "publicado" || resultado.estado === "despublicado") publicados += 1;
    else if (resultado.estado === "esperando_api" || resultado.estado === "pendiente_baja") esperando += 1;
    else if (!resultado.ok) errores += 1;
  }
  return { ok: errores === 0, total: data?.length ?? 0, publicados, esperando, errores };
}
