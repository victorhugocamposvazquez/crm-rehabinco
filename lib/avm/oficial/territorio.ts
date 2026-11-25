/**
 * Provincias y comunidades autónomas con sus códigos INE, y normalización de
 * nombres para casar las tablas del Ministerio y del INE (que escriben
 * "Coruña (A)", "La Coruña", "Coruña, A" o "A Coruña" según la tabla).
 */

export interface Provincia { codigo: string; ccaa: string; nombres: string[] }

export const CCAA: Record<string, string[]> = {
  "01": ["Andalucía"],
  "02": ["Aragón"],
  "03": ["Principado de Asturias", "Asturias, Principado de", "Asturias (Principado de)"],
  "04": ["Illes Balears", "Balears, Illes", "Balears (Illes)", "Baleares"],
  "05": ["Canarias"],
  "06": ["Cantabria"],
  "07": ["Castilla y León"],
  "08": ["Castilla-La Mancha", "Castilla - La Mancha"],
  "09": ["Cataluña", "Catalunya"],
  "10": ["Comunitat Valenciana", "Comunidad Valenciana"],
  "11": ["Extremadura"],
  "12": ["Galicia"],
  "13": ["Comunidad de Madrid", "Madrid, Comunidad de", "Madrid (Comunidad de)"],
  "14": ["Región de Murcia", "Murcia, Región de", "Murcia (Región de)"],
  "15": ["Comunidad Foral de Navarra", "Navarra, Comunidad Foral de", "Navarra (Comunidad Foral de)", "Navarra (Com. Foral de)"],
  "16": ["País Vasco", "Euskadi"],
  "17": ["La Rioja", "Rioja, La"],
  "18": ["Ceuta"],
  "19": ["Melilla"],
};

export const PROVINCIAS: Provincia[] = [
  { codigo: "01", ccaa: "16", nombres: ["Araba/Álava", "Álava", "Araba"] },
  { codigo: "02", ccaa: "08", nombres: ["Albacete"] },
  { codigo: "03", ccaa: "10", nombres: ["Alicante/Alacant", "Alicante", "Alacant"] },
  { codigo: "04", ccaa: "01", nombres: ["Almería"] },
  { codigo: "05", ccaa: "07", nombres: ["Ávila"] },
  { codigo: "06", ccaa: "11", nombres: ["Badajoz"] },
  { codigo: "07", ccaa: "04", nombres: ["Illes Balears", "Balears (Illes)", "Baleares"] },
  { codigo: "08", ccaa: "09", nombres: ["Barcelona"] },
  { codigo: "09", ccaa: "07", nombres: ["Burgos"] },
  { codigo: "10", ccaa: "11", nombres: ["Cáceres"] },
  { codigo: "11", ccaa: "01", nombres: ["Cádiz"] },
  { codigo: "12", ccaa: "10", nombres: ["Castellón/Castelló", "Castellón", "Castelló"] },
  { codigo: "13", ccaa: "08", nombres: ["Ciudad Real"] },
  { codigo: "14", ccaa: "01", nombres: ["Córdoba"] },
  { codigo: "15", ccaa: "12", nombres: ["A Coruña", "La Coruña", "Coruña (A)"] },
  { codigo: "16", ccaa: "08", nombres: ["Cuenca"] },
  { codigo: "17", ccaa: "09", nombres: ["Girona", "Gerona"] },
  { codigo: "18", ccaa: "01", nombres: ["Granada"] },
  { codigo: "19", ccaa: "08", nombres: ["Guadalajara"] },
  { codigo: "20", ccaa: "16", nombres: ["Gipuzkoa", "Guipúzcoa"] },
  { codigo: "21", ccaa: "01", nombres: ["Huelva"] },
  { codigo: "22", ccaa: "02", nombres: ["Huesca"] },
  { codigo: "23", ccaa: "01", nombres: ["Jaén"] },
  { codigo: "24", ccaa: "07", nombres: ["León"] },
  { codigo: "25", ccaa: "09", nombres: ["Lleida", "Lérida"] },
  { codigo: "26", ccaa: "17", nombres: ["La Rioja", "Rioja (La)"] },
  { codigo: "27", ccaa: "12", nombres: ["Lugo"] },
  { codigo: "28", ccaa: "13", nombres: ["Madrid"] },
  { codigo: "29", ccaa: "01", nombres: ["Málaga"] },
  { codigo: "30", ccaa: "14", nombres: ["Murcia"] },
  { codigo: "31", ccaa: "15", nombres: ["Navarra"] },
  { codigo: "32", ccaa: "12", nombres: ["Ourense", "Orense"] },
  { codigo: "33", ccaa: "03", nombres: ["Asturias"] },
  { codigo: "34", ccaa: "07", nombres: ["Palencia"] },
  { codigo: "35", ccaa: "05", nombres: ["Las Palmas", "Palmas (Las)"] },
  { codigo: "36", ccaa: "12", nombres: ["Pontevedra"] },
  { codigo: "37", ccaa: "07", nombres: ["Salamanca"] },
  { codigo: "38", ccaa: "05", nombres: ["Santa Cruz de Tenerife", "S.C. Tenerife"] },
  { codigo: "39", ccaa: "06", nombres: ["Cantabria"] },
  { codigo: "40", ccaa: "07", nombres: ["Segovia"] },
  { codigo: "41", ccaa: "01", nombres: ["Sevilla"] },
  { codigo: "42", ccaa: "07", nombres: ["Soria"] },
  { codigo: "43", ccaa: "09", nombres: ["Tarragona"] },
  { codigo: "44", ccaa: "02", nombres: ["Teruel"] },
  { codigo: "45", ccaa: "08", nombres: ["Toledo"] },
  { codigo: "46", ccaa: "10", nombres: ["Valencia/València", "Valencia", "València"] },
  { codigo: "47", ccaa: "07", nombres: ["Valladolid"] },
  { codigo: "48", ccaa: "16", nombres: ["Bizkaia", "Vizcaya"] },
  { codigo: "49", ccaa: "07", nombres: ["Zamora"] },
  { codigo: "50", ccaa: "02", nombres: ["Zaragoza"] },
  { codigo: "51", ccaa: "18", nombres: ["Ceuta"] },
  { codigo: "52", ccaa: "19", nombres: ["Melilla"] },
];

const ARTICULOS = new Set(["a", "o", "os", "as", "el", "la", "los", "las", "les", "es", "sa", "ses", "l", "s", "lo"]);

/**
 * Clave de comparación: minúsculas, sin tildes, con el artículo pospuesto
 * ("Coruña (A)", "Coruña, A") y antepuesto ("A Coruña", "L'Hospitalet") quitado,
 * y sin notas ("Oza-Cesuras * Unión de…").
 */
export function claveNombre(nombre: string): string {
  let s = nombre.split(" * ")[0].replace(/\*+$/, "");
  s = s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  s = s.replace(/\s*\(([^)]*)\)\s*$/, (_m, art: string) => (ARTICULOS.has(art.trim().replace(/'$/, "")) ? "" : ` ${art}`));
  s = s.replace(/,\s*([a-z']+)\s*$/, (m, art: string) => (ARTICULOS.has(art.replace(/'$/, "")) ? "" : m));
  s = s.replace(/[^a-z0-9ñ]+/g, " ").trim();
  const palabras = s.split(" ");
  while (palabras.length > 1 && ARTICULOS.has(palabras[0])) palabras.shift();
  return palabras.join(" ");
}

/** Todas las claves de un nombre bilingüe ("Alicante/Alacant", "Donostia/San Sebastián"). */
export function clavesNombre(nombre: string): string[] {
  const partes = nombre.split("/").map((p) => p.trim()).filter(Boolean);
  return [...new Set([claveNombre(nombre), ...partes.map(claveNombre)])].filter(Boolean);
}

const PROV_POR_CLAVE = new Map<string, string>();
for (const p of PROVINCIAS) for (const n of p.nombres) for (const k of clavesNombre(n)) PROV_POR_CLAVE.set(k, p.codigo);
const CCAA_POR_CLAVE = new Map<string, string>();
for (const [c, ns] of Object.entries(CCAA)) for (const n of ns) for (const k of clavesNombre(n)) CCAA_POR_CLAVE.set(k, c);

export function codigoProvincia(nombre: string): string | null {
  for (const k of clavesNombre(nombre)) {
    const c = PROV_POR_CLAVE.get(k);
    if (c) return c;
  }
  return null;
}

export function codigoCcaa(nombre: string): string | null {
  for (const k of clavesNombre(nombre)) {
    const c = CCAA_POR_CLAVE.get(k);
    if (c) return c;
  }
  return null;
}

/**
 * Provincia y comunidad de una fila de tabla. Las comunidades uniprovinciales
 * ("MADRID (COMUNIDAD DE)", "Asturias (Principado de )") llevan también su provincia,
 * porque el Ministerio no repite la fila.
 */
export function ambitoDeNombre(nombre: string): { provincia: string | null; ccaa: string | null } {
  const ccaa = codigoCcaa(nombre);
  let provincia = codigoProvincia(nombre);
  if (!provincia && ccaa) {
    const provs = provinciasDeCcaa(ccaa);
    if (provs.length === 1) provincia = provs[0];
  }
  return { provincia, ccaa };
}

export function ccaaDeProvincia(codigoProv: string): string | null {
  return PROVINCIAS.find((p) => p.codigo === codigoProv)?.ccaa ?? null;
}

export function provinciasDeCcaa(codigoCcaa: string): string[] {
  return PROVINCIAS.filter((p) => p.ccaa === codigoCcaa).map((p) => p.codigo);
}

export function nombreCcaa(codigo: string): string | null {
  return CCAA[codigo]?.[0] ?? null;
}

export function nombreProvincia(codigo: string): string | null {
  return PROVINCIAS.find((p) => p.codigo === codigo)?.nombres[0] ?? null;
}

/** Catálogo de municipios (catastro_municipios) para casar nombres con su código INE. */
export interface MunicipioCatalogo { ine: string; nombres: string[] }

/** Partes de un nombre compuesto ("Donostia-San Sebastián", "Oza-Cesuras"), para un segundo intento. */
function partesNombre(nombre: string): string[] {
  return nombre.split(" * ")[0].split(/\s*[/-]\s*/).map(claveNombre).filter((k) => k.length > 3);
}

export class CatalogoMunicipios {
  private porClave = new Map<string, string[]>();
  private porParte = new Map<string, string[]>();
  constructor(municipios: MunicipioCatalogo[]) {
    const meter = (mapa: Map<string, string[]>, k: string, ine: string) => {
      const lista = mapa.get(k) ?? [];
      if (!lista.includes(ine)) lista.push(ine);
      mapa.set(k, lista);
    };
    for (const m of municipios) {
      for (const n of m.nombres) {
        for (const k of clavesNombre(n)) meter(this.porClave, k, m.ine);
        for (const k of partesNombre(n)) meter(this.porParte, k, m.ine);
      }
    }
  }

  private exactos(nombre: string): string[] {
    return [...new Set(clavesNombre(nombre).flatMap((k) => this.porClave.get(k) ?? []))];
  }

  /** Segundo intento: alguna parte del nombre compuesto coincide con una parte del catálogo. */
  private porPartes(nombre: string): string[] {
    return [...new Set([claveNombre(nombre), ...partesNombre(nombre)].flatMap((k) => this.porParte.get(k) ?? []))];
  }

  /**
   * Código INE del municipio. `provincia` es una pista: si el nombre es único
   * en España se acepta aunque la pista no cuadre (la tabla de valor tasado
   * a veces arrastra la provincia de la fila anterior).
   */
  resolver(nombre: string, provincia?: string | null): string | null {
    const exactos = this.exactos(nombre);
    if (exactos.length === 1) return exactos[0];
    return provincia ? this.resolverEnProvincia(nombre, provincia) : null;
  }

  /** Con la provincia obligatoria (tablas con miles de municipios y nombres repetidos). */
  resolverEnProvincia(nombre: string, provincia: string): string | null {
    const unico = (xs: string[]) => {
      const enProv = xs.filter((c) => c.startsWith(provincia));
      return enProv.length === 1 ? enProv[0] : null;
    };
    const exactos = this.exactos(nombre).filter((c) => c.startsWith(provincia));
    if (exactos.length) return unico(exactos);
    return unico(this.porPartes(nombre));
  }
}
