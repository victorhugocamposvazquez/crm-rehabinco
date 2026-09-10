export type ZonaIntervencion = {
  codigo: string;
  titulo: string;
  descripcion: string;
};

export type FasePrograma = {
  codigo: string;
  descripcion: string;
};

export type AdjuntoPresupuesto = {
  id: string;
  nombre: string;
  dataUrl: string;
};

export type DensidadTabla = "normal" | "compacta";
export type VariantePortada = "auto" | "foto" | "rejilla";
export type TipoDocumentoPresupuesto = "presupuesto" | "ampliacion";

export type BajaRepercusion = {
  descripcion: string;
  importe: number;
};

export type ChipTono = "neutro" | "oscuro" | "azul" | "aviso";

export type MetricaDestacada = {
  valor: string;
  etiqueta: string;
};

export type BloqueRegimen = {
  chip: string;
  titulo: string;
  texto: string;
};

export type FactorValoracion = {
  titulo: string;
  texto: string;
};

export type ChipLinea = {
  descripcion: string;
  chips: string[];
};

export type AvisoLinea = {
  descripcion: string;
  tipo: "aviso" | "nota";
  texto: string;
};

export function tonoChip(etiqueta: string): ChipTono {
  const e = etiqueta.trim().toUpperCase();
  if (/ALCANCE|AVISO|NO INCLUID|EXCLUID|PELIGR/.test(e)) return "aviso";
  if (/NOCTURN/.test(e)) return "oscuro";
  if (/DOMINGO|SEMANA|URGENC|PREMURA|FESTIV/.test(e)) return "azul";
  return "neutro";
}

function claveDesc(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function chipsDePartida(p: Pick<PropuestaPresupuesto, "chips_lineas">, descripcion: string): string[] {
  const k = claveDesc(descripcion);
  const hit = p.chips_lineas.find((c) => claveDesc(c.descripcion) === k);
  return (hit?.chips ?? []).map((c) => c.trim()).filter(Boolean);
}

export function avisosDePartida(p: Pick<PropuestaPresupuesto, "avisos_lineas">, descripcion: string): AvisoLinea[] {
  const k = claveDesc(descripcion);
  return p.avisos_lineas.filter((a) => claveDesc(a.descripcion) === k && a.texto.trim());
}

export function avisoDePartida(p: Pick<PropuestaPresupuesto, "avisos_lineas">, descripcion: string): AvisoLinea | null {
  return avisosDePartida(p, descripcion)[0] ?? null;
}

export type DestacadosPartida = {
  etiquetas: string[];
  aviso: string;
  nota: string;
};

export function destacadosDePartida(
  p: Pick<PropuestaPresupuesto, "chips_lineas" | "avisos_lineas">,
  descripcion: string
): DestacadosPartida {
  const avisos = avisosDePartida(p, descripcion);
  return {
    etiquetas: chipsDePartida(p, descripcion),
    aviso: avisos.find((a) => a.tipo === "aviso")?.texto ?? "",
    nota: avisos.find((a) => a.tipo === "nota")?.texto ?? "",
  };
}

export function fusionarChipsLineas(items: ChipLinea[]): ChipLinea[] {
  const order: string[] = [];
  const map = new Map<string, ChipLinea>();
  for (const item of items) {
    const descripcion = item.descripcion.trim();
    const chips = item.chips.map((c) => c.trim()).filter(Boolean);
    if (!descripcion || chips.length === 0) continue;
    const k = claveDesc(descripcion);
    const prev = map.get(k);
    if (!prev) {
      map.set(k, { descripcion, chips: [...chips] });
      order.push(k);
      continue;
    }
    for (const c of chips) {
      if (!prev.chips.some((x) => x.toUpperCase() === c.toUpperCase())) prev.chips.push(c);
    }
  }
  return order.map((k) => map.get(k)!);
}

export function fusionarAvisosLineas(items: AvisoLinea[]): AvisoLinea[] {
  const order: string[] = [];
  const map = new Map<string, AvisoLinea>();
  for (const item of items) {
    const descripcion = item.descripcion.trim();
    const texto = item.texto.trim();
    if (!descripcion || !texto) continue;
    const tipo = item.tipo === "nota" ? "nota" : "aviso";
    const k = `${claveDesc(descripcion)}::${tipo}`;
    if (!map.has(k)) order.push(k);
    map.set(k, { descripcion, tipo, texto });
  }
  return order.map((k) => map.get(k)!);
}

export function destacadosDesdeLineas(
  lineas: { descripcion: string; etiquetas?: string[]; aviso?: string; nota?: string }[]
): { chips_lineas: ChipLinea[]; avisos_lineas: AvisoLinea[] } {
  return {
    chips_lineas: fusionarChipsLineas(
      lineas.map((l) => ({
        descripcion: l.descripcion,
        chips: l.etiquetas ?? [],
      }))
    ),
    avisos_lineas: fusionarAvisosLineas(
      lineas.flatMap((l) => {
        const out: AvisoLinea[] = [];
        if (l.aviso?.trim()) out.push({ descripcion: l.descripcion, tipo: "aviso", texto: l.aviso });
        if (l.nota?.trim()) out.push({ descripcion: l.descripcion, tipo: "nota", texto: l.nota });
        return out;
      })
    ),
  };
}

export function propuestaConDestacadosDeLineas<T extends { descripcion: string; etiquetas?: string[]; aviso?: string; nota?: string }>(
  p: PropuestaPresupuesto,
  lineas: T[]
): PropuestaPresupuesto {
  const d = destacadosDesdeLineas(lineas);
  return { ...p, chips_lineas: d.chips_lineas, avisos_lineas: d.avisos_lineas };
}

export function hidratarDestacadosEnLineas<T extends { descripcion: string; etiquetas?: string[]; aviso?: string; nota?: string }>(
  lineas: T[],
  p: Pick<PropuestaPresupuesto, "chips_lineas" | "avisos_lineas">
): (T & DestacadosPartida)[] {
  return lineas.map((l) => {
    const d = destacadosDePartida(p, l.descripcion);
    return {
      ...l,
      etiquetas: (l.etiquetas ?? []).map((c) => c.trim()).filter(Boolean).length
        ? (l.etiquetas ?? []).map((c) => c.trim()).filter(Boolean)
        : d.etiquetas,
      aviso: l.aviso?.trim() ? l.aviso.trim() : d.aviso,
      nota: l.nota?.trim() ? l.nota.trim() : d.nota,
    };
  });
}

export function tieneHojaCondicionantes(p: PropuestaPresupuesto) {
  return (
    p.regimen_destacado.trim().length > 0 ||
    p.regimen_importe.trim().length > 0 ||
    p.regimen_metricas.some((m) => m.valor.trim() || m.etiqueta.trim()) ||
    p.regimenes.some((r) => r.titulo.trim() || r.texto.trim()) ||
    p.factores_valoracion.some((f) => f.titulo.trim() || f.texto.trim()) ||
    p.condicionantes_ejecucion.trim().length > 0
  );
}

export type PropuestaPresupuesto = {
  subtitulo_portada: string;
  descripcion_portada: string;
  emplazamiento: string;
  contacto: string;
  plazo_ejecucion: string;
  validez_oferta: string;
  escala: string;
  objeto_alcance: string;
  zonas: ZonaIntervencion[];
  programa: FasePrograma[];
  condiciones: string;
  adjuntos: AdjuntoPresupuesto[];
  foto_portada: AdjuntoPresupuesto | null;
  densidad_tabla: DensidadTabla;
  variante_portada: VariantePortada;
  tipo: TipoDocumentoPresupuesto;
  origen_numero: string;
  origen_total: number;
  ajuste_comercial: number;
  bajas: BajaRepercusion[];
  mostrar_repercusion: boolean;
  observaciones: string;
  mostrar_observaciones: boolean;
  condicionantes_ejecucion: string;
  mostrar_zonas: boolean;
  mostrar_programa: boolean;
  chips_portada: string[];
  regimen_titulo: string;
  regimen_destacado: string;
  regimen_importe: string;
  regimen_pie: string;
  regimen_metricas: MetricaDestacada[];
  regimenes: BloqueRegimen[];
  factores_valoracion: FactorValoracion[];
  chips_lineas: ChipLinea[];
  avisos_lineas: AvisoLinea[];
};

/** Código de partida tipo plantilla Riazor: 1.01, 2.03… */
export function codigoPartida(capitulo: string, capOrden: number, idxEnCap: number) {
  const m = capitulo.trim().match(/^(\d+)/);
  const n = m ? Number(m[1]) : capOrden;
  return `${n}.${String(idxEnCap).padStart(2, "0")}`;
}

export const CONDICIONES_DEFAULT = `Garantía de 24 meses sobre los trabajos ejecutados y la adherencia de los sistemas aplicados, conforme a las fichas técnicas de los fabricantes.

Los precios incluyen mano de obra, materiales, medios auxiliares, protecciones colectivas, retirada de residuos y limpieza final de las zonas intervenidas.

Forma de pago: certificaciones mensuales a 30 días desde la fecha de factura. Los trabajos fuera del alcance descrito se valorarán mediante precios contradictorios previa aprobación.`;

export function propuestaVacia(): PropuestaPresupuesto {
  return {
    subtitulo_portada: "",
    descripcion_portada: "",
    emplazamiento: "",
    contacto: "",
    plazo_ejecucion: "",
    validez_oferta: "30 días naturales",
    escala: "1:1000",
    objeto_alcance: "",
    zonas: [],
    programa: [],
    condiciones: CONDICIONES_DEFAULT,
    adjuntos: [],
    foto_portada: null,
    densidad_tabla: "normal",
    variante_portada: "auto",
    tipo: "presupuesto",
    origen_numero: "",
    origen_total: 0,
    ajuste_comercial: 0,
    bajas: [],
    mostrar_repercusion: false,
    observaciones: "",
    mostrar_observaciones: false,
    condicionantes_ejecucion: "",
    mostrar_zonas: true,
    mostrar_programa: true,
    chips_portada: [],
    regimen_titulo: "Régimen de ejecución extraordinario",
    regimen_destacado: "",
    regimen_importe: "",
    regimen_pie: "",
    regimen_metricas: [],
    regimenes: [],
    factores_valoracion: [],
    chips_lineas: [],
    avisos_lineas: [],
  };
}

function asString(v: unknown, fallback = "") {
  return typeof v === "string" ? v : fallback;
}

function asZonas(v: unknown): ZonaIntervencion[] {
  if (!Array.isArray(v)) return [];
  return v.map((z) => ({
    codigo: asString((z as ZonaIntervencion)?.codigo),
    titulo: asString((z as ZonaIntervencion)?.titulo),
    descripcion: asString((z as ZonaIntervencion)?.descripcion),
  }));
}

function asAdjunto(v: unknown): AdjuntoPresupuesto | null {
  if (!v || typeof v !== "object") return null;
  const o = v as AdjuntoPresupuesto;
  const dataUrl = asString(o?.dataUrl);
  if (!dataUrl.startsWith("data:image/")) return null;
  return {
    id: asString(o?.id) || crypto.randomUUID(),
    nombre: asString(o?.nombre) || "Portada",
    dataUrl,
  };
}

function asDensidad(v: unknown): DensidadTabla {
  return v === "compacta" ? "compacta" : "normal";
}

function asVariante(v: unknown): VariantePortada {
  if (v === "foto" || v === "rejilla") return v;
  return "auto";
}

function asAdjuntos(v: unknown): AdjuntoPresupuesto[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((a) => {
      const o = a as AdjuntoPresupuesto;
      const dataUrl = asString(o?.dataUrl);
      if (!dataUrl.startsWith("data:image/")) return null;
      return {
        id: asString(o?.id) || crypto.randomUUID(),
        nombre: asString(o?.nombre) || "Adjunto",
        dataUrl,
      };
    })
    .filter((a): a is AdjuntoPresupuesto => a !== null)
    .slice(0, 8);
}

function asTipo(v: unknown): TipoDocumentoPresupuesto {
  return v === "ampliacion" ? "ampliacion" : "presupuesto";
}

function asBool(v: unknown, fallback: boolean) {
  return typeof v === "boolean" ? v : fallback;
}

function asNum(v: unknown) {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : 0;
  return Number.isFinite(n) ? n : 0;
}

function asBajas(v: unknown): BajaRepercusion[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((b) => ({
      descripcion: asString((b as BajaRepercusion)?.descripcion),
      importe: Math.abs(asNum((b as BajaRepercusion)?.importe)),
    }))
    .filter((b) => b.descripcion.trim() || b.importe > 0);
}

function asPrograma(v: unknown): FasePrograma[] {
  if (!Array.isArray(v)) return [];
  return v.map((p) => ({
    codigo: asString((p as FasePrograma)?.codigo),
    descripcion: asString((p as FasePrograma)?.descripcion),
  }));
}

function asStringList(v: unknown): string[] {
  if (!Array.isArray(v)) {
    if (typeof v === "string") {
      return v.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return [];
  }
  return v.map((x) => asString(x)).map((s) => s.trim()).filter(Boolean);
}

function asMetricas(v: unknown): MetricaDestacada[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((m) => ({
      valor: asString((m as MetricaDestacada)?.valor),
      etiqueta: asString((m as MetricaDestacada)?.etiqueta),
    }))
    .filter((m) => m.valor.trim() || m.etiqueta.trim());
}

function asRegimenes(v: unknown): BloqueRegimen[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((r) => ({
      chip: asString((r as BloqueRegimen)?.chip),
      titulo: asString((r as BloqueRegimen)?.titulo),
      texto: asString((r as BloqueRegimen)?.texto),
    }))
    .filter((r) => r.chip.trim() || r.titulo.trim() || r.texto.trim());
}

function asFactores(v: unknown): FactorValoracion[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((f) => ({
      titulo: asString((f as FactorValoracion)?.titulo),
      texto: asString((f as FactorValoracion)?.texto),
    }))
    .filter((f) => f.titulo.trim() || f.texto.trim());
}

function asChipsLineas(v: unknown): ChipLinea[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((c) => ({
      descripcion: asString((c as ChipLinea)?.descripcion),
      chips: asStringList((c as ChipLinea)?.chips),
    }))
    .filter((c) => c.descripcion.trim() && c.chips.length > 0);
}

function asAvisosLineas(v: unknown): AvisoLinea[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((a) => {
      const tipo: AvisoLinea["tipo"] = (a as AvisoLinea)?.tipo === "nota" ? "nota" : "aviso";
      return {
        descripcion: asString((a as AvisoLinea)?.descripcion),
        tipo,
        texto: asString((a as AvisoLinea)?.texto),
      };
    })
    .filter((a) => a.descripcion.trim() && a.texto.trim());
}

export function parsePropuesta(raw: unknown): PropuestaPresupuesto {
  const base = propuestaVacia();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  return {
    subtitulo_portada: asString(o.subtitulo_portada, base.subtitulo_portada),
    descripcion_portada: asString(o.descripcion_portada, base.descripcion_portada),
    emplazamiento: asString(o.emplazamiento, base.emplazamiento),
    contacto: asString(o.contacto, base.contacto),
    plazo_ejecucion: asString(o.plazo_ejecucion, base.plazo_ejecucion),
    validez_oferta: asString(o.validez_oferta, base.validez_oferta) || base.validez_oferta,
    escala: asString(o.escala, base.escala) || base.escala,
    objeto_alcance: asString(o.objeto_alcance, base.objeto_alcance),
    zonas: asZonas(o.zonas),
    programa: asPrograma(o.programa),
    condiciones: asString(o.condiciones, base.condiciones) || base.condiciones,
    adjuntos: asAdjuntos(o.adjuntos),
    foto_portada: asAdjunto(o.foto_portada),
    densidad_tabla: asDensidad(o.densidad_tabla),
    variante_portada: asVariante(o.variante_portada),
    tipo: asTipo(o.tipo),
    origen_numero: asString(o.origen_numero),
    origen_total: Math.max(0, asNum(o.origen_total)),
    ajuste_comercial: asNum(o.ajuste_comercial),
    bajas: asBajas(o.bajas),
    mostrar_repercusion: asBool(o.mostrar_repercusion, asTipo(o.tipo) === "ampliacion"),
    observaciones: asString(o.observaciones),
    mostrar_observaciones: asBool(o.mostrar_observaciones, false),
    condicionantes_ejecucion: asString(o.condicionantes_ejecucion),
    mostrar_zonas: asBool(o.mostrar_zonas, asTipo(o.tipo) !== "ampliacion"),
    mostrar_programa: asBool(o.mostrar_programa, asTipo(o.tipo) !== "ampliacion"),
    chips_portada: asStringList(o.chips_portada),
    regimen_titulo: asString(o.regimen_titulo, base.regimen_titulo) || base.regimen_titulo,
    regimen_destacado: asString(o.regimen_destacado),
    regimen_importe: asString(o.regimen_importe),
    regimen_pie: asString(o.regimen_pie),
    regimen_metricas: asMetricas(o.regimen_metricas),
    regimenes: asRegimenes(o.regimenes),
    factores_valoracion: asFactores(o.factores_valoracion),
    chips_lineas: asChipsLineas(o.chips_lineas),
    avisos_lineas: asAvisosLineas(o.avisos_lineas),
  };
}
