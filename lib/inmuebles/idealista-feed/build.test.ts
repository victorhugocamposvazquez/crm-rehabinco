import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { construirFeedIdealista, type PropiedadFeed } from "./build";

const ILC = "ilcfbd35210b5ad7c3269a413cbe8e41ef5b0787fa5";

const PISO: PropiedadFeed = {
  id: "11111111-1111-1111-1111-111111111111",
  referencia: "RHB-TEST-1",
  idealista_codigo: null,
  titulo: "Piso en Oleiros",
  direccion: "Calle Ejemplo 12",
  codigo_postal: "15172",
  localidad: "Oleiros",
  tipo_operacion: "venta",
  precio_venta: 250000,
  precio_alquiler: null,
  superficie_m2: 90,
  superficie_construida: 90,
  superficie_parcela: null,
  habitaciones: 3,
  banos: 2,
  planta: "2",
  descripcion: "Descripción de prueba con más de cincuenta caracteres para Idealista y Rehabinco.",
  certificado_energetico: "E",
  tipo_inmueble: "piso",
  idealista_tipo: "piso",
  idealista_visibilidad_direccion: "exacta",
  ascensor: true,
  garaje: false,
  terraza: true,
  anio_construccion: 1998,
  tour_url: null,
  fotos: ["https://example.com/foto1.jpg"],
};

describe("construirFeedIdealista", () => {
  it("genera customer v6 con ILC y un anuncio de venta", () => {
    const { customer, enviados, omitidos } = construirFeedIdealista(ILC, [PISO]);
    assert.equal(omitidos.length, 0);
    assert.equal(enviados, 1);
    assert.equal(customer.customerCode, ILC);
    const props = customer.customerProperties as Record<string, unknown>[];
    assert.equal(props.length, 1);
    assert.equal((props[0]!.propertyOperation as { operationType: string }).operationType, "sale");
  });

  it("omite inmuebles con faltas", () => {
    const mal = { ...PISO, codigo_postal: "123", fotos: [] as string[] };
    const { enviados, omitidos } = construirFeedIdealista(ILC, [mal]);
    assert.equal(enviados, 0);
    assert.ok(omitidos.length === 1);
  });

  it("duplica anuncio venta y alquiler en ambos", () => {
    const ambos = { ...PISO, tipo_operacion: "ambos", precio_alquiler: 900 };
    const { enviados } = construirFeedIdealista(ILC, [ambos]);
    assert.equal(enviados, 2);
  });
});
