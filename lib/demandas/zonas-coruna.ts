import { normalizarLocalidad } from "@/lib/geo/municipios";

export type ZonaCiudad = {
  nombre: string;
  /** Frases que identifican el distrito en localidad, dirección o título. */
  claves: string[];
};

/**
 * Distritos de la ciudad, con los nombres que se ven en los portales.
 * El resto de España se elige por municipio: no hace falta el árbol nacional de barrios.
 */
export const DISTRITOS_A_CORUNA: ZonaCiudad[] = [
  { nombre: "Ciudad Vieja - Centro", claves: ["ciudad vieja"] },
  { nombre: "Ensanche - Juan Flórez", claves: ["ensanche", "juan florez"] },
  { nombre: "Monte Alto - Zalaeta - Atocha", claves: ["monte alto", "zalaeta", "atocha"] },
  { nombre: "Riazor - Visma", claves: ["riazor", "visma"] },
  { nombre: "Agra del Orzán - Ventorrillo", claves: ["agra del orzan", "agra do orzan", "ventorrillo"] },
  { nombre: "Los Castros - Castrillón", claves: ["los castros", "castrillon"] },
  { nombre: "Cuatro Caminos - Plaza de la Cubela", claves: ["cuatro caminos", "plaza de la cubela"] },
  { nombre: "Os Mallos", claves: ["os mallos", "mallos"] },
  { nombre: "Sagrada Familia", claves: ["sagrada familia"] },
  { nombre: "Someso - Matogrande", claves: ["someso", "matogrande"] },
  { nombre: "Eirís", claves: ["eiris"] },
  { nombre: "Elviña - A Zapateira", claves: ["elvina", "zapateira"] },
  { nombre: "Mesoiro", claves: ["mesoiro"] },
  { nombre: "Los Rosales", claves: ["los rosales"] },
  { nombre: "Vioño", claves: ["viono"] },
];

/** Municipios del área, para marcarlos sin buscar. */
export const ALREDEDORES_A_CORUNA = [
  "A Coruña",
  "Oleiros",
  "Arteixo",
  "Culleredo",
  "Sada",
  "Cambre",
  "Bergondo",
  "Carral",
  "Abegondo",
] as const;

const POR_NOMBRE = new Map(DISTRITOS_A_CORUNA.map((zona) => [normalizarLocalidad(zona.nombre), zona]));

export function distritoACoruna(nombre: string): ZonaCiudad | undefined {
  return POR_NOMBRE.get(normalizarLocalidad(nombre));
}

function contieneFrase(texto: string, frase: string): boolean {
  if (!frase) return false;
  const esc = frase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${esc}(?:$|[^a-z0-9])`).test(texto);
}

function esCiudadCoruna(localidad: string, cp: string): boolean {
  const postal = cp.replace(/\s/g, "");
  if (/^150\d{2}$/.test(postal)) return true;
  const l = normalizarLocalidad(localidad);
  return l === "coruna" || l.startsWith("a coruna") || l.includes("coruna capital");
}

/**
 * Un distrito de A Coruña encaja si alguna clave está en el inmueble
 * y el piso está en la ciudad, o la propia localidad ya es ese barrio.
 */
export function inmuebleEnDistrito(
  zona: string,
  sitio: { localidad?: string | null; direccion?: string | null; titulo?: string | null; codigoPostal?: string | null }
): boolean {
  const distrito = distritoACoruna(zona);
  if (!distrito) return false;
  const localidad = sitio.localidad ?? "";
  const texto = normalizarLocalidad([sitio.localidad, sitio.direccion, sitio.titulo].filter(Boolean).join(" "));
  const claves = distrito.claves.map((clave) => normalizarLocalidad(clave));
  const hayClave = claves.some((clave) => contieneFrase(texto, clave));
  if (!hayClave) return false;
  if (!normalizarLocalidad(localidad)) return true;
  if (esCiudadCoruna(localidad, sitio.codigoPostal ?? "")) return true;
  return claves.some((clave) => contieneFrase(normalizarLocalidad(localidad), clave));
}
