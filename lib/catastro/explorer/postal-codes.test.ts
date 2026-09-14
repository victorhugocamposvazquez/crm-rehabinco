import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  codigoPostalDelMunicipio,
  codigosPostalesDeMunicipio,
  municipiosDeCodigoPostal,
} from "./postal-codes";
import { avisoCodigoPostalAjeno, nombreMunicipioVisible, textoAyudaCodigosMunicipio } from "./postal-codes-ui";

describe("Códigos postales por municipio", () => {
  it("Alcobendas solo tiene 28100, 28108 y 28109", () => {
    const alcobendas = codigosPostalesDeMunicipio("28", "ALCOBENDAS");
    assert.deepEqual(alcobendas?.codes, ["28100", "28108", "28109"]);
    assert.equal(codigoPostalDelMunicipio("28", "Alcobendas", "28100"), true);
    assert.equal(codigoPostalDelMunicipio("28", "Alcobendas", "28703"), false);
  });

  it("28703 es de San Sebastián de los Reyes, no de Alcobendas", () => {
    const dueños = municipiosDeCodigoPostal("28703");
    assert.equal(dueños.some((item) => /san sebasti[aá]n de los reyes/i.test(item.name)), true);
    assert.equal(
      avisoCodigoPostalAjeno({
        postalCode: "28703",
        municipality: "Alcobendas",
        codes: ["28100", "28108", "28109"],
        owners: dueños,
      }),
      "28703 no es de Alcobendas. Ese código es de San Sebastián de los Reyes."
    );
  });

  it("Godelleta y A Coruña resuelven el nombre oficial", () => {
    assert.deepEqual(codigosPostalesDeMunicipio("46", "GODELLETA")?.codes, ["46388"]);
    assert.ok(codigosPostalesDeMunicipio("15", "A CORUÑA")?.codes.includes("15009"));
    assert.equal(nombreMunicipioVisible("Coruña, A"), "A Coruña");
    assert.equal(textoAyudaCodigosMunicipio("Alcobendas", ["28100", "28108", "28109"]), "Elige un código postal de Alcobendas.");
  });
});
