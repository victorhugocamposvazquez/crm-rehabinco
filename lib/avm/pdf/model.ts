import type { CapaCargada } from "../entorno-coverage";
import { fmtCapaEntorno } from "../entorno-coverage";
import type { EnvironmentItem, Twin, ValuationResult } from "../types";
import { fmtEuros, fmtFechaCorta, fmtFechaLarga, fmtNumero, fmtPorcentaje } from "../ui/format";
import {
  ETIQUETA_CANAL,
  ETIQUETA_RANGE_METHOD,
  etiquetaConfianzaCorta,
  etiquetaMotorFuente,
  etiquetaPenalizacion,
  etiquetaTipoInmueble,
  humanizarExplicacion,
  chipFuenteCapa,
  etiquetaMetodoAlquiler,
} from "../ui/labels";

export const AVISO_LEGAL_PDF =
  "Estimación automática orientativa elaborada con datos públicos y de mercado. No es una tasación oficial (Orden ECO/805/2003) ni sustituye a una valoración pericial. Los datos personales del destinatario se tratan conforme a la política de privacidad de la agencia.";

export const COMO_LO_HEMOS_CALCULADO = [
  "Localizamos tu vivienda en Catastro: superficie, año y planta vienen de ahí, no de una estimación.",
  "Buscamos viviendas parecidas en venta a menos de 300 m y corregimos cada una por lo que la diferencia de la tuya: tamaño, planta, orientación, estado, garaje.",
  "Calculamos el precio por m² central de esas viviendas y lo aplicamos a tus {m2} m².",
  "Pasamos de precio de anuncio a precio de cierre con el descuento habitual de negociación, y damos un rango en vez de una cifra única.",
] as const;

export type PdfVariant = "propietario" | "interno";
export type PdfThemeName = "light" | "dark";

export type MarcaPdf = {
  name: string;
  phone: string | null;
  email: string | null;
  web: string | null;
  color: string;
  pdfTheme: PdfThemeName;
  logoLight: Buffer | null;
  logoDark: Buffer | null;
  agentName: string;
  agentPhone: string | null;
};

export type FilaFicha = { label: string; value: string; catastro?: boolean };
export type TonoChip = "good" | "warn" | "bad" | "info";
export type FilaEntornoPdf = { title: string; sub: string; points?: number; tone: TonoChip };
export type ComparablePdf = {
  zone: string;
  portal: string;
  price: number;
  m2: number;
  ppm2: number;
  adjustments: { text: string; up: boolean }[];
  adjustedPpm2: number;
  distanceM: number;
  weight: number;
};

export type InformePdfModel = {
  variant: PdfVariant;
  theme: PdfThemeName;
  marca: MarcaPdf;
  titulo: string;
  idCorto: string;
  idCompleto: string;
  fecha: string;
  fechaIso: string;
  methodVersion: string;
  address: string;
  localidad: string;
  tipo: string;
  surface: number | null;
  catastralRef: string | null;
  valueMid: number;
  valueLow: number;
  valueHigh: number;
  pricePerM2: number | null;
  zoneMedian: number | null;
  rentMonthly: number | null;
  rentMethod: string;
  grossYield: number | null;
  comparablesCount: number;
  confidenceLabel: string;
  confidence: number;
  precision: number;
  offerPrice: number;
  offerNote: string;
  rangeNote: string;
  ficha: FilaFicha[];
  mercadoOwner: FilaFicha[];
  mercadoInterno: FilaFicha[];
  zoneBar: { leftPct: number; p25: string; median: string; p75: string; note: string } | null;
  sources: { label: string; tone: TonoChip }[];
  penalties: { points: string; text: string }[];
  comparables: ComparablePdf[];
  positivos: FilaEntornoPdf[];
  negativos: FilaEntornoPdf[];
  avisos: FilaEntornoPdf[];
  envScore: number | null;
  envWord: string | null;
  layers: { name: string; date: string }[];
  explanation: string[];
  meta: { label: string; value: string; mono?: boolean }[];
  bullets: string[];
};

const PORTAL: Record<string, string> = {
  fotocasa: "Fotocasa",
  habitaclia: "Habitaclia",
  pisos: "pisos.com",
  idealista: "Idealista",
  milanuncios: "Milanuncios",
};

const ESTADO: Record<number, string> = {
  1: "Ruina",
  2: "A reformar",
  3: "Normal",
  4: "Bueno",
  5: "Excelente",
};

export function inicialesMarca(name: string): string {
  const limpio = name.replace(/[,.].*$/, "").trim();
  const partes = limpio.split(/\s+/).filter((p) => p.length > 1);
  const base = partes.length ? partes : limpio.split(/\s+/);
  if (base.length <= 1) return (base[0]?.[0] ?? "A").toUpperCase();
  return (base[0][0] + base[1][0]).toUpperCase();
}

export function nombreDescargaPdf(calleNumero: string, fechaIso: string): string {
  const slug = calleNumero
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `Valoracion-${slug || "inmueble"}-${fechaIso.slice(0, 10)}.pdf`;
}

export function rutaPdfGuardado(tenantId: string, valuationId: string, variant: PdfVariant, theme: PdfThemeName): string {
  return `${tenantId}/${valuationId}-${variant}-${theme}.pdf`;
}

function catastro(fieldSources: Record<string, string>, key: string): boolean {
  return (fieldSources[key] ?? "").includes("catastro");
}

function planta(twin: Twin): string {
  if (twin.floorOfFlat == null) return "sin dato";
  const ordinal = `${twin.floorOfFlat}ª`;
  return twin.numberOfFloors != null ? `${ordinal} de ${twin.numberOfFloors}` : ordinal;
}

function distribucion(twin: Twin): string {
  const partes: string[] = [];
  if (twin.numberOfBedrooms != null) partes.push(`${twin.numberOfBedrooms} dormitorios`);
  else if (twin.numberOfRooms != null) partes.push(`${twin.numberOfRooms} habitaciones`);
  if (twin.numberOfBathrooms != null) partes.push(`${twin.numberOfBathrooms} baños`);
  return partes.length ? partes.join(" · ") : "sin dato";
}

function garaje(twin: Twin): string {
  const n = (twin.numberOfIndoorParkings ?? 0) + (twin.numberOfOutdoorParkings ?? 0);
  if (twin.numberOfIndoorParkings == null && twin.numberOfOutdoorParkings == null) return "sin dato";
  if (!n) return "No";
  const cubierta = twin.numberOfIndoorParkings ? " cubierta" : "";
  return `${n} plaza${n === 1 ? "" : "s"}${cubierta}`;
}

function extras(twin: Twin): string {
  const partes: string[] = [];
  if (twin.hasStorageRoom) partes.push("Trastero");
  if (twin.balconySurface) partes.push(`Balcón ${fmtNumero(twin.balconySurface)} m²`);
  else if (twin.hasBalcony) partes.push("Balcón");
  if (twin.hasGarden) partes.push("Jardín");
  if (twin.hasSwimmingPool) partes.push("Piscina");
  return partes.length ? partes.join(", ") : "sin dato";
}

function estado(twin: Twin): string {
  const base = twin.buildingCondition != null ? ESTADO[twin.buildingCondition] : null;
  if (twin.renovationYear) {
    const reforma = `reformado en ${twin.renovationYear}`;
    return base ? `${base} · ${reforma}` : reforma;
  }
  if (twin.isRenovated) return base ? `${base} · reformado` : "Reformado";
  return base ?? "sin dato";
}

function lado(twin: Twin): string {
  if (twin.side === "exterior") return "Exterior";
  if (twin.side === "interior") return "Interior";
  return "sin dato";
}

function ascensor(twin: Twin): string {
  if (twin.hasElevator == null) return "sin dato";
  return twin.hasElevator ? "Sí" : "No";
}

function esMarcaEquipo(item: EnvironmentItem): boolean {
  return item.indicator.startsWith("zone_mark") || /conocimiento local/i.test(item.source);
}

function subEntorno(item: EnvironmentItem): string {
  const metros = item.distanceM != null && item.distanceM > 0 ? `a ${Math.round(item.distanceM)} m` : null;
  const fuente = item.source?.trim();
  const pie = metros && fuente && !item.label.includes(fuente) ? `${metros} · ${fuente}` : metros ?? fuente ?? "";
  if (item.motivo && pie) return `${item.motivo} · ${pie}`;
  return item.motivo || pie;
}

function tonoDe(item: EnvironmentItem): TonoChip {
  if (item.sense === "positive") return "good";
  if (item.sense === "negative") return "bad";
  if (item.sense === "both") return "warn";
  return "info";
}

function filaEntorno(item: EnvironmentItem, conPuntos: boolean): FilaEntornoPdf {
  const points = conPuntos && item.value != null && Number.isFinite(Number(item.value)) ? Math.round(Number(item.value)) : undefined;
  return { title: item.label, sub: subEntorno(item), points, tone: tonoDe(item) };
}

function palabraEntorno(score: number): string {
  if (score >= 80) return "muy bueno";
  if (score >= 60) return "bueno";
  if (score >= 40) return "normal";
  return "flojo";
}

function portalDe(portal: string): string {
  return PORTAL[portal.toLowerCase()] ?? portal;
}

function ajusteTexto(key: string, factor: number): { text: string; up: boolean } | null {
  const pct = Math.round((factor - 1) * 100);
  if (pct === 0) return null;
  const nombre =
    key === "size" ? "tamaño" : key === "floor" ? "planta" : key === "side" ? "exterior/interior" : key === "condition" ? "estado" : key === "garage" ? "garaje" : key === "terrace" ? "terraza" : key === "renovated" ? "reforma" : key;
  const signo = pct > 0 ? "+" : "−";
  return { text: `${signo}${Math.abs(pct)} % ${nombre}`, up: pct > 0 };
}

function descuentoCierre(result: ValuationResult): number {
  const linea = result.explanation.find((l) => l.includes("Descuento oferta"));
  const m = linea?.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (m) return Number(m[1].replace(",", ".")) / 100;
  return 0.08;
}

function penalizaciones(result: ValuationResult): { points: string; text: string }[] {
  const linea = result.explanation.find((l) => l.startsWith("Confianza "));
  if (!linea) return [];
  const cuerpo = linea.replace(/^Confianza \d+ %:\s*/, "").replace(/\.\s*$/, "");
  return cuerpo
    .split(";")
    .map((parte) => parte.trim())
    .map((parte) => {
      const m = /^(.+?)\s*\([−-](\d+)\)\s*$/.exec(parte);
      if (!m) return null;
      return { points: `−${m[2]}`, text: etiquetaPenalizacion(m[1].trim()).replaceAll("→", "–") };
    })
    .filter((p): p is { points: string; text: string } => Boolean(p));
}

function explicacionLegible(result: ValuationResult): string[] {
  return result.explanation.map((linea) => {
    if (!linea.startsWith("Confianza ")) return humanizarExplicacion(linea);
    const n = linea.match(/^Confianza (\d+)/)?.[1] ?? String(result.confidence);
    const partes = penalizaciones(result).map((p) => `${p.text} (${p.points})`);
    return partes.length ? `Confianza ${n} %: ${partes.join("; ")}.` : humanizarExplicacion(linea);
  });
}

function notaZona(ppm2: number | null, mediana: number | null): string {
  if (ppm2 == null || mediana == null) return "";
  const sitio = ppm2 < mediana * 0.98 ? "por debajo de" : ppm2 > mediana * 1.02 ? "por encima de" : "en línea con";
  return `Tu vivienda: ${fmtNumero(Math.round(ppm2))} €/m², ${sitio} la mediana de oferta de la zona.`;
}

function origen(result: ValuationResult): string {
  const propiedad = result.sourcesUsed.find((s) => s.layer === "property");
  const geo = result.sourcesUsed.find((s) => s.layer === "geocoding");
  if (propiedad?.source?.startsWith("catastro") || geo?.source === "catastro") return "Dirección → Catastro";
  if (propiedad?.source === "listing" || geo?.source === "listing") return "Anuncio";
  if (propiedad?.source === "manual") return "Formulario";
  return etiquetaMotorFuente(geo?.source ?? propiedad?.source ?? "missing");
}

function tonoFuente(status: string): TonoChip {
  if (status === "degraded") return "warn";
  if (status === "missing") return "bad";
  return "good";
}

export function modeloInformePdf(input: {
  variant: PdfVariant;
  theme: PdfThemeName;
  marca: MarcaPdf;
  valuationId: string;
  createdAt: string;
  result: ValuationResult;
  twin: Twin;
  fieldSources?: Record<string, string>;
  layers?: CapaCargada[];
  channel?: string;
}): InformePdfModel {
  const { result, twin } = input;
  const sources = input.fieldSources ?? {};
  const surface = twin.builtSurface;
  const tipo = etiquetaTipoInmueble(twin);
  const localidad = [twin.address.postcode, twin.address.locality].filter(Boolean).join(" ");
  const ref = twin.address.catastralRef;
  const ppm2 = result.pricePerM2;
  const zona = result.zoneStats;
  const d = descuentoCierre(result);
  const offer = Math.round(result.valueMid / (1 - d) / 1000) * 1000;
  const pct = Math.round(d * 100);
  const rango =
    result.rangeMethod === "iqr_shrunk"
      ? "P25–P75 amortiguado"
      : result.rangeMethod
        ? ETIQUETA_RANGE_METHOD[result.rangeMethod]
        : "rango de la estimación";

  const lo = zona?.p25Ppm2 != null && zona.p75Ppm2 != null ? zona.p25Ppm2 * 0.9 : null;
  const hi = zona?.p25Ppm2 != null && zona.p75Ppm2 != null ? zona.p75Ppm2 * 1.1 : null;
  const zoneBar =
    zona && ppm2 != null && lo != null && hi != null && hi > lo
      ? {
          leftPct: Math.min(96, Math.max(4, ((ppm2 - lo) / (hi - lo)) * 100)),
          p25: `${fmtNumero(Math.round(zona.p25Ppm2 ?? 0))} €/m²`,
          median: `${fmtNumero(Math.round(zona.medianPpm2))} €/m²`,
          p75: `${fmtNumero(Math.round(zona.p75Ppm2 ?? 0))} €/m²`,
          note: notaZona(ppm2, zona.medianPpm2),
        }
      : null;

  const ficha: FilaFicha[] = [
    { label: "Tipo", value: tipo, catastro: catastro(sources, "propertyType") || catastro(sources, "mainType") },
    { label: "Superficie construida", value: surface != null ? `${fmtNumero(surface)} m²` : "sin dato", catastro: catastro(sources, "builtSurface") },
    { label: "Planta", value: planta(twin), catastro: catastro(sources, "floorOfFlat") },
    { label: "Año de construcción", value: twin.constructionYear != null ? String(twin.constructionYear) : "sin dato", catastro: catastro(sources, "constructionYear") },
    { label: "Orientación", value: lado(twin) },
    { label: "Ascensor", value: ascensor(twin) },
    { label: "Estado", value: estado(twin) },
    { label: "Distribución", value: distribucion(twin) },
    { label: "Garaje", value: garaje(twin) },
    { label: "Extras", value: extras(twin) },
  ];

  const mercadoBase: FilaFicha[] = zona
    ? [
        { label: "Zona", value: zona.label },
        { label: "Viviendas en venta", value: fmtNumero(zona.n) },
        { label: "Precio mediano de oferta", value: `${fmtNumero(Math.round(zona.medianPpm2))} €/m²` },
        {
          label: "Rango habitual (P25–P75)",
          value:
            zona.p25Ppm2 != null && zona.p75Ppm2 != null
              ? `${fmtNumero(Math.round(zona.p25Ppm2))} – ${fmtNumero(Math.round(zona.p75Ppm2))} €/m²`
              : "sin dato",
        },
      ]
    : [{ label: "Zona", value: "sin dato de mercado" }];

  const cierre = result.sourcesUsed.find((s) => s.layer === "close_series");
  const mercadoInterno: FilaFicha[] = zona
    ? [
        { label: "Nivel", value: zona.label },
        { label: "Anuncios activos", value: fmtNumero(zona.n) },
        { label: "Oferta · mediana", value: `${fmtNumero(Math.round(zona.medianPpm2))} €/m²` },
        {
          label: "P25 – P75",
          value:
            zona.p25Ppm2 != null && zona.p75Ppm2 != null
              ? `${fmtNumero(Math.round(zona.p25Ppm2))} – ${fmtNumero(Math.round(zona.p75Ppm2))} €/m²`
              : "sin dato",
        },
        { label: "Cierre", value: cierre?.source === "default_8pct" ? "pendiente de cierres propios" : etiquetaMotorFuente(cierre?.source ?? "missing") },
        {
          label: "Tendencia 12 meses",
          value: zona.trend12mPct == null ? "sin histórico" : fmtPorcentaje(zona.trend12mPct),
        },
      ]
    : mercadoBase;

  const env = result.environment;
  const positivos = (env?.positives ?? []).map((item) => filaEntorno(item, input.variant === "interno"));
  const negativos = (env?.negatives ?? []).map((item) => filaEntorno(item, input.variant === "interno"));
  const flags = env?.flags ?? [];
  const avisos = (input.variant === "propietario" ? flags.filter((f) => !esMarcaEquipo(f)) : flags).map((item) =>
    filaEntorno(item, false),
  );

  const comparables: ComparablePdf[] = result.comparables.map((c) => ({
    zone: c.title?.trim() || "Vivienda cercana",
    portal: portalDe(c.portal),
    price: c.price,
    m2: Math.round(c.surface),
    ppm2: Math.round(c.pricePerM2),
    adjustments: Object.entries(c.adjustments)
      .map(([k, v]) => ajusteTexto(k, v))
      .filter((a): a is { text: string; up: boolean } => Boolean(a)),
    adjustedPpm2: Math.round(c.adjustedPpm2),
    distanceM: Math.round(c.distanceM),
    weight: c.weight,
  }));

  const calle = [twin.address.route, twin.address.streetNumber].filter(Boolean).join(" ");
  const fecha = new Date(input.createdAt);

  return {
    variant: input.variant,
    theme: input.theme,
    marca: input.marca,
    titulo: input.variant === "propietario" ? "Informe de valoración" : "Informe interno de valoración",
    idCorto: input.valuationId.slice(0, 8),
    idCompleto: input.valuationId,
    fecha: fmtFechaLarga(fecha),
    fechaIso: fecha.toISOString(),
    methodVersion: result.methodVersion,
    address: twin.address.formattedAddress?.split(",")[0]?.trim() || calle || "Vivienda",
    localidad,
    tipo,
    surface,
    catastralRef: ref,
    valueMid: result.valueMid,
    valueLow: result.valueLow,
    valueHigh: result.valueHigh,
    pricePerM2: ppm2,
    zoneMedian: zona?.medianPpm2 ?? null,
    rentMonthly: result.rentMonthly,
    rentMethod: etiquetaMetodoAlquiler(result.methodVersion, result.rentSource),
    grossYield: result.grossYield,
    comparablesCount: result.comparables.length,
    confidenceLabel: etiquetaConfianzaCorta(result.confidence).toLowerCase(),
    confidence: result.confidence,
    precision: result.precisionScore,
    offerPrice: offer,
    offerNote: `cierre + ${pct} % de margen de negociación`,
    rangeNote: rango,
    ficha,
    mercadoOwner: mercadoBase,
    mercadoInterno,
    zoneBar,
    sources: result.sourcesUsed.map((s) => ({
      label: chipFuenteCapa(s, {
        zoneKey: zona?.zoneKey,
        comparablesCount: result.comparables.length,
      }),
      tone: tonoFuente(s.status),
    })),
    penalties: penalizaciones(result),
    comparables: input.variant === "interno" ? [...comparables].sort((a, b) => b.weight - a.weight) : comparables,
    positivos,
    negativos,
    avisos,
    envScore: env?.score ?? null,
    envWord: env?.score != null ? palabraEntorno(env.score) : null,
    layers: (input.layers ?? []).map((capa) => ({
      name: `${fmtCapaEntorno(capa.layer)}${capa.source ? ` · ${capa.source}` : ""}`,
      date: capa.loaded_at ? fmtFechaCorta(capa.loaded_at) : "sin fecha",
    })),
    explanation: explicacionLegible(result),
    meta: [
      { label: "Id", value: input.valuationId },
      { label: "Método", value: result.methodVersion, mono: true },
      { label: "Fecha", value: fmtFechaLarga(fecha) },
      { label: "Comercial", value: input.marca.agentName },
      { label: "Canal", value: ETIQUETA_CANAL[(input.channel as "crm") ?? "crm"] ?? "CRM" },
      { label: "Origen del inmueble", value: origen(result) },
    ],
    bullets: COMO_LO_HEMOS_CALCULADO.map((linea) => linea.replace("{m2}", surface != null ? fmtNumero(surface) : "sus")),
  };
}

export function eurosPdf(n: number): string {
  return fmtEuros(n);
}
