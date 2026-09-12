import { CATASTRO_INSPIRE_AD_WFS, CATASTRO_OPERATIONS } from "./constants";
import { createCatastroHttp } from "./http";
import { parseConsultaDnp, separarTipoVia } from "./parse";
import type {
  CatastroClientOptions,
  ConsultaDireccion,
  ConsultaPoligonoParcela,
  ConsultaReferencia,
  JsonValue,
  ResultadoConsultaCatastro,
} from "./types";

function compactQuery(params: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1]))
  );
}

export function createCatastroClient(options: CatastroClientOptions = {}) {
  const http = createCatastroHttp(options);

  async function consultarDireccion(
    consulta: ConsultaDireccion
  ): Promise<ResultadoConsultaCatastro> {
    const via = separarTipoVia(consulta.calle, consulta.sigla);
    const params = {
      Provincia: consulta.provincia.trim(),
      Municipio: consulta.municipio.trim(),
      Sigla: via.sigla,
      Calle: via.calle,
      Numero: consulta.numero.trim(),
      Bloque: consulta.bloque?.trim(),
      Escalera: consulta.escalera?.trim(),
      Planta: consulta.planta?.trim(),
      Puerta: consulta.puerta?.trim(),
    };

    const raw = await http.getJson(CATASTRO_OPERATIONS.dnploc, params);
    return parseConsultaDnp(raw, compactQuery(params));
  }

  async function consultarReferencia(
    consulta: ConsultaReferencia
  ): Promise<ResultadoConsultaCatastro> {
    const params = {
      Provincia: consulta.provincia?.trim(),
      Municipio: consulta.municipio?.trim(),
      RefCat: consulta.refCat.trim(),
    };
    const raw = await http.getJson(CATASTRO_OPERATIONS.dnprc, params);
    return parseConsultaDnp(raw, compactQuery(params));
  }

  async function consultarPoligonoParcela(
    consulta: ConsultaPoligonoParcela
  ): Promise<ResultadoConsultaCatastro> {
    const params = {
      Provincia: consulta.provincia.trim(),
      Municipio: consulta.municipio.trim(),
      Poligono: consulta.poligono.trim(),
      Parcela: consulta.parcela.trim(),
    };
    const raw = await http.getJson(CATASTRO_OPERATIONS.dnppp, params);
    return parseConsultaDnp(raw, compactQuery(params));
  }

  async function obtenerProvincias(): Promise<JsonValue> {
    return http.getJson(CATASTRO_OPERATIONS.provincias, {});
  }

  async function obtenerMunicipios(provincia: string, municipio?: string): Promise<JsonValue> {
    return http.getJson(CATASTRO_OPERATIONS.municipios, {
      Provincia: provincia.trim(),
      Municipio: municipio?.trim(),
    });
  }

  async function obtenerCallejero(params: {
    provincia: string;
    municipio: string;
    tipoVia?: string;
    nomVia?: string;
  }): Promise<JsonValue> {
    return http.getJson(CATASTRO_OPERATIONS.callejero, {
      Provincia: params.provincia.trim(),
      Municipio: params.municipio.trim(),
      TipoVia: params.tipoVia?.trim(),
      NomVia: params.nomVia?.trim(),
    });
  }

  async function obtenerNumerero(params: {
    provincia: string;
    municipio: string;
    tipoVia: string;
    nomVia: string;
    numero: string;
  }): Promise<JsonValue> {
    return http.getJson(CATASTRO_OPERATIONS.numerero, {
      Provincia: params.provincia.trim(),
      Municipio: params.municipio.trim(),
      TipoVia: params.tipoVia.trim(),
      NomVia: params.nomVia.trim(),
      Numero: params.numero.trim(),
    });
  }

  /** StoredQuery oficial GetADByCodVIA. Parámetros: DEL, MUN, CODVIA. */
  async function obtenerDireccionesPorCodigoVia(params: {
    delegacion: string;
    municipio: string;
    codigoVia: string;
  }): Promise<string> {
    const url = new URL(CATASTRO_INSPIRE_AD_WFS);
    url.searchParams.set("service", "wfs");
    url.searchParams.set("version", "2.0.0");
    url.searchParams.set("request", "GetFeature");
    url.searchParams.set("STOREDQUERIE_ID", "GetADByCodVIA");
    url.searchParams.set("DEL", params.delegacion.trim());
    url.searchParams.set("MUN", params.municipio.trim());
    url.searchParams.set("CODVIA", params.codigoVia.trim());
    return http.getText(url.toString());
  }

  /** StoredQuery oficial GetADByPostalCode. Parámetro: POSTALCODE. */
  async function obtenerDireccionesPorCodigoPostal(params: {
    codigoPostal: string;
    startIndex?: number;
    count?: number;
  }): Promise<string> {
    const url = new URL(CATASTRO_INSPIRE_AD_WFS);
    url.searchParams.set("service", "wfs");
    url.searchParams.set("version", "2.0.0");
    url.searchParams.set("request", "GetFeature");
    url.searchParams.set("STOREDQUERIE_ID", "GetADByPostalCode");
    url.searchParams.set("POSTALCODE", params.codigoPostal.trim());
    if (params.startIndex != null) url.searchParams.set("startIndex", String(params.startIndex));
    if (params.count != null) url.searchParams.set("count", String(params.count));
    return http.getText(url.toString());
  }

  return {
    consultarDireccion,
    consultarReferencia,
    consultarPoligonoParcela,
    obtenerProvincias,
    obtenerMunicipios,
    obtenerCallejero,
    obtenerNumerero,
    obtenerDireccionesPorCodigoVia,
    obtenerDireccionesPorCodigoPostal,
    getStats: http.getStats,
  };
}

export type CatastroClient = ReturnType<typeof createCatastroClient>;

let clienteCompartido: CatastroClient | null = null;

export function getCatastroClient(): CatastroClient {
  clienteCompartido ??= createCatastroClient();
  return clienteCompartido;
}
