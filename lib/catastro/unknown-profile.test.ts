import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  casoUnknownDe,
  cuboLcons,
  cuboRc,
  grupoUsoDe,
  grupoUsoDeUno,
  recuentoGruposUso,
} from "./unknown-profile";

describe("perfil descriptivo de UNKNOWN aplicable", () => {
  it("no cambia el estado: solo agrupa usos oficiales observados", () => {
    assert.equal(grupoUsoDeUno("Residencial"), "residencial");
    assert.equal(grupoUsoDeUno("Industrial"), "industrial");
    assert.equal(grupoUsoDeUno("Almacen-Estacionamiento"), "almacen");
    assert.equal(grupoUsoDeUno("Comercial"), "comercial");
    assert.equal(grupoUsoDeUno("Obras de urbanización y jardineria, suelos sin edificar"), "otro");
    assert.equal(grupoUsoDeUno(null), "sin_uso");
    assert.equal(grupoUsoDe(["Residencial", "Industrial"]), "mixto");
    assert.equal(grupoUsoDe(["Residencial", null]), "residencial");
  });

  it("cubos de RC y lcons no infieren DH", () => {
    assert.equal(cuboRc(1), "1");
    assert.equal(cuboRc(3), "2-5");
    assert.equal(cuboRc(6), ">5");
    assert.equal(cuboLcons(0), "0");
    assert.equal(cuboLcons(1), "1");
    assert.equal(cuboLcons(4), ">1");
  });

  it("caso A/B/C es descriptivo: construida, ambiguo o sin datos", () => {
    assert.equal(
      casoUnknownDe({
        usos: ["Residencial"],
        superficie: 169,
        superficieSolar: null,
        anio: 1980,
        lcons: 1,
      }),
      "A_construida"
    );
    assert.equal(
      casoUnknownDe({
        usos: ["Deportivo"],
        superficie: 80,
        superficieSolar: null,
        anio: null,
        lcons: 1,
      }),
      "B_uso_ambiguo"
    );
    assert.equal(
      casoUnknownDe({
        usos: [null],
        superficie: null,
        superficieSolar: null,
        anio: null,
        lcons: 0,
      }),
      "C_datos_insuficientes"
    );
  });

  it("Agrario + Residencial es mixto; no se infiere DH", () => {
    assert.equal(grupoUsoDe(["Agrario", "Residencial"]), "mixto");
    assert.equal(grupoUsoDeUno("Agrario"), "otro");
  });

  it("el recuento no inventa categorías vacías extra", () => {
    assert.deepEqual(recuentoGruposUso(["residencial", "residencial", "almacen"]), {
      residencial: 2,
      industrial: 0,
      almacen: 1,
      comercial: 0,
      mixto: 0,
      otro: 0,
      sin_uso: 0,
    });
  });
});
