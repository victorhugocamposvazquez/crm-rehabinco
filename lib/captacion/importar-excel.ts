import JSZip from "jszip";
import { type EstadoCaptacion } from "@/lib/captacion/estados";

export const FUENTE_EXCEL_CAPTACION = "Captacion_inmobiliaria_apuntes_organizados.xlsx";

export type OperacionEncargo = "alquiler" | "venta" | "por_confirmar" | "no_aplica";
export type PrioridadEncargo = "alta" | "media" | "baja";

export type EncargoImportado = {
  calle: string;
  numero: string;
  municipio: string;
  tipoUso: string | null;
  operacion: OperacionEncargo;
  contactoNombre: string | null;
  telefono: string | null;
  email: string | null;
  estado: EstadoCaptacion;
  proximaAccion: string | null;
  resultado: string | null;
  notasRevision: string | null;
  requiereConfirmacion: boolean;
  prioridad: PrioridadEncargo | null;
  posibleDuplicado: boolean;
  filaOrigen: Record<string, unknown>;
};

export function normalizarTexto(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function partirNumero(numero: string): { partes: string[]; dudoso: boolean } {
  const bruto = numero.trim();
  if (!bruto) return { partes: [""], dudoso: true };
  if (/[?¿]/.test(bruto) || /[a-záéíóúñ]/i.test(bruto)) {
    return { partes: [bruto], dudoso: true };
  }
  const partes = bruto
    .split(/[,;/]+/)
    .map((parte) => parte.trim())
    .filter(Boolean);
  if (partes.length > 0 && partes.every((parte) => /^\d+$/.test(parte))) {
    return { partes, dudoso: false };
  }
  return { partes: [bruto], dudoso: true };
}

export function estadoDesdeApunte(estado: string): EstadoCaptacion {
  const texto = normalizarTexto(estado);
  if (texto.includes("no valido") || texto.includes("descart")) return "descartada";
  if (texto.includes("interes")) return "propietario_localizado";
  if (texto.includes("seguimiento")) return "visita";
  if (texto.includes("pendiente")) return "contactar";
  return "contactar";
}

export function operacionDesdeApunte(operacion: string): OperacionEncargo {
  const texto = normalizarTexto(operacion);
  if (texto.includes("alquiler")) return "alquiler";
  if (texto.includes("venta")) return "venta";
  if (texto.includes("no aplica")) return "no_aplica";
  return "por_confirmar";
}

export function prioridadDesdeApunte(prioridad: string): PrioridadEncargo | null {
  const texto = normalizarTexto(prioridad);
  if (texto === "alta" || texto === "media" || texto === "baja") return texto;
  return null;
}

function texto(valor: string | undefined): string {
  return (valor ?? "").replace(/\s+/g, " ").trim();
}

function vacio(valor: string): string | null {
  return texto(valor) || null;
}

function claveColumna(cabecera: string): string {
  const nombre = normalizarTexto(cabecera);
  if (!nombre) return "";
  if (nombre.startsWith("calle")) return "calle";
  if (nombre.startsWith("numero")) return "numero";
  if (nombre.includes("tipo")) return "tipo";
  if (nombre.includes("resultado") || nombre.includes("que revisar")) return "resultado";
  if (nombre.includes("contacto") || nombre.includes("propietario")) return "contacto";
  if (nombre.includes("telefono") || nombre.includes("email")) return "telefono";
  if (nombre.includes("operacion")) return "operacion";
  if (nombre === "estado" || nombre.startsWith("estado")) return "estado";
  if (nombre.includes("proxima")) return "proxima";
  if (nombre.includes("prioridad")) return "prioridad";
  if (nombre.includes("nota")) return "notas";
  return "";
}

function mapaColumnas(cabecera: string[]): Record<string, number> {
  const mapa: Record<string, number> = {};
  cabecera.forEach((celda, indice) => {
    const clave = claveColumna(celda);
    if (clave && mapa[clave] == null) mapa[clave] = indice;
  });
  return mapa;
}

function celda(fila: string[], mapa: Record<string, number>, clave: string): string {
  const indice = mapa[clave];
  if (indice == null) return "";
  return texto(fila[indice]);
}

function contactoDesde(celdaContacto: string): { telefono: string | null; email: string | null } {
  const email = celdaContacto.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
  const resto = celdaContacto.replace(email ?? "", "").replace(/^[\s,;/|-]+|[\s,;/|-]+$/g, "").trim();
  if (email && !resto) return { telefono: null, email };
  return { telefono: vacio(resto || (email ? "" : celdaContacto)), email };
}

function pideConfirmacion(partes: string[]): boolean {
  return partes.some((parte) => /confirmar|ilegible|dudoso|dudosa|parcial/i.test(parte));
}

function clavePortal(calle: string, numero: string): string {
  const digitos = numero.replace(/\D/g, "");
  return `${normalizarTexto(calle)}|${digitos || normalizarTexto(numero)}`;
}

function hojaPorNombre(hojas: Record<string, string[][]>, nombre: string): string[][] | null {
  const buscada = normalizarTexto(nombre);
  const encontrada = Object.entries(hojas).find(([clave]) => normalizarTexto(clave) === buscada);
  return encontrada?.[1] ?? null;
}

export function encargosDesdeHojas(
  hojas: Record<string, string[][]>,
  opciones?: { municipio?: string; fuente?: string }
): { encargos: EncargoImportado[]; errores: string[] } {
  const captacion = hojaPorNombre(hojas, "Captación");
  if (!captacion || captacion.length === 0) {
    return { encargos: [], errores: ["El Excel no tiene la hoja Captación."] };
  }
  const columnas = mapaColumnas(captacion[0] ?? []);
  if (columnas.calle == null || columnas.numero == null) {
    return { encargos: [], errores: ["La hoja Captación no tiene columnas Calle y Número."] };
  }

  const prioridades = new Map<string, PrioridadEncargo>();
  const calles = hojaPorNombre(hojas, "Calles");
  if (calles && calles.length > 1) {
    const mapaCalles = mapaColumnas(calles[0] ?? []);
    if (mapaCalles.calle != null && mapaCalles.prioridad != null) {
      for (const fila of calles.slice(1)) {
        const calle = celda(fila, mapaCalles, "calle");
        const prioridad = prioridadDesdeApunte(celda(fila, mapaCalles, "prioridad"));
        if (calle && prioridad) prioridades.set(normalizarTexto(calle), prioridad);
      }
    }
  }

  const municipio = opciones?.municipio?.trim() || "A Coruña";
  const fuente = opciones?.fuente ?? FUENTE_EXCEL_CAPTACION;
  const encargos: EncargoImportado[] = [];
  const vistos = new Set<string>();

  captacion.slice(1).forEach((fila, indice) => {
    const calle = celda(fila, columnas, "calle");
    const numeroBruto = celda(fila, columnas, "numero");
    if (!calle && !numeroBruto) return;
    const partido = partirNumero(numeroBruto);
    const resultado = vacio(celda(fila, columnas, "resultado"));
    const notas = vacio(celda(fila, columnas, "notas"));
    const contacto = vacio(celda(fila, columnas, "contacto"));
    const medio = contactoDesde(celda(fila, columnas, "telefono"));
    const confirmar =
      partido.dudoso ||
      pideConfirmacion([resultado ?? "", notas ?? "", contacto ?? "", medio.telefono ?? "", numeroBruto]);
    const prioridad = prioridades.get(normalizarTexto(calle)) ?? null;
    const base = {
      calle,
      municipio,
      tipoUso: vacio(celda(fila, columnas, "tipo")),
      operacion: operacionDesdeApunte(celda(fila, columnas, "operacion")),
      contactoNombre: contacto,
      telefono: medio.telefono,
      email: medio.email,
      estado: estadoDesdeApunte(celda(fila, columnas, "estado")),
      proximaAccion: vacio(celda(fila, columnas, "proxima")),
      resultado,
      notasRevision: notas,
      requiereConfirmacion: confirmar,
      prioridad,
    };
    for (const numero of partido.partes) {
      const clave = clavePortal(calle, numero);
      const posibleDuplicado = vistos.has(clave);
      vistos.add(clave);
      encargos.push({
        ...base,
        numero,
        posibleDuplicado,
        filaOrigen: {
          fuente,
          hoja: "Captación",
          fila: indice + 2,
          numeroOriginal: numeroBruto,
          calle,
          numero,
        },
      });
    }
  });

  return { encargos, errores: [] };
}

function decodificarXml(valor: string): string {
  return valor
    .replace(/&#(\d+);/g, (_, codigo: string) => String.fromCodePoint(Number(codigo)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function textosDe(xml: string): string[] {
  return [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((coincidencia) => decodificarXml(coincidencia[1] ?? ""));
}

export function cadenasCompartidas(xml: string): string[] {
  return xml.split(/<si\b[^>]*>/).slice(1).map((trozo) => textosDe(trozo.split("</si>")[0] ?? "").join(""));
}

function indiceColumna(letras: string): number {
  return [...letras].reduce((total, letra) => total * 26 + (letra.charCodeAt(0) - 64), 0) - 1;
}

export function filasDesdeHojaXml(xml: string, compartidas: string[]): string[][] {
  const filas: string[][] = [];
  for (const coincidencia of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const celdas = new Map<number, string>();
    for (const celdaXml of (coincidencia[1] ?? "").matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const atributos = celdaXml[1] ?? "";
      const referencia = /r="([A-Z]+)\d+"/.exec(atributos)?.[1];
      if (!referencia) continue;
      const tipo = /t="([^"]+)"/.exec(atributos)?.[1];
      const cuerpo = celdaXml[2] ?? "";
      let valor = "";
      if (tipo === "s") {
        const indice = Number(/<v>(\d+)<\/v>/.exec(cuerpo)?.[1] ?? "");
        valor = compartidas[indice] ?? "";
      } else if (tipo === "inlineStr") {
        valor = textosDe(cuerpo).join("");
      } else {
        valor = decodificarXml(/<v>([\s\S]*?)<\/v>/.exec(cuerpo)?.[1] ?? "");
      }
      celdas.set(indiceColumna(referencia), valor);
    }
    if (celdas.size === 0) continue;
    const ultima = Math.max(...celdas.keys());
    filas.push(Array.from({ length: ultima + 1 }, (_, indice) => celdas.get(indice) ?? ""));
  }
  return filas;
}

function rutaRelacion(target: string): string {
  const limpia = target.replace(/^\//, "");
  return limpia.startsWith("xl/") ? limpia : `xl/${limpia}`;
}

export async function hojasDesdeXlsx(buffer: ArrayBuffer | Uint8Array): Promise<Record<string, string[][]>> {
  const zip = await JSZip.loadAsync(buffer);
  const libro = await zip.file("xl/workbook.xml")?.async("string");
  const relaciones = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
  if (!libro || !relaciones) throw new Error("El archivo no es un Excel válido.");

  const destinos = new Map<string, string>();
  for (const relacion of relaciones.matchAll(/<Relationship\b([^>]*)\/>/g)) {
    const atributos = relacion[1] ?? "";
    const id = /Id="([^"]+)"/.exec(atributos)?.[1];
    const target = /Target="([^"]+)"/.exec(atributos)?.[1];
    if (id && target) destinos.set(id, rutaRelacion(decodeURIComponent(target)));
  }

  const compartidasXml = await zip.file("xl/sharedStrings.xml")?.async("string");
  const compartidas = compartidasXml ? cadenasCompartidas(compartidasXml) : [];
  const hojas: Record<string, string[][]> = {};

  for (const hoja of libro.matchAll(/<sheet\b([^>]*)\/>/g)) {
    const atributos = hoja[1] ?? "";
    const nombre = decodificarXml(/name="([^"]+)"/.exec(atributos)?.[1] ?? "");
    const id = /r:id="([^"]+)"/.exec(atributos)?.[1];
    const ruta = id ? destinos.get(id) : undefined;
    if (!nombre || !ruta) continue;
    const xml = await zip.file(ruta)?.async("string");
    if (!xml) continue;
    hojas[nombre] = filasDesdeHojaXml(xml, compartidas);
  }
  return hojas;
}

export async function encargosDesdeXlsx(
  buffer: ArrayBuffer | Uint8Array,
  opciones?: { municipio?: string; fuente?: string }
): Promise<{ encargos: EncargoImportado[]; errores: string[] }> {
  const hojas = await hojasDesdeXlsx(buffer);
  return encargosDesdeHojas(hojas, opciones);
}
