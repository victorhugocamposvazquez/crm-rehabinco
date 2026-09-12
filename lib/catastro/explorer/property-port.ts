/**
 * Puerto de integración con un módulo Property del host.
 * Catastro Explorer no importa Property, clientes ni Supabase.
 */
import type { CatastroFinca } from "./types";

export const ORIGEN_CATASTRO_EXPLORER = "CATASTRO_EXPLORER" as const;

export type OrigenCatastroExplorer = typeof ORIGEN_CATASTRO_EXPLORER;

export type CatastroPropertyLink = {
  fincaReference: string;
  propertyId: string;
  source: OrigenCatastroExplorer;
  linkedAt: string;
};

export type DatosPropiedadDesdeCatastro = {
  fincaReference: string;
  titulo: string;
  direccion: string;
  codigoPostal: string;
  localidad: string;
  superficieSolar: number | null;
  horizontalDivision: {
    status: string;
    reasonCode?: string;
  };
};

export type ResultadoVinculoPropiedad =
  | { ok: true; created: boolean; link: CatastroPropertyLink }
  | {
      ok: false;
      error: "NOT_FOUND" | "FORBIDDEN" | "FAILED" | "PROPERTY_FAILED" | "LINK_FAILED" | "OFERTANTE_REQUIRED";
    };

export type ResultadoActualizacionCatastro =
  | {
      ok: true;
      executed: false;
      reason: "NOT_IMPLEMENTED";
      fincaReference: string;
      lastSeenAt: string | null;
      reciente: boolean;
    }
  | { ok: false; error: "NOT_FOUND" };

export type CatastroPropertyIntegration = {
  findLinksByFincaReference(fincaReference: string): Promise<CatastroPropertyLink[]>;
  findLinksByFincaReferences(fincaReferences: string[]): Promise<CatastroPropertyLink[]>;
  createPropertyFromCatastro(input: {
    finca: CatastroFinca;
    datos: DatosPropiedadDesdeCatastro;
    userId: string;
    now: string;
    ofertanteId: string;
  }): Promise<ResultadoVinculoPropiedad>;
};
