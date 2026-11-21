/**
 * Series oficiales del Ministerio de Vivienda (Boletín estadístico):
 *
 *  - Tabla 1 (35101000.xls): valor tasado medio de vivienda libre, €/m², por
 *    trimestre, para España, comunidades y provincias.
 *  - Tabla 4 (35103500.xls): valor tasado medio por municipio de más de
 *    25.000 habitantes, una hoja por trimestre (T2A2026…).
 *  - Transacciones (34010210.xls): número de compraventas de vivienda por
 *    municipio (todos los de España) y trimestre, desde 2004.
 *
 * Son datos públicos y reutilizables (aviso legal del Ministerio, Ley 37/2007).
 * Aquí solo se interpretan las filas; la descarga va en el script de carga.
 */
import type { Celda, HojaXls } from "./xls";
import { ambitoDeNombre } from "./territorio";

export const URLS_MIVAU = {
  tasadoProvincias: "https://cdn.transportes.gob.es/estadistica/BoletinOnline2/35101000.xls",
  tasadoMunicipios: "https://cdn.transportes.gob.es/estadistica/BoletinOnline2/35103500.xls",
  transaccionesMunicipios: "https://cdn.transportes.gob.es/estadistica/BoletinOnline2/34010210.xls",
} as const;

const texto = (c: Celda | undefined): string => (typeof c === "string" ? c.trim() : "");
const num = (c: Celda | undefined): number | null => (typeof c === "number" && Number.isFinite(c) ? c : null);
const redondear = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);

/** Primer día del trimestre, "YYYY-MM-01". */
export function inicioTrimestre(anio: number, trimestre: number): string {
  return `${anio}-${String((trimestre - 1) * 3 + 1).padStart(2, "0")}-01`;
}

const ORDINALES: Record<string, number> = { primer: 1, primero: 1, segundo: 2, tercer: 3, tercero: 3, cuarto: 4 };

/** "T2A2026" o "Segundo trimestre de 2026" → "2026-04-01". */
export function periodoHoja(hoja: HojaXls): string | null {
  const m = /T\s*([1-4])\s*A\s*(\d{4})/i.exec(hoja.nombre);
  if (m) return inicioTrimestre(Number(m[2]), Number(m[1]));
  for (const fila of hoja.filas.slice(0, 20)) {
    for (const c of fila) {
      const t = /(primer|primero|segundo|tercer|tercero|cuarto)\s+trimestre\s+de\s+(\d{4})/i.exec(texto(c));
      if (t) return inicioTrimestre(Number(t[2]), ORDINALES[t[1].toLowerCase()]);
    }
  }
  return null;
}

/**
 * Columnas de periodo a partir de la fila de años ("Año 2023" cada 4 columnas)
 * y la de trimestres ("1º", "2º (*)"…). Devuelve columna → "YYYY-MM-01".
 */
export function columnasPeriodo(filas: Celda[][]): { fila: number; columnas: Map<number, string> } | null {
  const iAnios = filas.findIndex((f) => f.some((c) => /^Año \d{4}$/.test(texto(c))));
  if (iAnios < 0) return null;
  const iTrim = filas.findIndex((f, i) => i > iAnios && i <= iAnios + 3 && f.some((c) => /^[1-4]º/.test(texto(c))));
  if (iTrim < 0) return null;
  const columnas = new Map<number, string>();
  let anio: number | null = null;
  const anchura = Math.max(filas[iAnios].length, filas[iTrim].length);
  for (let c = 0; c < anchura; c++) {
    const a = /^Año (\d{4})$/.exec(texto(filas[iAnios][c]));
    if (a) anio = Number(a[1]);
    const t = /^([1-4])º/.exec(texto(filas[iTrim][c]));
    if (t && anio != null) columnas.set(c, inicioTrimestre(anio, Number(t[1])));
  }
  return { fila: iTrim, columnas };
}

// ─── Tabla 1: España, comunidades y provincias ─────────────────────────────

export interface TasadoTerritorio {
  ambito: "pais" | "ccaa" | "provincia";
  codigo: string;          // "ES", código de comunidad o de provincia
  nombre: string;
  periodo: string;
  ppm2: number;
}

export function parseTasadoProvincias(hojas: HojaXls[]): TasadoTerritorio[] {
  const out = new Map<string, TasadoTerritorio>();
  for (const hoja of hojas) {
    const cols = columnasPeriodo(hoja.filas);
    if (!cols) continue;
    for (const fila of hoja.filas.slice(cols.fila + 1)) {
      const nombre = texto(fila[1]);
      if (!nombre) continue;
      const ambitos: { ambito: TasadoTerritorio["ambito"]; codigo: string }[] = [];
      if (/total nacional/i.test(nombre)) ambitos.push({ ambito: "pais", codigo: "ES" });
      const { provincia: prov, ccaa } = ambitoDeNombre(nombre);
      if (prov) ambitos.push({ ambito: "provincia", codigo: prov });
      if (ccaa) ambitos.push({ ambito: "ccaa", codigo: ccaa });
      for (const [c, periodo] of cols.columnas) {
        const ppm2 = num(fila[c]);
        if (ppm2 == null) continue;
        for (const a of ambitos) {
          out.set(`${a.ambito}:${a.codigo}:${periodo}`, { ...a, nombre, periodo, ppm2: redondear(ppm2)! });
        }
      }
    }
  }
  return [...out.values()];
}

// ─── Tabla 4: municipios de más de 25.000 habitantes ───────────────────────

export interface TasadoMunicipio {
  periodo: string;
  provinciaPista: string | null;   // código de provincia de la columna "Provincia" (arrastrada)
  municipio: string;
  ppm2: number;                    // total
  ppm2Hasta5: number | null;       // hasta cinco años de antigüedad
  ppm2Mas5: number | null;         // más de cinco años
  tasaciones: number | null;
}

export function parseTasadoMunicipios(hoja: HojaXls): TasadoMunicipio[] {
  const periodo = periodoHoja(hoja);
  if (!periodo) return [];
  const iCab = hoja.filas.findIndex((f) => texto(f[1]) === "Provincia" && texto(f[2]) === "Municipio");
  if (iCab < 0) return [];
  const sub = hoja.filas[iCab + 1] ?? [];
  const totales = sub.map((c, i) => (texto(c) === "Total" ? i : -1)).filter((i) => i >= 0);
  const colTotal = totales[0] ?? 3;
  const colTasaciones = totales[1] ?? null;
  const hasta5 = sub.findIndex((c) => /^Hasta cinco/i.test(texto(c)));
  const mas5 = sub.findIndex((c) => /^Con más de cinco/i.test(texto(c)));

  const out: TasadoMunicipio[] = [];
  let provincia: string | null = null;
  for (const fila of hoja.filas.slice(iCab + 2)) {
    if (texto(fila[1])) provincia = ambitoDeNombre(texto(fila[1])).provincia ?? provincia;
    const municipio = texto(fila[2]);
    const ppm2 = num(fila[colTotal]);
    if (!municipio || ppm2 == null) continue;
    out.push({
      periodo,
      provinciaPista: provincia,
      municipio,
      ppm2: redondear(ppm2)!,
      ppm2Hasta5: hasta5 >= 0 && hasta5 < colTotal ? redondear(num(fila[hasta5])) : null,
      ppm2Mas5: mas5 >= 0 && mas5 < colTotal ? redondear(num(fila[mas5])) : null,
      tasaciones: colTasaciones != null ? num(fila[colTasaciones]) : null,
    });
  }
  return out;
}

// ─── Transacciones por municipio ───────────────────────────────────────────

export interface TransaccionesMunicipio {
  provincia: string;       // código INE de provincia
  municipio: string;
  periodo: string;
  n: number;
}

/** `desde`: primer trimestre que se conserva ("YYYY-MM-01"); por defecto, todos. */
export function parseTransaccionesMunicipios(hoja: HojaXls, desde?: string): TransaccionesMunicipio[] {
  const cols = columnasPeriodo(hoja.filas);
  if (!cols) return [];
  const usadas = [...cols.columnas].filter(([, p]) => !desde || p >= desde);
  const out: TransaccionesMunicipio[] = [];
  let provincia: string | null = null;
  for (const fila of hoja.filas.slice(cols.fila + 1)) {
    const nombre = texto(fila[1]);
    if (!nombre) continue;
    const tieneDatos = [...cols.columnas.keys()].some((c) => num(fila[c]) != null);
    if (!tieneDatos) {
      // Cabecera de comunidad o de provincia. Las comunidades uniprovinciales no repiten la provincia.
      const ambito = ambitoDeNombre(nombre);
      if (ambito.provincia || ambito.ccaa) provincia = ambito.provincia;
      continue;
    }
    if (!provincia) continue;
    for (const [c, periodo] of usadas) {
      const n = num(fila[c]);
      if (n != null) out.push({ provincia, municipio: nombre, periodo, n });
    }
  }
  return out;
}
