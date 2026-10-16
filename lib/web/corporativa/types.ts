export type ModoCorporativa = "venta" | "alquiler";

export type InmuebleCorporativa = {
  slug: string;
  origen: "crm" | "mock";
  modo: ModoCorporativa;
  tipo: string;
  titulo: string;
  zona: string;
  municipio: string;
  precio: number;
  dormitorios: number;
  banos: number;
  m2: number;
  ref: string;
  extras: string[];
  estadoLabel: string;
  fotoPrincipal: string;
  fotos: string[];
  descripcion: string;
  descripcionLarga?: string[];
};

export type CatalogoCorporativa = {
  publicado: boolean;
  inmuebles: InmuebleCorporativa[];
};
