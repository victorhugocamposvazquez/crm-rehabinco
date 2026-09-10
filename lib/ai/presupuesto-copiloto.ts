import { z } from "zod";
import type { PropuestaPresupuesto } from "@/lib/presupuesto-propuesta";
import {
  CONDICIONES_DEFAULT,
  destacadosDesdeLineas,
  fusionarAvisosLineas,
  fusionarChipsLineas,
  propuestaVacia,
} from "@/lib/presupuesto-propuesta";
import { esLineaRepercusion } from "@/lib/presupuesto-totales";

export const COPILOTO_MAX_FILES = 6;
export const COPILOTO_MAX_BYTES = 4_000_000;
export const COPILOTO_TEXTO_MAX = 24_000;
export const COPILOTO_TEXTO_TOTAL = 50_000;
export const COPILOTO_MAX_PDF_VISUAL = 3;
export const COPILOTO_HISTORIAL_MAX = 10;

export const INSTRUCCION_ADJUNTOS = `Lee los documentos de la sesión y vuelca su contenido al esquema del CRM. Relaciónalos entre sí y con el presupuesto actual (JSON): si el Word o PDF es una ampliación, un listado de extras o una modificación sobre el origen, usa tipo=ampliacion; si es el presupuesto entero, tipo=presupuesto. Si hay dos versiones del mismo listado, usa la más desglosada (con m², ml y precios unitarios) y cruza los totales. Conserva lo ya acordado en el historial.`;

export type LineaCopiloto = {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  unidad: string;
  capitulo: string;
  etiquetas: string[];
  aviso: string;
  nota: string;
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
  etiquetas: z.array(z.string()).catch([]),
  aviso: z.string().catch(""),
  nota: z.string().catch(""),
});

const bajaSchema = z.object({
  descripcion: z.string(),
  importe: z.number(),
});

const propuestaTextoSchema = z.object({
  subtitulo_portada: z.string().catch(""),
  descripcion_portada: z.string().catch(""),
  emplazamiento: z.string().catch(""),
  contacto: z.string().catch(""),
  plazo_ejecucion: z.string().catch(""),
  validez_oferta: z.string().catch(""),
  escala: z.string().catch(""),
  objeto_alcance: z.string().catch(""),
  zonas: z.array(zonaSchema).catch([]),
  programa: z.array(faseSchema).catch([]),
  condiciones: z.string().catch(""),
  tipo: z.enum(["presupuesto", "ampliacion"]).catch("presupuesto"),
  origen_numero: z.string().catch(""),
  origen_total: z.number().catch(0),
  ajuste_comercial: z.number().catch(0),
  bajas: z.array(bajaSchema).catch([]),
  mostrar_repercusion: z.boolean().catch(false),
  observaciones: z.string().catch(""),
  mostrar_observaciones: z.boolean().catch(false),
  condicionantes_ejecucion: z.string().catch(""),
  mostrar_zonas: z.boolean().catch(true),
  mostrar_programa: z.boolean().catch(true),
  chips_portada: z.array(z.string()).catch([]),
  regimen_titulo: z.string().catch(""),
  regimen_destacado: z.string().catch(""),
  regimen_importe: z.string().catch(""),
  regimen_pie: z.string().catch(""),
  regimen_metricas: z.array(z.object({ valor: z.string(), etiqueta: z.string() })).catch([]),
  regimenes: z.array(z.object({ chip: z.string(), titulo: z.string(), texto: z.string() })).catch([]),
  factores_valoracion: z.array(z.object({ titulo: z.string(), texto: z.string() })).catch([]),
  chips_lineas: z.array(z.object({ descripcion: z.string(), chips: z.array(z.string()) })).catch([]),
  avisos_lineas: z.array(z.object({ descripcion: z.string(), tipo: z.enum(["aviso", "nota"]), texto: z.string() })).catch([]),
});

const propuestaTextoLlmSchema = z.object({
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
  tipo: z.enum(["presupuesto", "ampliacion"]),
  origen_numero: z.string(),
  origen_total: z.number(),
  ajuste_comercial: z.number(),
  bajas: z.array(bajaSchema),
  mostrar_repercusion: z.boolean(),
  observaciones: z.string(),
  mostrar_observaciones: z.boolean(),
  condicionantes_ejecucion: z.string(),
  mostrar_zonas: z.boolean(),
  mostrar_programa: z.boolean(),
  chips_portada: z.array(z.string()),
  regimen_titulo: z.string(),
  regimen_destacado: z.string(),
  regimen_importe: z.string(),
  regimen_pie: z.string(),
  regimen_metricas: z.array(z.object({ valor: z.string(), etiqueta: z.string() })),
  regimenes: z.array(z.object({ chip: z.string(), titulo: z.string(), texto: z.string() })),
  factores_valoracion: z.array(z.object({ titulo: z.string(), texto: z.string() })),
  chips_lineas: z.array(z.object({ descripcion: z.string(), chips: z.array(z.string()) })),
  avisos_lineas: z.array(z.object({ descripcion: z.string(), tipo: z.enum(["aviso", "nota"]), texto: z.string() })),
});

/** Schema enviado al modelo: sin default/catch (Anthropic rechaza `default` en JSON Schema). */
export const copilotoLlmSchema = z.object({
  resumen: z.string(),
  sugerencias: z.array(z.string()),
  concepto: z.string(),
  porcentaje_descuento: z.number(),
  lineas: z.array(lineaSchema),
  propuesta: propuestaTextoLlmSchema,
});

export const copilotoOutputSchema = z.object({
  resumen: z.string().catch(""),
  sugerencias: z.array(z.string()).catch([]),
  concepto: z.string().catch(""),
  porcentaje_descuento: z.number().catch(0),
  lineas: z.array(lineaSchema).catch([]),
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
Redactas y CORRIGES propuestas técnicas y económicas en español (España). No diseñas el PDF: el CRM ya tiene plantilla fija (incluida Riazor si el cliente es Deportivo). Tú solo rellenas y ajustas DATOS.

PDF del CRM o de Design (Riazor): extrae también el sistema visual de DATOS (no redibujes el estadio):
- chips_portada: etiquetas de zona en portada (TRIBUNA, PREFERENCIA, MARATÓN…).
- regimen_*: barra oscura de cifras (importe fuera de horario, %, horas, domingos).
- regimenes[]: tarjetas NOCTURNO / DOMINGO / URGENCIA / 1 DÍA PARA OTRO (chip + título + texto).
- factores_valoracion[]: columnas con filete azul (recinto en uso, altura, materiales…).
- En cada partida: etiquetas[] (NOCTURNO, URGENCIA, FIN DE SEMANA, FUERA DEL ALCANCE…) y aviso (chip rojo) o nota (cajetín azul de condiciones especiales).

Trabajas en una conversación continua (como un estudio):
- El usuario va soltando Word, PDF, cifras y correcciones en cualquier orden. Asocia, contextualiza y corrige; no empieces de cero en cada mensaje.
- Si hay BORRADOR (propuesta en curso, aún no volcada al formulario), aplica la petición SOBRE EL BORRADOR y conserva lo que no toquen.
- El ESTADO del formulario es lo ya aceptado. Úsalo si no hay borrador, o como origen si piden deshacer el rumbo.
- Los adjuntos de la sesión siguen vigentes aunque el mensaje no los nombre. Un documento nuevo se cruza con los anteriores (inicial vs ampliación, listado vs listado con mediciones).
- Recuerda restricciones del historial (turno nocturno, quitar una partida, tope 45.000, ocultar un bloque) salvo que las revoquen.
- Si algo es ambiguo, elige la lectura más coherente con los documentos y dilo en sugerencias. No pidas que reformateen el Word.

La mayoría de peticiones son correcciones sobre un presupuesto ya montado, o volcar un Word/PDF que llega de obra. Aplica el cambio con precisión y devuelve el documento completo resultante.

Documentos Word de obra (prosa, no tablas):
- "01. TÍTULO: 6.850.00€" o "Total: 18.562.00€" al final de un bloque = una partida. Los puntos son miles (12.400.00 = 12400).
- Si el bloque da medición y unitario ("162,00 m² x 116"), usa cantidad, unidad y precioUnitario. Si solo hay un total de partida, cantidad = 1, unidad = pa, precioUnitario = ese total.
- "Descuento de 12.400.00€ por mano de obra de colocación de moqueta" = baja del presupuesto inicial (propuesta.bajas), no porcentaje_descuento.
- "INCREMENTO SOBRE EL PRESUPUESTO INICIAL 45.000.00 €" = incremento neto objetivo: encájalo con ajuste_comercial una sola vez.
- Listados tipo "Ampliaciones de pintura / pladur / carpintería" = capítulos; cada ítem con su Total es una partida.
- Si adjuntan el presupuesto inicial Y la ampliación (o dos versiones de ampliaciones), cruza partidas: las que desaparecen del inicial van a bajas; las nuevas son altas. El estado JSON del CRM es el "anterior" si ya hay partidas.
- Horarios (noche, domingo, urgencia, premura) → condicionantes_ejecucion.

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
- Si hay régimen especial, chips o avisos, el CRM añade hoja de condicionantes. Por defecto mostrar_zonas = false, mostrar_programa = false, mostrar_repercusion = true, mostrar_observaciones = false.
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
      etiquetas: (l.etiquetas ?? []).map((c) => String(c).trim()).filter(Boolean),
      aviso: (l.aviso ?? "").trim(),
      nota: (l.nota ?? "").trim(),
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
        : [{ descripcion: "", cantidad: 0, precioUnitario: 0, unidad: "ud", capitulo: "01 · Actuación", etiquetas: [], aviso: "", nota: "" }],
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
      chips_portada: (p.chips_portada ?? []).map((c) => String(c).trim()).filter(Boolean),
      regimen_titulo: (p.regimen_titulo ?? "").trim() || "Régimen de ejecución extraordinario",
      regimen_destacado: (p.regimen_destacado ?? "").trim(),
      regimen_importe: (p.regimen_importe ?? "").trim(),
      regimen_pie: (p.regimen_pie ?? "").trim(),
      regimen_metricas: (p.regimen_metricas ?? [])
        .map((m) => ({ valor: String(m.valor ?? "").trim(), etiqueta: String(m.etiqueta ?? "").trim() }))
        .filter((m) => m.valor || m.etiqueta),
      regimenes: (p.regimenes ?? [])
        .map((r) => ({
          chip: String(r.chip ?? "").trim(),
          titulo: String(r.titulo ?? "").trim(),
          texto: String(r.texto ?? "").trim(),
        }))
        .filter((r) => r.chip || r.titulo || r.texto),
      factores_valoracion: (p.factores_valoracion ?? [])
        .map((f) => ({ titulo: String(f.titulo ?? "").trim(), texto: String(f.texto ?? "").trim() }))
        .filter((f) => f.titulo || f.texto),
      chips_lineas: fusionarChipsLineas([
        ...(p.chips_lineas ?? []),
        ...destacadosDesdeLineas(lineas).chips_lineas,
      ]),
      avisos_lineas: fusionarAvisosLineas([
        ...(p.avisos_lineas ?? []),
        ...destacadosDesdeLineas(lineas).avisos_lineas,
      ]),
    },
  };
}

export function parsearSalidaCopiloto(text: string): CopilotoOutput {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Pega un JSON de presupuesto válido.");
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const bloques = fence ? [fence[1].trim(), trimmed] : [trimmed];
  let raw: unknown;
  for (const bloque of bloques) {
    const start = bloque.indexOf("{");
    const end = bloque.lastIndexOf("}");
    if (start < 0 || end <= start) continue;
    try {
      raw = JSON.parse(bloque.slice(start, end + 1));
      break;
    } catch {
      /* siguiente bloque */
    }
  }
  if (raw == null) {
    throw new Error("No hay un JSON válido.");
  }
  const parsed = copilotoOutputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Ese JSON no es el esquema del copiloto.");
  }
  return normalizarOutput(parsed.data);
}

export function aplicarPropuestaTexto(
  actual: PropuestaPresupuesto,
  texto: CopilotoOutput["propuesta"],
  lineas?: LineaCopiloto[]
): PropuestaPresupuesto {
  const tipo = texto.tipo === "ampliacion" ? "ampliacion" : "presupuesto";
  const merged: PropuestaPresupuesto = {
    ...actual,
    ...texto,
    tipo,
    adjuntos: actual.adjuntos,
    foto_portada: actual.foto_portada,
    densidad_tabla: tipo === "ampliacion" ? "compacta" : actual.densidad_tabla,
    variante_portada: actual.variante_portada,
  };
  if (!lineas?.length) return merged;
  const desdeLineas = destacadosDesdeLineas(lineas);
  return {
    ...merged,
    chips_lineas: fusionarChipsLineas([...merged.chips_lineas, ...desdeLineas.chips_lineas]),
    avisos_lineas: fusionarAvisosLineas([...merged.avisos_lineas, ...desdeLineas.avisos_lineas]),
  };
}

export function estadoDesdeBorrador(estado: EstadoCopiloto, output: CopilotoOutput): EstadoCopiloto {
  const propuesta = output.propuesta;
  return {
    ...estado,
    concepto: output.concepto.trim() || estado.concepto,
    porcentaje_descuento: propuesta.tipo === "ampliacion" ? 0 : output.porcentaje_descuento,
    lineas: output.lineas,
    propuesta: {
      ...estado.propuesta,
      ...propuesta,
    },
  };
}

export function snapshotEstado(estado: EstadoCopiloto) {
  return {
    concepto: estado.concepto,
    porcentaje_impuesto: estado.porcentaje_impuesto,
    porcentaje_descuento: estado.porcentaje_descuento,
    lineas: estado.lineas,
    propuesta: estado.propuesta,
  };
}

export const MODELO_COPILOTO = "claude-opus-5";
export const MODELO_COPILOTO_FALLBACK = "claude-sonnet-4-6";
