import { inflateSync } from "node:zlib";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import { describe, expect, it } from "vitest";
import { emptyTwin, type EnvironmentItem, type ValuationResult } from "../../types";
import { AVISO_LEGAL_PDF } from "../model";
import { renderInformePdf } from "../render";
import type { MarcaPdf, PdfThemeName, PdfVariant } from "../model";

const ID = "b0d05e9a-fb54-4688-8dce-84490224d98f";
const CREADA = "2026-10-12T21:21:14.124Z";

const marca: MarcaPdf = {
  name: "REHABINCO, S.L.",
  phone: "664 85 93 06",
  email: "info@rehabinco.es",
  web: "www.rehabinco.com",
  color: "#ffffff",
  pdfTheme: "dark",
  logoLight: readFileSync(path.join(process.cwd(), "public/images/logo-web.png")),
  logoDark: readFileSync(path.join(process.cwd(), "public/images/facturas/rehabinco-blanco.png")),
  agentName: "Comercial de la agencia",
  agentPhone: "664 85 93 06",
};

function item(partial: Partial<EnvironmentItem> & Pick<EnvironmentItem, "label" | "sense" | "source">): EnvironmentItem {
  return { indicator: "osm_poi:shop", distanceM: 100, ...partial };
}

const result: ValuationResult = {
  methodVersion: "comparables-1.1",
  operation: "sale",
  valueMid: 334673,
  valueLow: 306250,
  valueHigh: 376199,
  pricePerM2: 4229.94,
  rentMonthly: 1150,
  rentSource: "comparables",
  rangeMethod: "iqr_shrunk",
  grossYield: 4.12,
  confidence: 83,
  precisionScore: 61,
  sourcesUsed: [
    { layer: "geocoding", source: "catastro", status: "primary" },
    { layer: "property", source: "catastro_sede", status: "primary" },
    { layer: "market", source: "market_listings/postcode", status: "primary" },
    { layer: "close_series", source: "default_8pct", status: "degraded" },
    { layer: "comparables", source: "avm_comparables/300m", status: "primary" },
    { layer: "rent", source: "avm_comparables/rent", status: "primary" },
    { layer: "environment", source: "environment_layers", status: "primary" },
  ],
  comparables: [
    comp("San Pablo - Juan Flórez", "fotocasa", 380000, 100, 3800, 298, 0.5903, 3760, { size: 1.018, floor: 0.972 }),
    comp("San Pablo - Juan Flórez", "fotocasa", 270000, 70, 3857, 113, 0.7107, 3763, { size: 0.976 }),
    comp("San Pablo - Juan Flórez", "fotocasa", 420000, 109, 3853, 127, 0.6293, 3852, { size: 1.029, floor: 0.972 }),
    comp("Centro - Juan Flórez - Plaza Pontevedra", "habitaclia", 360000, 90, 4000, 236, 0.7222, 4022, { size: 1.005 }),
    comp("San Pablo - Juan Flórez", "fotocasa", 450000, 106, 4245, 198, 0.6074, 4230, { size: 1.025, floor: 0.972 }),
    comp("San Pablo - Juan Flórez", "fotocasa", 460000, 95, 4842, 254, 0.6642, 4762, { size: 1.012, floor: 0.972 }),
    comp("San Pablo - Juan Flórez", "fotocasa", 345000, 66, 5227, 268, 0.5602, 4921, { size: 0.969, floor: 0.972 }),
    comp("Piso en calle Sinfónica de Galicia", "pisos", 425000, 83, 5120, 152, 0.8055, 4954, { size: 0.996, floor: 0.972 }),
    comp("Ensanche", "fotocasa", 630000, 111, 5676, 214, 0.5511, 5315, { size: 1.031, floor: 0.972, garage: 0.935 }),
  ],
  zoneStats: {
    zoneLevel: "postcode",
    zoneKey: "15004",
    label: "A Coruña · CP 15004",
    month: "2026-10-01",
    n: 42,
    medianPpm2: 4409.92,
    p25Ppm2: 3587.86,
    p75Ppm2: 5121.34,
    trend12mPct: null,
    source: "market_listings",
  },
  environment: {
    score: 69,
    positives: [
      item({ indicator: "gtfs_stop:bus", label: "Parada de bus Juan Flórez", value: 6, distanceM: 90, sense: "positive", source: "GTFS Compañía de Tranvías" }),
      item({ indicator: "health:health_center", label: "Centro de salud", value: 5, distanceM: 500, sense: "positive", source: "Catálogo SERGAS" }),
    ],
    negatives: [
      item({ indicator: "noise:lden", label: "Ruido de tráfico: 68 dB Lden", value: -6, distanceM: 10, sense: "negative", source: "Mapa estratégico de ruido" }),
    ],
    flags: [
      item({ indicator: "zone_mark:obra", label: "Obras de peatonalización en Juan Flórez", sense: "info", source: "Conocimiento local", distanceM: undefined }),
      item({ indicator: "flood:fuera", label: "Sin zona inundable (T10, T100, T500)", sense: "info", source: "SNCZI (MITECO)", distanceM: undefined }),
    ],
  },
  explanation: [
    "9 comparables en 300 m; 9 tras recortar colas (10 % por lado).",
    "€/m² ajustado: mediana 4230, P25 3852, P75 4921.",
    "Superficie 86 m² × 4230 €/m² = 363.775 € de oferta.",
    "Descuento oferta → cierre 8 % (valor por defecto).",
    "Rango: P25–P75 de los comparables (−9 % / +16 %) amortiguado hacia ±8 % por tener 9 comparables → −8 % / +12 %",
    "Mediana de zona (A Coruña · CP 15004): 4409.92 €/m², 42 anuncios.",
    "Alquiler: mediana de 10 comparables de alquiler a ≤ 1.500 m × 86 m² ≈ 1150 €/mes.",
    "Confianza 83 %: close_series: degraded (default_8pct) (−5); pocos comparables (9 de 12) (−6); dispersión de comparables 13 % (−3); sin histórico de 12 meses en la zona (−3).",
  ],
};

function comp(
  title: string,
  portal: string,
  price: number,
  surface: number,
  pricePerM2: number,
  distanceM: number,
  weight: number,
  adjustedPpm2: number,
  adjustments: Record<string, number>,
): ValuationResult["comparables"][number] {
  return {
    listingId: title,
    portal,
    title,
    price,
    surface,
    pricePerM2,
    rooms: null,
    floor: null,
    hasElevator: null,
    hasGarage: null,
    hasTerrace: null,
    isExterior: null,
    conditionHint: null,
    lastSeen: "2026-10-01",
    distanceM,
    radiusM: 300,
    adjustments,
    adjustedPpm2,
    weight,
  };
}

const twin = emptyTwin();
twin.address = {
  ...twin.address,
  formattedAddress: "Rúa Juan Flórez 30, 15004 A Coruña",
  route: "Juan Flórez",
  streetNumber: "30",
  postcode: "15004",
  locality: "A Coruña",
  catastralRef: "8018007NJ4081N0007LP",
  lat: 43.3654936860636,
  lng: -8.40853332196536,
  municipalityCode: "15030",
  censusSection: "1503003003",
};
twin.mainType = "apartment";
twin.propertyType = "apartment";
twin.builtSurface = 86;
twin.floorOfFlat = 3;
twin.numberOfFloors = 11;
twin.constructionYear = 1967;

async function paginas(buffer: Buffer): Promise<string[]> {
  const doc = await getDocumentProxy(new Uint8Array(buffer));
  const extraido = await extractText(doc, { mergePages: false });
  const text = extraido.text;
  return Array.isArray(text) ? text : [String(text)];
}

const FONDO = "0.0392156862745098 0.0392156862745098 0.043137254901960784 scn";

function fondoOscuroEnTodas(buffer: Buffer, paginasEsperadas: number): boolean {
  const raw = buffer.toString("latin1");
  const streams = raw.match(/stream\r?\n[\s\S]*?\nendstream/g) ?? [];
  let texto = "";
  for (const stream of streams) {
    const body = stream.replace(/^stream\r?\n/, "").replace(/\nendstream$/, "");
    try {
      texto += inflateSync(Buffer.from(body, "latin1")).toString("latin1");
    } catch {
      texto += body;
    }
  }
  const veces = texto.split(FONDO).length - 1;
  return veces >= paginasEsperadas;
}

describe("informe PDF de Juan Flórez 30", () => {
  const casos: { variant: PdfVariant; theme: PdfThemeName; pages: number }[] = [
    { variant: "propietario", theme: "dark", pages: 2 },
    { variant: "interno", theme: "dark", pages: 3 },
    { variant: "propietario", theme: "light", pages: 2 },
    { variant: "interno", theme: "light", pages: 3 },
  ];

  it("genera las dos variantes en los dos temas", async () => {
    const dir = path.join(process.cwd(), "tmp/informes-juan-florez");
    mkdirSync(dir, { recursive: true });
    for (const caso of casos) {
      const t0 = Date.now();
      const { buffer } = await renderInformePdf({
        variant: caso.variant,
        theme: caso.theme,
        marca,
        valuationId: ID,
        createdAt: CREADA,
        result,
        twin,
        fieldSources: { builtSurface: "catastro_sede", floorOfFlat: "catastro_sede", constructionYear: "catastro_sede", propertyType: "catastro_sede" },
        layers: [{ layer: "osm_poi", source: "OpenStreetMap", n: 42, loaded_at: "2026-10-01T00:00:00Z" }],
        channel: "crm",
      });
      expect(Date.now() - t0).toBeLessThan(4000);
      const hojas = await paginas(buffer);
      expect(hojas).toHaveLength(caso.pages);
      for (const hoja of hojas) expect(hoja).toContain("Orden ECO/805/2003");
      const todo = hojas.join("\n");
      expect(todo).not.toMatch(/iqr_shrunk|catastro_sede/);
      if (caso.variant === "propietario") {
        expect(todo.toLowerCase()).not.toMatch(/confianza|peso|ajuste/);
        expect(todo).not.toContain("Obras de peatonalización");
      }
      const nombre = `${caso.variant}-${caso.theme}.pdf`;
      writeFileSync(path.join(dir, nombre), buffer);
      if (caso.theme === "dark") expect(fondoOscuroEnTodas(buffer, caso.pages)).toBe(true);
    }
    expect(AVISO_LEGAL_PDF).toContain("Orden ECO/805/2003");
  }, 20000);
});
