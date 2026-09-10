import { z } from "zod";
import type { PropuestaPresupuesto } from "@/lib/presupuesto-propuesta";
import { CONDICIONES_DEFAULT, propuestaVacia } from "@/lib/presupuesto-propuesta";
import { esLineaRepercusion } from "@/lib/presupuesto-totales";

export const COPILOTO_MAX_FILES = 4;
export const COPILOTO_MAX_BYTES = 3_500_000;

export type LineaCopiloto = {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  unidad: string;
  capitulo: string;
};

export type HistorialCopiloto = {
  role: "user" | "assistant";
  text: string;
};

const zonaSchema = z.object({
  codigo: z.string(),
  titulo: z.string(),
  descripcion: z.string(),
});

const faseSchema = z.object({
  codigo: z.string(),
  descripcion: z.string(),
});

const lineaSchema = z.object({
  descripcion: z.string(),
  cantidad: z.number(),
  precioUnitario: z.number(),
  unidad: z.string(),
  capitulo: z.string(),
});

const bajaSchema = z.object({
  descripcion: z.string(),
  importe: z.number(),
});

const propuestaTextoSchema = z.object({
  subtitulo_portada: z.string(),
  descripcion_portada: z.string(),
  emplazamiento: z.string(),
  contacto: z.string(),
  plazo_ejecucion: z.string(),
  validez_oferta: z.string(),
  escala: z.string(),
  objeto_alcance: z.string(),
  zonas: z.array(zonaSchema),
  programa: z.array(faseSchema),
  condiciones: z.string(),
  tipo: z.enum(["presupuesto", "ampliacion"]).default("presupuesto"),
  origen_numero: z.string().default(""),
  origen_total: z.number().default(0),
  ajuste_comercial: z.number().default(0),
  bajas: z.array(bajaSchema).default([]),
  mostrar_repercusion: z.boolean().default(false),
  observaciones: z.string().default(""),
  mostrar_observaciones: z.boolean().default(false),
  condicionantes_ejecucion: z.string().default(""),
  mostrar_zonas: z.boolean().default(true),
  mostrar_programa: z.boolean().default(true),
});

export const copilotoOutputSchema = z.object({
  resumen: z.string(),
  sugerencias: z.array(z.string()),
  concepto: z.string(),
  porcentaje_descuento: z.number(),
  lineas: z.array(lineaSchema),
  propuesta: propuestaTextoSchema,
});

export type CopilotoOutput = z.infer<typeof copilotoOutputSchema>;

export type EstadoCopiloto = {
  emisor: "garal" | "rehabinco";
  concepto: string;
  porcentaje_impuesto: number;
  porcentaje_descuento: number;
  lineas: LineaCopiloto[];
  propuesta: Omit<PropuestaPresupuesto, "adjuntos" | "foto_portada">;
};

export function propuestaSinBinarios(p: PropuestaPresupuesto): EstadoCopiloto["propuesta"] {
  const { adjuntos: _a, foto_portada: _f, ...rest } = p;
  void _a;
  void _f;
  return rest;
}

export function systemPromptCopiloto(emisor: "garal" | "rehabinco") {
  const marca = emisor === "garal" ? "Garal · Diseño & obra" : "Rehabinco";
  return `Eres el copiloto de presupuestos del CRM interno de ${marca}.
Redactas y CORRIGES propuestas técnicas y económicas en español (España). No diseñas el PDF: el CRM ya tiene plantilla fija. Tú solo rellenas y ajustas DATOS.

La mayoría de peticiones son correcciones sobre un presupuesto ya montado (bajar a un total, quitar una partida, cambiar turnos, ocultar un bloque). Aplica el cambio con precisión y devuelve el documento completo resultante.

Reglas de partidas (plantilla tipo Riazor):
- Agrupa en capítulos con título "01 · NOMBRE", "02 · NOMBRE" (dos dígitos, punto medio, nombre).
- Cada partida tiene descripción técnica concreta (1–3 líneas), unidad (ml, m², ud, h, pa), cantidad y precio unitario en euros sin IVA.
- No inventes mediciones si el usuario o los adjuntos no las dan: deja cantidad 0 y avisa en sugerencias.
- No inventes precios de catálogo. Si no hay precio en el material de origen, pon 0 y dilo en sugerencias.
- IVA no va en las partidas.
- En un presupuesto normal, el descuento (baja ofertada) es un porcentaje sobre la base, no una partida.
- Tono: técnico, sobrio, sin marketing.

Cifras (una sola fuente de verdad):
- Si el usuario da un total o un incremento objetivo, encájalo UNA vez. No lo repitas como descuento porcentual Y como partida Y como ajuste.
- En ampliación: las líneas son SOLO las altas (obra nueva). Las partidas que se quitan van en propuesta.bajas (descripcion + importe positivo). El encaje al total se hace con propuesta.ajuste_comercial (signed, p. ej. −1040). porcentaje_descuento = 0.
- NUNCA pongas en lineas el capítulo "00 · Repercusión" ni partidas de "ajuste comercial": el CRM las genera al guardar.
- No dejes la misma cifra en dos sitios (p. ej. no pongas −1040 en una partida de altas y otra vez en ajuste_comercial).

Ampliación (tipo = "ampliacion"):
- PDF corto: portada + una hoja de desglose. Por defecto mostrar_zonas = false, mostrar_programa = false, mostrar_repercusion = true, mostrar_observaciones = false.
- origen_numero y origen_total = presupuesto inicial cerrado.
- condicionantes_ejecucion = turnos, premura, restricciones de obra (si el usuario los menciona).
- observaciones solo si el usuario las pide (entonces mostrar_observaciones = true).
- objeto_alcance breve: qué se añade sobre el inicial.

Presupuesto completo (tipo = "presupuesto"):
- mostrar_zonas y mostrar_programa true salvo que el usuario pida ocultarlos.

Devuelve SIEMPRE el presupuesto completo resultante (no un parche):
- resumen: 2–5 frases de lo que has hecho y qué debe revisar el usuario. Si es ampliación, menciona incremento neto = altas − bajas + ajuste.
- sugerencias: avisos (precios a confirmar, huecos, incoherencias). Vacío si no hay.
- concepto: título de portada.
- porcentaje_descuento: 0 si no aplica o si es ampliación.
- lineas: partidas finales (solo altas).
- propuesta: textos + tipo + origen + bajas + ajuste + flags de bloques.

Condiciones por defecto si el usuario no pide otras:
${CONDICIONES_DEFAULT}

No toques anexos fotográficos ni el diseño visual (fotos, densidad, portada). No pidas firmar ni enviar el PDF.`;
}

export function normalizarOutput(raw: CopilotoOutput): CopilotoOutput {
  const lineas = raw.lineas
    .map((l) => ({
      descripcion: l.descripcion.trim(),
      cantidad: Number.isFinite(l.cantidad) ? Math.max(0, l.cantidad) : 0,
      precioUnitario: Number.isFinite(l.precioUnitario) ? Math.max(0, l.precioUnitario) : 0,
      unidad: (l.unidad || "ud").trim() || "ud",
      capitulo: l.capitulo.trim(),
    }))
    .filter((l) => l.descripcion.length > 0 && !esLineaRepercusion(l.capitulo));

  const p = raw.propuesta;
  const vacia = propuestaVacia();
  const tipo = p.tipo === "ampliacion" ? "ampliacion" : "presupuesto";
  const bajas = (p.bajas ?? [])
    .map((b) => ({
      descripcion: b.descripcion.trim(),
      importe: Math.abs(Number(b.importe) || 0),
    }))
    .filter((b) => b.descripcion || b.importe > 0);

  return {
    resumen: raw.resumen.trim() || "Propuesta lista para revisar.",
    sugerencias: raw.sugerencias.map((s) => s.trim()).filter(Boolean).slice(0, 12),
    concepto: raw.concepto.trim(),
    porcentaje_descuento:
      tipo === "ampliacion" ? 0 : Math.min(100, Math.max(0, Number(raw.porcentaje_descuento) || 0)),
    lineas:
      lineas.length > 0
        ? lineas
        : [{ descripcion: "", cantidad: 0, precioUnitario: 0, unidad: "ud", capitulo: "01 · Actuación" }],
    propuesta: {
      subtitulo_portada: p.subtitulo_portada.trim(),
      descripcion_portada: p.descripcion_portada.trim(),
      emplazamiento: p.emplazamiento.trim(),
      contacto: p.contacto.trim(),
      plazo_ejecucion: p.plazo_ejecucion.trim(),
      validez_oferta: p.validez_oferta.trim() || vacia.validez_oferta,
      escala: p.escala.trim() || vacia.escala,
      objeto_alcance: p.objeto_alcance.trim(),
      zonas: p.zonas
        .map((z, i) => ({
          codigo: z.codigo.trim() || `Z-${String(i + 1).padStart(2, "0")}`,
          titulo: z.titulo.trim(),
          descripcion: z.descripcion.trim(),
        }))
        .filter((z) => z.titulo || z.descripcion || z.codigo),
      programa: p.programa
        .map((f) => ({ codigo: f.codigo.trim(), descripcion: f.descripcion.trim() }))
        .filter((f) => f.codigo || f.descripcion),
      condiciones: p.condiciones.trim() || CONDICIONES_DEFAULT,
      tipo,
      origen_numero: (p.origen_numero ?? "").trim(),
      origen_total: Math.max(0, Number(p.origen_total) || 0),
      ajuste_comercial: Number(p.ajuste_comercial) || 0,
      bajas,
      mostrar_repercusion: tipo === "ampliacion" ? p.mostrar_repercusion !== false : Boolean(p.mostrar_repercusion),
      observaciones: (p.observaciones ?? "").trim(),
      mostrar_observaciones: Boolean(p.mostrar_observaciones),
      condicionantes_ejecucion: (p.condicionantes_ejecucion ?? "").trim(),
      mostrar_zonas: tipo === "ampliacion" ? Boolean(p.mostrar_zonas) : p.mostrar_zonas !== false,
      mostrar_programa: tipo === "ampliacion" ? Boolean(p.mostrar_programa) : p.mostrar_programa !== false,
    },
  };
}

export function aplicarPropuestaTexto(
  actual: PropuestaPresupuesto,
  texto: CopilotoOutput["propuesta"]
): PropuestaPresupuesto {
  const tipo = texto.tipo === "ampliacion" ? "ampliacion" : "presupuesto";
  return {
    ...actual,
    ...texto,
    tipo,
    adjuntos: actual.adjuntos,
    foto_portada: actual.foto_portada,
    densidad_tabla: tipo === "ampliacion" ? "compacta" : actual.densidad_tabla,
    variante_portada: actual.variante_portada,
  };
}

export function modeloCopiloto(tienePdf: boolean) {
  return tienePdf ? "anthropic/claude-opus-5" : "anthropic/claude-sonnet-4.6";
}
