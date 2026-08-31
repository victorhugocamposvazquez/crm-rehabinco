export type ZonaIntervencion = {
  codigo: string;
  titulo: string;
  descripcion: string;
};

export type FasePrograma = {
  codigo: string;
  descripcion: string;
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
};

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
  };
}
