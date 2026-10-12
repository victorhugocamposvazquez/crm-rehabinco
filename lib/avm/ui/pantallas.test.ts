import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { ordenarUnidades } from "../twin-builder";
import { etiquetaUnidad } from "./unidades";
import { filasFicha } from "./ficha";
import { InformeValoracion } from "../../../components/avm/InformeValoracion";
import { emptyTwin, type Twin, type ValuationResult } from "../types";
import type { TwinUnit } from "../twin-builder";

function unidad(parcial: Partial<TwinUnit> & Pick<TwinUnit, "catastralRef" | "isDwelling">): TwinUnit {
  return { floor: null, door: null, surface: null, use: null, ...parcial };
}

describe("selector de unidad", () => {
  it("ordena por planta y puerta, con las viviendas antes que el resto", () => {
    const units = [
      unidad({ catastralRef: "B", floor: "01", door: "IZ", surface: 40, use: "Garaje", isDwelling: false }),
      unidad({ catastralRef: "A", floor: "03", door: "IZ", surface: 80, use: "Vivienda", isDwelling: true }),
      unidad({ catastralRef: "C", floor: "03", door: "DR", surface: 86, use: "Vivienda", isDwelling: true }),
      unidad({ catastralRef: "D", floor: "00", door: "DR", surface: 90, use: "Vivienda", isDwelling: true }),
    ];
    const orden = ordenarUnidades(units);
    expect(orden.map((u) => u.catastralRef)).toEqual(["D", "C", "A", "B"]);
    expect(orden.filter((u) => u.isDwelling).length).toBe(3);
    expect(etiquetaUnidad(orden[1])).toBe("Planta 3 · Dcha · 86 m²");
  });
});

describe("ficha", () => {
  it("marca Catastro en los campos que vienen de la Sede", () => {
    const twin: Twin = {
      ...emptyTwin(),
      mainType: "apartment",
      propertyType: "apartment",
      builtSurface: 86,
      constructionYear: 1967,
      floorOfFlat: 3,
      numberOfFloors: 11,
      address: { ...emptyTwin().address, catastralRef: "8018007NJ4081N0007LP", formattedAddress: "Rúa Juan Flórez 30" },
    };
    const filas = filasFicha(twin, { builtSurface: "catastro_sede", constructionYear: "catastro_sede", floorOfFlat: "catastro_sede", mainType: "catastro_sede" });
    expect(filas.find((f) => f.label === "Superficie")).toMatchObject({ value: "86 m²", catastro: true });
    expect(filas.find((f) => f.label === "Año y reforma")?.catastro).toBe(true);
    expect(filas.find((f) => f.label === "Referencia catastral")?.catastro).toBe(true);
    expect(filas.some((f) => f.label === "Dirección")).toBe(true);
  });
});

describe("informe", () => {
  it("pinta los cuatro tiles, las fuentes y los comparables", () => {
    const twin: Twin = {
      ...emptyTwin(),
      mainType: "apartment",
      builtSurface: 86,
      address: { ...emptyTwin().address, formattedAddress: "Rúa Juan Flórez 30", postcode: "15004", lat: 43.36, lng: -8.4 },
    };
    const result: ValuationResult = {
      methodVersion: "comparables-1.1",
      operation: "sale",
      valueMid: 318211,
      valueLow: 290000,
      valueHigh: 360000,
      pricePerM2: 4022,
      rentMonthly: 1030,
      rentSource: "comparables",
      rangeMethod: "iqr_shrunk",
      grossYield: 3.88,
      confidence: 76,
      precisionScore: 61,
      sourcesUsed: [
        { layer: "property", source: "catastro_sede", status: "primary" },
        { layer: "comparables", source: "avm_comparables/300m", status: "primary" },
      ],
      comparables: [{
        listingId: "1", portal: "fotocasa", title: "Piso", price: 270000, surface: 70, pricePerM2: 3857,
        rooms: 3, floor: 2, hasElevator: true, hasGarage: false, hasTerrace: null, isExterior: true,
        conditionHint: null, lastSeen: "2026-10-01", distanceM: 113, radiusM: 300,
        adjustments: { size: 1.04 }, adjustedPpm2: 3763, weight: 0.71,
      }],
      zoneStats: { zoneLevel: "postcode", zoneKey: "15004", label: "A Coruña · CP 15004", month: "2026-10-01", n: 42, medianPpm2: 4409, p25Ppm2: 3588, p75Ppm2: 5121, trend12mPct: null, source: "market_listings" },
      environment: null,
      explanation: ["Rango de prueba"],
    };
    const html = renderToStaticMarkup(createElement(InformeValoracion, { creada: "12 de octubre de 2026", result, twin, fieldSources: { builtSurface: "catastro_sede" } }));
    expect(html).toContain("Valor de cierre");
    expect(html).toContain("€/m² ajustado");
    expect(html).toContain("Confianza");
    expect(html).toContain("Alquiler");
    expect(html).toContain("Catastro, Sede en vivo");
    expect(html).not.toContain("catastro_sede");
    expect(html).toContain("270.000");
    expect(html).toContain("Ficha del inmueble");
    expect(html).toContain("Comparables · 1");
    expect(html).not.toContain("data-testid=\"entorno\"");
  });
});
