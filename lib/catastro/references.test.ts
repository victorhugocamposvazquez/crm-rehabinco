import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  esReferenciaFinca,
  esReferenciaInmueble,
  getFincaReference,
  getPropertyReference,
  normalizarReferencia,
} from "./references";

describe("validación de referencias catastrales", () => {
  it("1. RC de 14 caracteres", () => {
    assert.equal(esReferenciaFinca("2749704YJ0624N"), true);
    assert.equal(esReferenciaFinca("0751301VK4705B"), true);
    assert.equal(getFincaReference("2749704YJ0624N"), "2749704YJ0624N");
    assert.equal(getFincaReference(" 2749704yj0624n "), "2749704YJ0624N");
    assert.equal(esReferenciaFinca("2749704YJ0624"), false);
    assert.equal(esReferenciaFinca("2749704YJ0624N0001DI"), false);
    assert.equal(getFincaReference("ABC"), null);
    assert.equal(getFincaReference("2749704YJ0624N0"), null);
  });

  it("2. RC de 20 caracteres", () => {
    assert.equal(esReferenciaInmueble("2749704YJ0624N0001DI"), true);
    assert.equal(esReferenciaInmueble("0751301VK4705B0002OI"), true);
    assert.equal(getPropertyReference("2749704YJ0624N0001DI"), "2749704YJ0624N0001DI");
    assert.equal(getFincaReference("2749704YJ0624N0001DI"), "2749704YJ0624N");
    assert.equal(esReferenciaInmueble("2749704YJ0624N"), false);
    assert.equal(esReferenciaInmueble("2749704YJ0624N0001D"), false);
    assert.equal(getPropertyReference("2749704YJ0624N"), null);
  });

  it("normaliza espacios y no inventa identidad", () => {
    assert.equal(normalizarReferencia("0751301 vk4705b 0002 oi"), "0751301VK4705B0002OI");
    assert.equal(getFincaReference(null), null);
    assert.equal(getFincaReference(""), null);
    assert.equal(getFincaReference("123456789012345"), null);
  });
});
