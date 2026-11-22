import { direccionPrincipal, ETIQUETA_USO, nombreVia, type EdificioMapa, type UsoEdificio } from "./inspire";

export type FiltroDivision = "todas" | "con" | "sin";

export interface FiltrosMapa {
  usos: UsoEdificio[];
  division: FiltroDivision;
  anioMin: number | null;
  anioMax: number | null;
  supMin: number | null;
  supMax: number | null;
  inmueblesMin: number | null;
  /** Ocultar los edificios que ya marcaste como trabajados. */
  ocultarTrabajados: boolean;
}

export const FILTROS_VACIOS: FiltrosMapa = {
  usos: [],
  division: "todas",
  anioMin: null,
  anioMax: null,
  supMin: null,
  supMax: null,
  inmueblesMin: null,
  ocultarTrabajados: false,
};

/** Hay división horizontal cuando la parcela tiene más de un inmueble. */
export function tieneDivisionHorizontal(e: Pick<EdificioMapa, "inmuebles">): boolean {
  return (e.inmuebles ?? 0) > 1;
}

export function contarFiltrosActivos(f: FiltrosMapa): number {
  return (
    (f.usos.length ? 1 : 0) +
    (f.division !== "todas" ? 1 : 0) +
    (f.anioMin != null || f.anioMax != null ? 1 : 0) +
    (f.supMin != null || f.supMax != null ? 1 : 0) +
    (f.inmueblesMin != null ? 1 : 0) +
    (f.ocultarTrabajados ? 1 : 0)
  );
}

function enRango(v: number | null, min: number | null, max: number | null): boolean {
  if (min == null && max == null) return true;
  if (v == null) return false;
  return (min == null || v >= min) && (max == null || v <= max);
}

export function aplicarFiltros(edificios: EdificioMapa[], f: FiltrosMapa, trabajados: ReadonlySet<string> = new Set()): EdificioMapa[] {
  return edificios.filter((e) => {
    if (f.usos.length && !f.usos.includes(e.uso)) return false;
    if (f.division === "con" && !tieneDivisionHorizontal(e)) return false;
    if (f.division === "sin" && tieneDivisionHorizontal(e)) return false;
    if (!enRango(e.anio, f.anioMin, f.anioMax)) return false;
    if (!enRango(e.superficie, f.supMin, f.supMax)) return false;
    if (f.inmueblesMin != null && (e.inmuebles ?? 0) < f.inmueblesMin) return false;
    if (f.ocultarTrabajados && trabajados.has(e.ref)) return false;
    return true;
  });
}

/** Busca por dirección (sin tildes) o por referencia catastral. */
export function buscarEdificios(edificios: EdificioMapa[], consulta: string): EdificioMapa[] {
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const q = norm(consulta.trim());
  if (!q) return edificios;
  return edificios.filter(
    (e) => e.ref.toLowerCase().includes(q) || e.direcciones.some((d) => norm(`${nombreVia(d.via)} ${d.numero}`).includes(q))
  );
}

/** Orden por defecto: más inmuebles primero (lo que más interesa para captar), luego dirección. */
export function ordenarEdificios(edificios: EdificioMapa[]): EdificioMapa[] {
  return [...edificios].sort(
    (a, b) => (b.inmuebles ?? 0) - (a.inmuebles ?? 0) || direccionPrincipal(a).localeCompare(direccionPrincipal(b), "es")
  );
}

// ---------------------------------------------------------------------------
// Exportación de direcciones (una fila por portal)
// ---------------------------------------------------------------------------

export const CABECERA_EXPORT = [
  "Referencia catastral",
  "Dirección",
  "Vía",
  "Número",
  "Código postal",
  "Uso",
  "Año",
  "Inmuebles",
  "Viviendas",
  "Superficie construida (m²)",
  "División horizontal",
  "Trabajado",
  "Latitud",
  "Longitud",
];

export function filasExport(edificios: EdificioMapa[], trabajados: ReadonlySet<string> = new Set()): (string | number)[][] {
  const filas: (string | number)[][] = [];
  for (const e of edificios) {
    const portales = e.direcciones.length ? e.direcciones : [null];
    for (const d of portales) {
      filas.push([
        e.ref,
        d && d.via ? `${nombreVia(d.via)}, ${d.numero}` : "",
        d ? nombreVia(d.via) : "",
        d?.numero ?? "",
        d?.codigoPostal ?? "",
        ETIQUETA_USO[e.uso],
        e.anio ?? "",
        e.inmuebles ?? "",
        e.viviendas ?? "",
        e.superficie ?? "",
        tieneDivisionHorizontal(e) ? "Sí" : "No",
        trabajados.has(e.ref) ? "Sí" : "No",
        Number((d?.lat ?? e.lat).toFixed(6)),
        Number((d?.lng ?? e.lng).toFixed(6)),
      ]);
    }
  }
  return filas;
}

/** CSV con separador ";" y BOM para que Excel en español lo abra bien. */
export function csvDirecciones(edificios: EdificioMapa[], trabajados: ReadonlySet<string> = new Set()): string {
  const celda = (v: string | number) => {
    const s = typeof v === "number" ? String(v).replace(".", ",") : v;
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lineas = [CABECERA_EXPORT, ...filasExport(edificios, trabajados)].map((f) => f.map(celda).join(";"));
  return `﻿${lineas.join("\r\n")}\r\n`;
}
