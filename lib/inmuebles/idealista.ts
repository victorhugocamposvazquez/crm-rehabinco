/**
 * Tipología y visibilidad alineadas con el alta profesional de Idealista
 * (vivienda, edificio, local, etc. y showAddress / solo calle).
 */

export const IDEALISTA_TIPOS = [
  "piso",
  "atico",
  "duplex",
  "estudio",
  "bajo",
  "chalet",
  "adosado",
  "casa_pueblo",
  "edificio",
  "local",
  "oficina",
  "garaje",
  "trastero",
  "terreno",
  "nave",
] as const;

export type IdealistaTipo = (typeof IDEALISTA_TIPOS)[number];

export const IDEALISTA_TIPO_LABEL: Record<IdealistaTipo, string> = {
  piso: "Piso",
  atico: "Ático",
  duplex: "Dúplex",
  estudio: "Estudio",
  bajo: "Bajo / planta baja",
  chalet: "Chalet / casa",
  adosado: "Casa adosada",
  casa_pueblo: "Casa de pueblo",
  edificio: "Edificio",
  local: "Local comercial",
  oficina: "Oficina",
  garaje: "Garaje",
  trastero: "Trastero",
  terreno: "Terreno / solar",
  nave: "Nave industrial",
};

/** Códigos habituales en APIs / feeds de Idealista. */
export const IDEALISTA_TIPO_API: Record<IdealistaTipo, string> = {
  piso: "flat",
  atico: "penthouse",
  duplex: "duplex",
  estudio: "studio",
  bajo: "groundFloor",
  chalet: "chalet",
  adosado: "semidetachedHouse",
  casa_pueblo: "countryHouse",
  edificio: "building",
  local: "premise",
  oficina: "office",
  garaje: "garage",
  trastero: "storageRoom",
  terreno: "land",
  nave: "industrial",
};

export const IDEALISTA_VISIBILIDAD = ["exacta", "solo_calle", "oculta"] as const;
export type IdealistaVisibilidadDireccion = (typeof IDEALISTA_VISIBILIDAD)[number];

export const IDEALISTA_VISIBILIDAD_LABEL: Record<IdealistaVisibilidadDireccion, string> = {
  exacta: "Dirección exacta",
  solo_calle: "Mostrar sólo calle",
  oculta: "Ocultar dirección",
};

export const IDEALISTA_VISIBILIDAD_AYUDA: Record<IdealistaVisibilidadDireccion, string> = {
  exacta: "Recomendado",
  solo_calle: "Mantiene la confidencialidad y ayuda al usuario a ubicar tu inmueble",
  oculta: "Transmite poca confianza al usuario",
};

const VIVIENDA = new Set<IdealistaTipo>([
  "piso",
  "atico",
  "duplex",
  "estudio",
  "bajo",
  "chalet",
  "adosado",
  "casa_pueblo",
]);

const CON_CERTIFICADO = new Set<IdealistaTipo>([
  ...VIVIENDA,
  "local",
  "oficina",
  "nave",
]);

export function parseIdealistaTipo(valor: string | null | undefined): IdealistaTipo | null {
  if (!valor) return null;
  return (IDEALISTA_TIPOS as readonly string[]).includes(valor) ? (valor as IdealistaTipo) : null;
}

export function parseIdealistaVisibilidad(valor: string | null | undefined): IdealistaVisibilidadDireccion {
  if (valor && (IDEALISTA_VISIBILIDAD as readonly string[]).includes(valor)) {
    return valor as IdealistaVisibilidadDireccion;
  }
  return "exacta";
}

/** Tipo efectivo para validar el volcado (Idealista explícito o inferido del CRM). */
export function tipoIdealistaEfectivo(idealista_tipo: string, tipo_inmueble: string): IdealistaTipo | null {
  return parseIdealistaTipo(idealista_tipo) ?? idealistaTipoDesdeTipoInmueble(tipo_inmueble);
}

export function idealistaTipoDesdeTipoInmueble(tipo_inmueble: string | null | undefined): IdealistaTipo | null {
  const t = (tipo_inmueble ?? "").toLowerCase();
  const map: Record<string, IdealistaTipo> = {
    piso: "piso",
    atico: "atico",
    bajo: "bajo",
    chalet: "chalet",
    adosado: "adosado",
    local: "local",
    oficina: "oficina",
    nave: "nave",
    solar: "terreno",
    garaje: "garaje",
    trastero: "trastero",
    edificio: "edificio",
  };
  return map[t] ?? null;
}

export function esViviendaIdealista(tipo: IdealistaTipo | null): boolean {
  return tipo != null && VIVIENDA.has(tipo);
}

export function requiereCertificadoIdealista(tipo: IdealistaTipo | null): boolean {
  return tipo != null && CON_CERTIFICADO.has(tipo);
}

export function esTerrenoIdealista(tipo: IdealistaTipo | null): boolean {
  return tipo === "terreno";
}

/** Valores de visibilidad para integraciones (showAddress, streetNumber, etc.). */
export function idealistaShowAddressApi(visibilidad: IdealistaVisibilidadDireccion): boolean {
  return visibilidad !== "oculta";
}

export function idealistaSoloCalleApi(visibilidad: IdealistaVisibilidadDireccion): boolean {
  return visibilidad === "solo_calle";
}
