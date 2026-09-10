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
  };
}
