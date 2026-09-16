import { EMPRESA_DOCUMENTOS, formatFechaEncabezado } from "./empresa-documentos";

export type TratamientoPersona = "Don" | "Doña";

export const ESTADOS_CIVILES = [
  { value: "soltero", don: "soltero", dona: "soltera", labelDon: "Soltero", labelDona: "Soltera" },
  { value: "casado", don: "casado", dona: "casada", labelDon: "Casado", labelDona: "Casada" },
  { value: "divorciado", don: "divorciado", dona: "divorciada", labelDon: "Divorciado", labelDona: "Divorciada" },
  { value: "viudo", don: "viudo", dona: "viuda", labelDon: "Viudo", labelDona: "Viuda" },
  { value: "separado", don: "separado", dona: "separada", labelDon: "Separado", labelDona: "Separada" },
  { value: "pareja de hecho", don: "pareja de hecho", dona: "pareja de hecho", labelDon: "Pareja de hecho", labelDona: "Pareja de hecho" },
] as const;

export type EstadoCivilArras = (typeof ESTADOS_CIVILES)[number]["value"];

export type PersonaArras = {
  tratamiento: TratamientoPersona;
  nombre: string;
  estado_civil: string;
  vecindad: string;
  domicilio: string;
  dni: string;
};

export function normalizarEstadoCivil(raw: string): string {
  const t = raw.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (!t) return "";
  for (const e of ESTADOS_CIVILES) {
    const aliases = [e.value, e.don, e.dona, e.labelDon, e.labelDona].map((s) => s.toLowerCase());
    if (aliases.includes(t) || t === `${e.don}/${e.dona}` || t === `${e.don}/a`) return e.value;
  }
  if (t === "union de hecho" || t === "unión de hecho") return "pareja de hecho";
  return raw.trim();
}

export function etiquetaEstadoCivil(p: PersonaArras): string {
  const value = normalizarEstadoCivil(p.estado_civil);
  const opt = ESTADOS_CIVILES.find((e) => e.value === value);
  if (!opt) return hueco(p.estado_civil);
  return p.tratamiento === "Doña" ? opt.dona : opt.don;
}

export type ContratoArrasDatos = {
  lugar: string;
  fecha: string | null;
  vendedores: PersonaArras[];
  compradores: PersonaArras[];
  finca_descripcion: string;
  finca_anejos: string;
  registro_libro: string;
  registro_folio: string;
  registro_finca: string;
  registro_numero: string;
  precio: number | null;
  arras: number | null;
  cuenta_vendedora: string;
  plazo_escritura_dias: number | null;
  incluye_anejos: boolean;
  hay_hipoteca: boolean;
};

export function personaArrasVacia(tratamiento: TratamientoPersona = "Don"): PersonaArras {
  return {
    tratamiento,
    nombre: "",
    estado_civil: "",
    vecindad: EMPRESA_DOCUMENTOS.lugar,
    domicilio: "",
    dni: "",
  };
}

export function contratoArrasVacio(): ContratoArrasDatos {
  return {
    lugar: EMPRESA_DOCUMENTOS.lugar,
    fecha: null,
    vendedores: [personaArrasVacia("Don")],
    compradores: [personaArrasVacia("Don")],
    finca_descripcion: "",
    finca_anejos: "",
    registro_libro: "",
    registro_folio: "",
    registro_finca: "",
    registro_numero: EMPRESA_DOCUMENTOS.lugar,
    precio: null,
    arras: null,
    cuenta_vendedora: "",
    plazo_escritura_dias: null,
    incluye_anejos: false,
    hay_hipoteca: false,
  };
}

export function parsePersonasArras(value: unknown): PersonaArras[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw) => {
    const item = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    return {
      tratamiento: item.tratamiento === "Doña" ? "Doña" : "Don",
      nombre: String(item.nombre ?? ""),
      estado_civil: normalizarEstadoCivil(String(item.estado_civil ?? "")),
      vecindad: String(item.vecindad ?? EMPRESA_DOCUMENTOS.lugar),
      domicilio: String(item.domicilio ?? ""),
      dni: String(item.dni ?? ""),
    };
  });
}

const UNIDADES = [
  "",
  "UN",
  "DOS",
  "TRES",
  "CUATRO",
  "CINCO",
  "SEIS",
  "SIETE",
  "OCHO",
  "NUEVE",
  "DIEZ",
  "ONCE",
  "DOCE",
  "TRECE",
  "CATORCE",
  "QUINCE",
  "DIECISÉIS",
  "DIECISIETE",
  "DIECIOCHO",
  "DIECINUEVE",
];
const DECENAS = ["", "", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
const CENTENAS = [
  "",
  "CIENTO",
  "DOSCIENTOS",
  "TRESCIENTOS",
  "CUATROCIENTOS",
  "QUINIENTOS",
  "SEISCIENTOS",
  "SETECIENTOS",
  "OCHOCIENTOS",
  "NOVECIENTOS",
];

function centenasAPalabras(n: number): string {
  if (n <= 0) return "";
  if (n === 100) return "CIEN";
  if (n < 20) return UNIDADES[n];
  if (n < 30) return n === 20 ? "VEINTE" : `VEINTI${UNIDADES[n - 20].replace("UN", "ÚN")}`;
  const d = Math.floor(n / 10);
  const u = n % 10;
  if (n < 100) return u ? `${DECENAS[d]} Y ${UNIDADES[u]}` : DECENAS[d];
  const c = Math.floor(n / 100);
  const r = n % 100;
  return r ? `${CENTENAS[c]} ${centenasAPalabras(r)}` : CENTENAS[c];
}

function enteroAPalabras(n: number): string {
  if (n === 0) return "CERO";
  if (n < 0) return `MENOS ${enteroAPalabras(-n)}`;
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (millones) {
    partes.push(millones === 1 ? "UN MILLÓN" : `${enteroAPalabras(millones)} MILLONES`);
  }
  if (miles) {
    if (miles === 1) partes.push("MIL");
    else partes.push(`${centenasAPalabras(miles)} MIL`);
  }
  if (resto) partes.push(centenasAPalabras(resto));
  return partes.join(" ").replace(/\s+/g, " ").trim();
}

export function formatImporteEs(n: number): string {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function eurosEnPalabras(importe: number | null | undefined): string {
  if (importe == null || Number.isNaN(importe)) return "……………… EUROS (……………… €)";
  const rounded = Math.round(importe * 100) / 100;
  const entero = Math.trunc(rounded);
  const cents = Math.round(Math.abs(rounded - entero) * 100);
  const base = entero === 1 ? "UN EURO" : `${enteroAPalabras(entero)} EUROS`;
  const conCentimos =
    cents > 0 ? `${base} CON ${cents === 1 ? "UN CÉNTIMO" : `${enteroAPalabras(cents)} CÉNTIMOS`}` : base;
  return `${conCentimos} (${formatImporteEs(rounded)} €)`;
}

export function restoPrecio(precio: number | null, arras: number | null): number | null {
  if (precio == null || arras == null) return null;
  return Math.round((precio - arras) * 100) / 100;
}

function hueco(valor: string | null | undefined, fallback = "………………") {
  const t = valor?.trim();
  return t || fallback;
}

export function nombrePersonaArras(p: PersonaArras): string {
  return `${p.tratamiento.toUpperCase()} ${hueco(p.nombre)}`;
}

export function listarPersonasArras(personas: PersonaArras[]): string {
  const list = personas.length ? personas : [personaArrasVacia("Don")];
  return list.map(nombrePersonaArras).join(" y ");
}

function unicos(valores: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of valores) {
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

export function parrafoReunidos(personas: PersonaArras[], rol: "vendedora" | "compradora"): string {
  const ps = personas.length ? personas : [personaArrasVacia("Don")];
  const varios = ps.length > 1;
  const nombres = listarPersonasArras(ps);
  const mayores = varios ? "mayores de edad" : "mayor de edad";
  const estados = unicos(ps.map((p) => etiquetaEstadoCivil(p))).join(" y ");
  const vecindades = unicos(ps.map((p) => hueco(p.vecindad, EMPRESA_DOCUMENTOS.lugar)));
  const vecinos = vecindades.length === 1
    ? `${varios ? "vecinos" : ps[0].tratamiento === "Doña" ? "vecina" : "vecino"} de ${vecindades[0]}`
    : `vecinos de ${vecindades.join(" y ")}`;
  const domicilios = unicos(ps.map((p) => hueco(p.domicilio, "calle ………………")));
  const domicilioTxt = `con domicilio en ${domicilios.join(" y ")}`;
  const dnis = ps.map((p) => hueco(p.dni));
  const dniTxt = varios
    ? `provistos de DNI Nº ${dnis.join(" y Nº ")} respectivamente`
    : `provisto${ps[0].tratamiento === "Doña" ? "a" : ""} de DNI Nº ${dnis[0]}`;
  return `${nombres}, ${mayores}, estado civil ${estados}, ${vecinos}, ${domicilioTxt}, ${dniTxt}. En adelante la parte ${rol}.`;
}

export function verboPropiedad(personas: PersonaArras[]): { son: string; propietarios: string } {
  const n = personas.filter((p) => p.nombre.trim()).length || personas.length || 1;
  if (n === 1) {
    const p = personas[0];
    const ella = p?.tratamiento === "Doña";
    return { son: "es", propietarios: ella ? "propietaria" : "propietario" };
  }
  return { son: "son", propietarios: "propietarios" };
}

export function textoViviendaVenta(incluyeAnejos: boolean): string {
  return incluyeAnejos ? "la vivienda y el trastero o garaje descritos" : "la vivienda descrita";
}

export function textoHipoteca(hayHipoteca: boolean): string {
  return hayHipoteca
    ? "Los vendedores se obligan a cancelar la hipoteca que grava la finca en el momento de la firma de la escritura pública de compraventa."
    : "Los vendedores manifiestan que la finca se transmitirá libre de hipoteca, o se obligan a cancelarla en el momento de la firma de la escritura pública de compraventa, si la hubiere.";
}

export function encabezadoContratoArras(datos: Pick<ContratoArrasDatos, "lugar" | "fecha">): string {
  return formatFechaEncabezado(datos.fecha, datos.lugar.trim() || EMPRESA_DOCUMENTOS.lugar);
}

export function contratoArrasTieneConchado(texto: string): boolean {
  return /conchado|conchadopuente|B70101449/i.test(texto);
}

export function contratoDesdeFila(row: {
  lugar: string;
  fecha: string | null;
  vendedores: unknown;
  compradores: unknown;
  finca_descripcion: string | null;
  finca_anejos: string | null;
  registro_libro: string | null;
  registro_folio: string | null;
  registro_finca: string | null;
  registro_numero: string | null;
  precio: number | string | null;
  arras: number | string | null;
  cuenta_vendedora: string | null;
  plazo_escritura_dias: number | null;
  incluye_anejos: boolean;
  hay_hipoteca: boolean;
}): ContratoArrasDatos {
  const vendedores = parsePersonasArras(row.vendedores);
  const compradores = parsePersonasArras(row.compradores);
  return {
    lugar: row.lugar || EMPRESA_DOCUMENTOS.lugar,
    fecha: row.fecha,
    vendedores: vendedores.length ? vendedores : [personaArrasVacia("Don")],
    compradores: compradores.length ? compradores : [personaArrasVacia("Don")],
    finca_descripcion: row.finca_descripcion ?? "",
    finca_anejos: row.finca_anejos ?? "",
    registro_libro: row.registro_libro ?? "",
    registro_folio: row.registro_folio ?? "",
    registro_finca: row.registro_finca ?? "",
    registro_numero: row.registro_numero ?? EMPRESA_DOCUMENTOS.lugar,
    precio: row.precio == null ? null : Number(row.precio),
    arras: row.arras == null ? null : Number(row.arras),
    cuenta_vendedora: row.cuenta_vendedora ?? "",
    plazo_escritura_dias: row.plazo_escritura_dias,
    incluye_anejos: row.incluye_anejos,
    hay_hipoteca: row.hay_hipoteca,
  };
}
