import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  descuentoCierre,
  descuentosDe,
  elegirDescuento,
  filaDesdeEstadistica,
  filasDesdeFichero,
  textoCierre,
} from "../notariado";

const fixture = JSON.parse(readFileSync(path.join(__dirname, "fixtures/notariado.json"), "utf8"));

describe("fichero notarial", () => {
  const filas = filasDesdeFichero(fixture, "2026-11-01");

  it("se queda con municipio y código postal que tienen muestra", () => {
    expect(filas.map((f) => `${f.zoneLevel}:${f.zoneKey}:${f.mainType}`)).toEqual([
      "municipality:15030:apartment",
      "postcode:15004:apartment",
    ]);
    expect(filas[0]?.period).toBe("2026-10-01");
    expect(filas[0]?.surface).toBe(86);
  });

  it("descarta muestra corta, valor estimado y fila sin precio", () => {
    expect(filas.some((f) => f.zoneKey === "15901" || f.mainType === "house" || f.zoneKey === "15031")).toBe(false);
  });
});

describe("descuento de cierre", () => {
  it("acota entre 0 y 25", () => {
    expect(descuentoCierre(2200, 2500, 40)).toBe(12);
    expect(descuentoCierre(3000, 2500, 40)).toBe(0);
    expect(descuentoCierre(1000, 2500, 40)).toBe(25);
  });

  it("rechaza menos de 30 anuncios de oferta", () => {
    expect(descuentoCierre(2200, 2500, 29)).toBeNull();
  });

  it("prefiere el código postal al municipio", () => {
    expect(elegirDescuento({ postcode: 6, municipality: 12 })).toBe(6);
    expect(elegirDescuento({ postcode: null, municipality: 12 })).toBe(12);
    expect(elegirDescuento({ postcode: null, municipality: null })).toBeNull();
  });

  it("solo escribe descuento donde hay oferta y cierre válidos", () => {
    const cierres = filasDesdeFichero(fixture, "2026-11-01");
    const descuentos = descuentosDe(cierres, [
      { zoneLevel: "municipality", zoneKey: "15030", mainType: "apartment", n: 40, medianPpm2: 2800 },
      { zoneLevel: "postcode", zoneKey: "15004", mainType: "apartment", n: 10, medianPpm2: 3000 },
    ]);
    expect(descuentos).toEqual([
      {
        zoneLevel: "municipality",
        zoneKey: "15030",
        mainType: "apartment",
        discountPct: 12.5,
        nObservations: 80,
      },
    ]);
  });
});

describe("respuesta del portal", () => {
  it("lee el €/m² y descarta el estimado", () => {
    const ok = filaDesdeEstadistica({
      zoneLevel: "municipality",
      zoneKey: "15030",
      mainType: "apartment",
      period: "2026-11-01",
      body: { data: { statistics: { currentPricePerSqm: 2450, currentNumberOfSales: 80, currentAverageAreaSqm: 86, lastDataUpdate: "2026-10-20" } } },
    });
    expect(ok).toMatchObject({ ppm2: 2450, transactions: 80, period: "2026-10-01", surface: 86 });
    const estimado = filaDesdeEstadistica({
      zoneLevel: "municipality",
      zoneKey: "15030",
      mainType: "apartment",
      period: "2026-11-01",
      body: { data: { statistics: { currentPricePerSqm: 2450, currentNumberOfSales: 80, es_estimado: 1 } } },
    });
    expect(estimado).toBeNull();
  });
});

describe("texto del informe", () => {
  it("distingue el cierre notarial del 8 % de respaldo", () => {
    expect(
      textoCierre(
        [{ layer: "close_series", source: "market_discount" }],
        ["Descuento oferta → cierre 12,5 % (calibrado en la zona)."],
      ),
    ).toEqual({ valor: "12,5 %", pie: "cierre notarial de la zona" });
    expect(textoCierre([], ["Descuento oferta → cierre 8 % (valor por defecto)."])).toEqual({
      valor: "8 %",
      pie: "8 % de respaldo, sin cierre notarial",
    });
  });
});
