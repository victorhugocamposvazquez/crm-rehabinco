/**
 * Adaptador CRM: implementa CatastroPropertyIntegration sobre Propiedades.
 * Fuera de lib/catastro. Puede importar el dominio de inmuebles.
 */
import { ORIGEN_CATASTRO_EXPLORER } from "../catastro/explorer/property-port";
import type {
  CatastroPropertyIntegration,
  CatastroPropertyLink,
  ResultadoVinculoPropiedad,
} from "../catastro/explorer/property-port";

export type PropertyLinkRow = {
  finca_reference: string;
  property_id: string;
  source: string;
  linked_at: string;
};

type RpcError = { message: string; code?: string } | null;

export type PropertyIntegrationClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: unknown) => {
        maybeSingle: () => Promise<{ data: PropertyLinkRow | null; error: RpcError }>;
      };
      in: (
        column: string,
        values: unknown[]
      ) => PromiseLike<{ data: PropertyLinkRow[] | null; error: RpcError }>;
    };
  };
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: RpcError }>;
};

function linkDesdeFila(row: PropertyLinkRow): CatastroPropertyLink {
  return {
    fincaReference: row.finca_reference,
    propertyId: row.property_id,
    source: ORIGEN_CATASTRO_EXPLORER,
    linkedAt: row.linked_at,
  };
}

export function errorDesdeRpc(code?: string, message?: string): ResultadoVinculoPropiedad {
  if (code === "42501" || message?.includes("FORBIDDEN")) return { ok: false, error: "FORBIDDEN" };
  if (code === "P0002" || message?.includes("FINCA_NOT_FOUND")) return { ok: false, error: "NOT_FOUND" };
  if (message?.includes("OFERTANTE_REQUIRED")) return { ok: false, error: "OFERTANTE_REQUIRED" };
  if (message?.includes("propiedades") && !message.includes("catastro_property_links")) {
    return { ok: false, error: "PROPERTY_FAILED" };
  }
  if (message?.includes("catastro_property_links")) return { ok: false, error: "LINK_FAILED" };
  return { ok: false, error: "FAILED" };
}

export function createCrmPropertyIntegration(client: PropertyIntegrationClient): CatastroPropertyIntegration {
  return {
    async findLinksByFincaReference(fincaReference) {
      const { data, error } = await client
        .from("catastro_property_links")
        .select("finca_reference, property_id, source, linked_at")
        .eq("finca_reference", fincaReference)
        .maybeSingle();
      if (error || !data) return [];
      return [linkDesdeFila(data)];
    },
    async findLinksByFincaReferences(fincaReferences) {
      if (fincaReferences.length === 0) return [];
      const { data, error } = await client
        .from("catastro_property_links")
        .select("finca_reference, property_id, source, linked_at")
        .in("finca_reference", fincaReferences);
      if (error) return [];
      return (data ?? []).map(linkDesdeFila);
    },
    async createPropertyFromCatastro(input) {
      const { data, error } = await client.rpc("crear_propiedad_desde_catastro", {
        p_finca_reference: input.datos.fincaReference,
        p_titulo: input.datos.titulo,
        p_direccion: input.datos.direccion,
        p_codigo_postal: input.datos.codigoPostal,
        p_localidad: input.datos.localidad,
        p_superficie_parcela: input.datos.superficieSolar,
        p_ofertante_id: input.ofertanteId,
      });
      if (error) return errorDesdeRpc(error.code, error.message);
      const cuerpo = data as { propertyId?: string; created?: boolean; fincaReference?: string } | null;
      if (!cuerpo?.propertyId) return { ok: false, error: "PROPERTY_FAILED" };
      return {
        ok: true,
        created: Boolean(cuerpo.created),
        link: {
          fincaReference: cuerpo.fincaReference ?? input.datos.fincaReference,
          propertyId: cuerpo.propertyId,
          source: ORIGEN_CATASTRO_EXPLORER,
          linkedAt: input.now,
        },
      };
    },
  };
}
