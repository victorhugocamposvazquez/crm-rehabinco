import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calcularScore } from "./score";

const pesosVacios = {};

describe("calcularScore", () => {
  it("portal profesional dispara score alto", () => {
    const r = calcularScore({
      anuncios: [{ anunciante: "empresa", operacion: "venta", tipo: "piso", municipio: "A", portal_id: "habitaclia" }],
      pesos: pesosVacios,
    });
    assert.ok(r.score >= 60);
    assert.equal(r.nivel, "amarillo");
  });

  it("particular con un anuncio queda en ninguno", () => {
    const r = calcularScore({
      anuncios: [
        {
          anunciante: "particular",
          operacion: "venta",
          tipo: "piso",
          municipio: "Cambre",
          portal_id: "habitaclia",
          descripcion: "Mi casa en venta",
        },
      ],
      pesos: pesosVacios,
    });
    assert.equal(r.nivel, "ninguno");
  });
});
