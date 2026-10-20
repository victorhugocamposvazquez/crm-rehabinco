import { OFICINA, WA } from "@/lib/web/corporativa/contenido";
import {
  esTerrenoIdealista,
  esViviendaIdealista,
  type IdealistaTipo,
  type IdealistaVisibilidadDireccion,
  parseIdealistaVisibilidad,
  tipoIdealistaEfectivo,
} from "../idealista";
import { faltasIdealista, type DatosPublicacion } from "../publicacion";

export type PropiedadFeed = {
  id: string;
  referencia: string | null;
  idealista_codigo: string | null;
  titulo: string | null;
  direccion: string | null;
  codigo_postal: string | null;
  localidad: string | null;
  tipo_operacion: string;
  precio_venta: number | null;
  precio_alquiler: number | null;
  superficie_m2: number | null;
  superficie_construida: number | null;
  superficie_parcela: number | null;
  habitaciones: number | null;
  banos: number | null;
  planta: string | null;
  descripcion: string | null;
  certificado_energetico: string | null;
  tipo_inmueble: string | null;
  idealista_tipo: string | null;
  idealista_visibilidad_direccion: string | null;
  ascensor: boolean | null;
  garaje: boolean | null;
  terraza: boolean | null;
  anio_construccion: number | null;
  tour_url: string | null;
  updated_at?: string | null;
  fotos: string[];
};

const FEATURES_TYPE: Record<IdealistaTipo, string> = {
  piso: "flat",
  atico: "penthouse",
  duplex: "duplex",
  estudio: "studio",
  bajo: "groundFloor",
  chalet: "chalet",
  adosado: "semidetachedHouse",
  casa_pueblo: "countryHouse",
  edificio: "building",
  local: "premises",
  oficina: "office",
  garaje: "garage",
  trastero: "storageRoom",
  terreno: "land",
  nave: "industrial",
};

function fechaEnvio(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function visibilidadDireccion(v: IdealistaVisibilidadDireccion): string {
  if (v === "exacta") return "full";
  if (v === "solo_calle") return "street";
  return "hidden";
}

function certificadoEnergy(rating: string | null | undefined): string | undefined {
  const r = (rating ?? "").trim().toLowerCase();
  if (!r) return undefined;
  if (r === "exento") return "exempt";
  if (r === "en_tramite") return "G";
  const letra = r.toUpperCase();
  if (/^[A-G]$/.test(letra)) return letra;
  return undefined;
}

function propertyCode(p: PropiedadFeed): string {
  const custom = p.idealista_codigo?.trim();
  if (custom) return custom.slice(0, 50);
  const ref = p.referencia?.trim();
  if (ref) return ref.replace(/\s+/g, "-").slice(0, 50);
  return p.id.replace(/-/g, "").slice(0, 50);
}

function propertyReference(p: PropiedadFeed): string {
  return (p.referencia?.trim() || p.id).slice(0, 50);
}

function datosPublicacion(p: PropiedadFeed): DatosPublicacion {
  return {
    tipo_inmueble: p.tipo_inmueble ?? "",
    idealista_tipo: p.idealista_tipo ?? "",
    idealista_visibilidad_direccion: p.idealista_visibilidad_direccion ?? "exacta",
    tipo_operacion: p.tipo_operacion as DatosPublicacion["tipo_operacion"],
    precio_venta: p.precio_venta != null ? String(p.precio_venta) : "",
    precio_alquiler: p.precio_alquiler != null ? String(p.precio_alquiler) : "",
    direccion: p.direccion ?? "",
    titulo: p.titulo ?? "",
    codigo_postal: p.codigo_postal ?? "",
    localidad: p.localidad ?? "",
    superficie_m2: p.superficie_m2 != null ? String(p.superficie_m2) : "",
    superficie_construida: p.superficie_construida != null ? String(p.superficie_construida) : "",
    superficie_parcela: p.superficie_parcela != null ? String(p.superficie_parcela) : "",
    habitaciones: p.habitaciones != null ? String(p.habitaciones) : "",
    banos: p.banos != null ? String(p.banos) : "",
    descripcion: p.descripcion ?? "",
    certificado_energetico: p.certificado_energetico ?? "",
    fotos: p.fotos.length,
  };
}

function operaciones(p: PropiedadFeed): Array<{ operationType: "sale" | "rent"; price: number }> {
  const ops: Array<{ operationType: "sale" | "rent"; price: number }> = [];
  const venta = p.precio_venta;
  const alquiler = p.precio_alquiler;
  if (p.tipo_operacion === "venta" || p.tipo_operacion === "ambos") {
    if (venta != null && venta > 0) ops.push({ operationType: "sale", price: Math.round(venta) });
  }
  if (p.tipo_operacion === "alquiler" || p.tipo_operacion === "ambos") {
    if (alquiler != null && alquiler > 0) ops.push({ operationType: "rent", price: Math.round(alquiler) });
  }
  return ops;
}

function plantaNumero(planta: string | null | undefined): string | undefined {
  const t = (planta ?? "").trim();
  if (!t) return undefined;
  const bajo = /bajo|entresuelo|s[óo]tano|semisótano/i.test(t);
  if (bajo) return "0";
  const m = t.match(/\d+/);
  return m ? m[0] : undefined;
}

function featuresBlock(tipo: IdealistaTipo, p: PropiedadFeed): Record<string, unknown> {
  const terreno = esTerrenoIdealista(tipo);
  const construida = p.superficie_construida ?? p.superficie_m2;
  const parcela = p.superficie_parcela ?? p.superficie_m2;
  const energy = certificadoEnergy(p.certificado_energetico);
  const base: Record<string, unknown> = {
    featuresType: FEATURES_TYPE[tipo],
  };

  if (terreno) {
    base.featuresAreaPlot = Math.round(parcela ?? 0);
    return base;
  }

  if (tipo === "garaje" || tipo === "trastero") {
    if (construida) base.featuresAreaConstructed = Math.round(construida);
    return base;
  }

  if (construida) base.featuresAreaConstructed = Math.round(construida);
  if (p.superficie_m2 && p.superficie_m2 !== construida) {
    base.featuresAreaUsable = Math.round(p.superficie_m2);
  }
  if (esViviendaIdealista(tipo)) {
    if (p.habitaciones != null) base.featuresBedroomNumber = Math.max(0, Math.round(p.habitaciones));
    if (p.banos != null) base.featuresBathroomNumber = Math.max(1, Math.round(p.banos));
    if (tipo === "estudio") base.featuresStudio = true;
    if (p.ascensor) base.featuresLiftAvailable = true;
    if (p.garaje) base.featuresParkingAvailable = true;
    if (p.terraza) base.featuresTerrace = true;
  }
  if (p.anio_construccion && p.anio_construccion >= 1000 && p.anio_construccion <= 2999) {
    base.featuresBuiltYear = p.anio_construccion;
  }
  if (energy) base.featuresEnergyCertificateRating = energy;
  return base;
}

function buildPropertyEntry(
  p: PropiedadFeed,
  op: { operationType: "sale" | "rent"; price: number },
  contact: { contactName: string; contactEmail: string; contactPrimaryPhonePrefix: string; contactPrimaryPhoneNumber: string }
) {
  const tipo = tipoIdealistaEfectivo(p.idealista_tipo ?? "", p.tipo_inmueble ?? "")!;
  const visibilidad = parseIdealistaVisibilidad(p.idealista_visibilidad_direccion);
  const desc = (p.descripcion ?? p.titulo ?? "").trim().slice(0, 4000);
  const floor = plantaNumero(p.planta);

  return {
    propertyCode: propertyCode(p),
    propertyReference: propertyReference(p),
    propertyVisibility: "idealista",
    propertyOperation: {
      operationType: op.operationType,
      operationPrice: op.price,
    },
    propertyContact: contact,
    propertyAddress: {
      addressVisibility: visibilidadDireccion(visibilidad),
      addressStreetName: (p.direccion ?? p.titulo ?? "Sin dirección").trim().slice(0, 200),
      ...(floor ? { addressFloor: floor } : {}),
      addressPostalCode: p.codigo_postal!.trim(),
      addressTown: p.localidad!.trim(),
      addressCountry: "Spain",
    },
    propertyFeatures: featuresBlock(tipo, p),
    propertyDescriptions: [
      {
        descriptionLanguage: "spanish",
        descriptionText: desc.length >= 50 ? desc : `${desc}. Contacta con Rehabinco para más información.`,
      },
    ],
    propertyImages: p.fotos.map((url, i) => ({
      imageOrder: i + 1,
      imageUrl: url,
    })),
  };
}

export type ResultadoBuildFeed = {
  customer: Record<string, unknown>;
  enviados: number;
  omitidos: Array<{ id: string; referencia: string | null; motivos: string[] }>;
};

export function anunciosIdealistaDePropiedad(
  customerCode: string,
  propiedad: PropiedadFeed,
  contacto?: Partial<{ name: string; email: string; phone: string }>
): { anuncios: Record<string, unknown>[]; motivos: string[] } {
  const { customer, omitidos } = construirFeedIdealista(customerCode, [propiedad], contacto);
  const anuncios = Array.isArray(customer.customerProperties)
    ? (customer.customerProperties as Record<string, unknown>[])
    : [];
  return { anuncios, motivos: omitidos[0]?.motivos ?? [] };
}

export function construirFeedIdealista(
  customerCode: string,
  propiedades: PropiedadFeed[],
  contacto?: Partial<{ name: string; email: string; phone: string }>
): ResultadoBuildFeed {
  const phone = (contacto?.phone ?? OFICINA.telefono).replace(/\D/g, "");
  const contact = {
    contactName: (contacto?.name ?? "Rehabinco").slice(0, 100),
    contactEmail: (contacto?.email ?? OFICINA.email).slice(0, 100),
    contactPrimaryPhonePrefix: phone.startsWith("34") ? "34" : "34",
    contactPrimaryPhoneNumber: phone.startsWith("34") ? phone.slice(2) : phone || WA.slice(2),
  };

  const customerProperties: Record<string, unknown>[] = [];
  const omitidos: ResultadoBuildFeed["omitidos"] = [];

  for (const p of propiedades) {
    const faltas = faltasIdealista(datosPublicacion(p));
    const ops = operaciones(p);
    if (faltas.length) {
      omitidos.push({ id: p.id, referencia: p.referencia, motivos: faltas });
      continue;
    }
    if (!ops.length) {
      omitidos.push({ id: p.id, referencia: p.referencia, motivos: ["precio de operación"] });
      continue;
    }
    for (const op of ops) {
      customerProperties.push(buildPropertyEntry(p, op, contact));
    }
  }

  const customer = {
    customerCountry: "Spain",
    customerCode: customerCode.trim(),
    customerReference: "crm-rehabinco",
    customerSendDate: fechaEnvio(),
    customerContact: contact,
    customerProperties,
  };

  return { customer, enviados: customerProperties.length, omitidos };
}
