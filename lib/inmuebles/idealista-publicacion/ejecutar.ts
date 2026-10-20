import { createAdminClient } from "@/lib/supabase/admin";
import { construirFeedIdealista } from "../idealista-feed/build";
import { cargarCarteraIdealista, urlSitioPublico } from "./cargar";
import { configListaParaFtp, leerConfigIdealistaPublicacion } from "./config";
import { subirJsonIdealistaFtp } from "./upload";

export type ResultadoVolcadoIdealista = {
  ok: boolean;
  anunciosEnviados: number;
  anunciosOmitidos: number;
  omitidos: Array<{ id: string; referencia: string | null; motivos: string[] }>;
  fileName?: string;
  error?: string;
  soloVistaPrevia?: boolean;
  feed?: Record<string, unknown>;
};

export async function ejecutarVolcadoIdealista(opts?: {
  soloVistaPrevia?: boolean;
  siteUrl?: string;
}): Promise<ResultadoVolcadoIdealista> {
  const cfg = await leerConfigIdealistaPublicacion();
  if (!cfg.customerCode || !/^ilc[a-f0-9]{40}$/i.test(cfg.customerCode)) {
    return {
      ok: false,
      anunciosEnviados: 0,
      anunciosOmitidos: 0,
      omitidos: [],
      error: "Falta el código ILC en Ajustes → Publicación Idealista.",
    };
  }

  const siteUrl = urlSitioPublico(opts?.siteUrl);
  const propiedades = await cargarCarteraIdealista(siteUrl);
  const { customer, enviados, omitidos } = construirFeedIdealista(cfg.customerCode, propiedades, {
    name: cfg.contactName ?? undefined,
    email: cfg.contactEmail ?? undefined,
    phone: cfg.contactPhone ?? undefined,
  });

  if (opts?.soloVistaPrevia) {
    return {
      ok: true,
      anunciosEnviados: enviados,
      anunciosOmitidos: omitidos.length,
      omitidos,
      soloVistaPrevia: true,
      feed: customer,
    };
  }

  if (!configListaParaFtp(cfg)) {
    return {
      ok: false,
      anunciosEnviados: enviados,
      anunciosOmitidos: omitidos.length,
      omitidos,
      error: "Faltan host, usuario o contraseña FTP de Idealista (Idealista te los envía al activar el volcado).",
    };
  }

  const json = JSON.stringify(customer, null, 0);
  let fileName: string | undefined;
  try {
    const subida = await subirJsonIdealistaFtp({
      host: cfg.ftpHost!,
      port: cfg.ftpPort,
      user: cfg.ftpUser!,
      password: cfg.ftpPassword!,
      secure: cfg.ftpSecure,
      customerCode: cfg.customerCode,
      json,
    });
    fileName = subida.fileName;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error FTP";
    await registrarEjecucion(false, enviados, omitidos.length, omitidos, msg);
    return {
      ok: false,
      anunciosEnviados: enviados,
      anunciosOmitidos: omitidos.length,
      omitidos,
      error: msg,
    };
  }

  await registrarEjecucion(true, enviados, omitidos.length, omitidos, null, fileName);
  return {
    ok: true,
    anunciosEnviados: enviados,
    anunciosOmitidos: omitidos.length,
    omitidos,
    fileName,
  };
}

async function registrarEjecucion(
  ok: boolean,
  enviados: number,
  omitidos: number,
  detalle: ResultadoVolcadoIdealista["omitidos"],
  error: string | null,
  fileName?: string
) {
  try {
    const admin = createAdminClient();
    await admin.from("idealista_publicacion_ejecuciones").insert({
      ok,
      anuncios_enviados: enviados,
      anuncios_omitidos: omitidos,
      detalle: { omitidos, fileName },
      error,
    });
  } catch {
    // no bloquear el volcado por logging
  }
}

export async function ultimaEjecucionIdealista() {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("idealista_publicacion_ejecuciones")
      .select("created_at, ok, anuncios_enviados, anuncios_omitidos, error, detalle")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  } catch {
    return null;
  }
}
