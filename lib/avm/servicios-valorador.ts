import { AVM_DATA_STALE_MONTHS, evaluarCaducidadCapa, type AvmDataLayer } from "./data-health";

export type GrupoServicio = "entorno" | "mercado" | "consulta";

export type Cadencia =
  | { tipo: "trimestral"; dia: number; meses: number[]; horaUtc: number }
  | { tipo: "anual"; mes: number; dia: number; horaUtc: number }
  | { tipo: "semanal"; weekday: number; horas: { horaUtc: number; minutoUtc: number; etiqueta: string }[] }
  | { tipo: "en_cada_valoracion" };

export type ServicioValorador = {
  id: string;
  grupo: GrupoServicio;
  titulo: string;
  paraQue: string;
  capa?: AvmDataLayer;
  cadencia: Cadencia;
  cadenciaTexto: string;
  donde: string;
};

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export const SERVICIOS_VALORADOR: ServicioValorador[] = [
  {
    id: "osm",
    grupo: "entorno",
    titulo: "Calles, comercios y molestias",
    paraQue: "Supermercados, farmacias, parques, playas, gasolineras, vías principales, ferrocarril y líneas eléctricas.",
    capa: "osm",
    cadencia: { tipo: "trimestral", dia: 1, meses: [1, 4, 7, 10], horaUtc: 5 },
    cadenciaTexto: "Cada 3 meses · 1 de enero, abril, julio y octubre · 05:00 UTC",
    donde: "GitHub Actions · OSM",
  },
  {
    id: "gtfs",
    grupo: "entorno",
    titulo: "Paradas de bus y tren",
    paraQue: "Transporte público cercano. En A Coruña usa el GTFS de Tranvías; el resto sale de OpenStreetMap.",
    capa: "gtfs",
    cadencia: { tipo: "trimestral", dia: 1, meses: [1, 4, 7, 10], horaUtc: 5 },
    cadenciaTexto: "Cada 3 meses · misma pasada que OpenStreetMap",
    donde: "GitHub Actions · GTFS",
  },
  {
    id: "crime",
    grupo: "entorno",
    titulo: "Criminalidad municipal",
    paraQue: "Aviso informativo: infracciones por 1.000 habitantes y la media de ciudades parecidas.",
    capa: "crime",
    cadencia: { tipo: "trimestral", dia: 15, meses: [1, 4, 7, 10], horaUtc: 5 },
    cadenciaTexto: "Cada 3 meses · día 15 de enero, abril, julio y octubre · 05:00 UTC",
    donde: "GitHub Actions · Interior",
  },
  {
    id: "snczi",
    grupo: "entorno",
    titulo: "Zonas inundables",
    paraQue: "Aviso si el punto cae en T10, T100 o T500. Si hay mapa cargado y el punto está fuera, se indica que no hay zona inundable.",
    capa: "snczi",
    cadencia: { tipo: "anual", mes: 2, dia: 1, horaUtc: 5 },
    cadenciaTexto: "Una vez al año · 1 de febrero · 05:00 UTC",
    donde: "GitHub Actions · SNCZI",
  },
  {
    id: "noise",
    grupo: "entorno",
    titulo: "Ruido",
    paraQue: "Mapa estratégico de ruido (Lden). Si no hay mapa, una vía principal a menos de 40 m sirve de respaldo.",
    capa: "noise",
    cadencia: { tipo: "anual", mes: 2, dia: 1, horaUtc: 5 },
    cadenciaTexto: "Una vez al año · 1 de febrero · misma pasada que inundabilidad",
    donde: "GitHub Actions · ruido",
  },
  {
    id: "vulnerability",
    grupo: "entorno",
    titulo: "Barrios vulnerables",
    paraQue: "Aviso si la sección censal está en el catálogo del Observatorio de la Vulnerabilidad Urbana.",
    capa: "vulnerability",
    cadencia: { tipo: "anual", mes: 2, dia: 1, horaUtc: 5 },
    cadenciaTexto: "Una vez al año · 1 de febrero · misma pasada que inundabilidad",
    donde: "GitHub Actions · OVU",
  },
  {
    id: "ine_sections",
    grupo: "entorno",
    titulo: "Secciones censales",
    paraQue: "Sitúa el inmueble en su sección para renta, vulnerabilidad y estadísticas de zona.",
    capa: "ine_sections",
    cadencia: { tipo: "anual", mes: 1, dia: 20, horaUtc: 5 },
    cadenciaTexto: "Una vez al año · 20 de enero · 05:00 UTC",
    donde: "GitHub Actions · INE",
  },
  {
    id: "inspire",
    grupo: "entorno",
    titulo: "Edificios de Catastro",
    paraQue: "Año, plantas y uso del edificio en los municipios que se rastrean, sin esperar a la Sede.",
    capa: "inspire",
    cadencia: { tipo: "trimestral", dia: 5, meses: [1, 4, 7, 10], horaUtc: 5 },
    cadenciaTexto: "Cada 3 meses · día 5 de enero, abril, julio y octubre · 05:00 UTC",
    donde: "GitHub Actions · INSPIRE",
  },
  {
    id: "mercado",
    grupo: "mercado",
    titulo: "Anuncios comparables",
    paraQue: "Fotocasa, Habitaclia y Pisos.com, en venta y alquiler. De aquí salen el precio y el alquiler.",
    cadencia: {
      tipo: "semanal",
      weekday: 0,
      horas: [
        { horaUtc: 1, minutoUtc: 0, etiqueta: "Fotocasa venta" },
        { horaUtc: 1, minutoUtc: 10, etiqueta: "Fotocasa alquiler" },
        { horaUtc: 1, minutoUtc: 20, etiqueta: "Habitaclia venta" },
        { horaUtc: 1, minutoUtc: 30, etiqueta: "Habitaclia alquiler" },
        { horaUtc: 1, minutoUtc: 40, etiqueta: "Pisos.com venta" },
        { horaUtc: 1, minutoUtc: 50, etiqueta: "Pisos.com alquiler" },
      ],
    },
    cadenciaTexto: "Cada domingo · seis pasadas desde la 01:00 UTC, una por portal y operación",
    donde: "Supabase · /api/avm/crawl",
  },
  {
    id: "catastro",
    grupo: "consulta",
    titulo: "Sede del Catastro",
    paraQue: "Referencia, calle, superficie, año y tipo. Se consulta al valorar y se guarda 90 días.",
    cadencia: { tipo: "en_cada_valoracion" },
    cadenciaTexto: "En cada valoración · caché de 90 días",
    donde: "Sede electrónica del Catastro",
  },
  {
    id: "cartociudad",
    grupo: "consulta",
    titulo: "CartoCiudad",
    paraQue: "Calle, número, municipio y código postal a partir de la dirección o de las coordenadas.",
    cadencia: { tipo: "en_cada_valoracion" },
    cadenciaTexto: "En cada valoración",
    donde: "Instituto Geográfico Nacional",
  },
  {
    id: "google",
    grupo: "consulta",
    titulo: "Google Geocoding",
    paraQue: "Respaldo de dirección cuando CartoCiudad no devuelve un portal.",
    cadencia: { tipo: "en_cada_valoracion" },
    cadenciaTexto: "Solo si CartoCiudad no responde",
    donde: "Google Maps",
  },
];

export const GRUPOS_SERVICIO: { id: GrupoServicio; titulo: string; texto: string }[] = [
  {
    id: "entorno",
    titulo: "Entorno y avisos",
    texto: "Lo que ves a favor, en contra y en riesgos. GitHub Actions lo recarga solo; el Mac no interviene.",
  },
  {
    id: "mercado",
    titulo: "Mercado",
    texto: "Los anuncios con los que se calcula el precio. Si esta pasada se para, la valoración sigue con lo último cargado.",
  },
  {
    id: "consulta",
    titulo: "Al valorar",
    texto: "No tienen calendario. Se llaman cuando abres una valoración nueva.",
  },
];

export type EstadoServicio = "ok" | "stale" | "missing" | "live";

export function estadoDeCapa(layer: AvmDataLayer, loadedAt: string | null, now = Date.now()): EstadoServicio {
  if (!loadedAt) return "missing";
  return evaluarCaducidadCapa(layer, loadedAt, now).stale ? "stale" : "ok";
}

export function estadoDeMercado(lastRun: string | null, now = Date.now()): EstadoServicio {
  if (!lastRun) return "missing";
  const dias = (now - new Date(lastRun).getTime()) / (1000 * 60 * 60 * 24);
  return dias > 10 ? "stale" : "ok";
}

export function etiquetaEstado(estado: EstadoServicio): string {
  if (estado === "ok") return "Al día";
  if (estado === "stale") return "Fuera de plazo";
  if (estado === "missing") return "Sin carga";
  return "En cada valoración";
}

export function plazoCapa(layer: AvmDataLayer): string {
  return `${AVM_DATA_STALE_MONTHS[layer]} meses`;
}

function utc(y: number, monthIndex: number, day: number, hour: number, minute = 0): Date {
  return new Date(Date.UTC(y, monthIndex, day, hour, minute));
}

export function proximaCarga(cadencia: Cadencia, now = new Date()): Date | null {
  if (cadencia.tipo === "en_cada_valoracion") return null;
  const t = now.getTime();
  if (cadencia.tipo === "trimestral") {
    const candidatos: Date[] = [];
    for (const year of [now.getUTCFullYear(), now.getUTCFullYear() + 1]) {
      for (const mes of cadencia.meses) {
        candidatos.push(utc(year, mes - 1, cadencia.dia, cadencia.horaUtc));
      }
    }
    return candidatos.find((d) => d.getTime() > t) ?? null;
  }
  if (cadencia.tipo === "anual") {
    for (const year of [now.getUTCFullYear(), now.getUTCFullYear() + 1]) {
      const d = utc(year, cadencia.mes - 1, cadencia.dia, cadencia.horaUtc);
      if (d.getTime() > t) return d;
    }
    return null;
  }
  const candidatos = cadencia.horas.map((h) => {
    const d = new Date(now);
    const delta = (cadencia.weekday - d.getUTCDay() + 7) % 7;
    d.setUTCDate(d.getUTCDate() + delta);
    d.setUTCHours(h.horaUtc, h.minutoUtc, 0, 0);
    if (d.getTime() <= t) d.setUTCDate(d.getUTCDate() + 7);
    return d;
  });
  candidatos.sort((a, b) => a.getTime() - b.getTime());
  return candidatos[0] ?? null;
}

export function fmtCuando(iso: string | null, now = Date.now()): string {
  if (!iso) return "Nunca";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Nunca";
  const dias = Math.floor((now - d.getTime()) / (1000 * 60 * 60 * 24));
  const fecha = d.toLocaleString("es-ES", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  if (dias <= 0) return `Hoy · ${fecha}`;
  if (dias === 1) return `Ayer · ${fecha}`;
  if (dias < 60) return `Hace ${dias} días · ${fecha}`;
  return fecha;
}

export function fmtProxima(fecha: Date | null): string {
  if (!fecha) return "Sin calendario";
  return fecha.toLocaleString("es-ES", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }) + " UTC";
}

export function nombreMes(n: number): string {
  return MESES[n - 1] ?? String(n);
}
