import { describe, expect, it } from "vitest";
import { cartoViaCatalogoCompleto, siglaViaCartoCiudad } from "../carto-via-catastro";

describe("CartoCiudad → sigla Catastro", () => {
  it("mapea lenguas cooficiales", () => {
    expect(siglaViaCartoCiudad("CARRER")).toBe("CL");
    expect(siglaViaCartoCiudad("AVINGUDA")).toBe("AV");
    expect(siglaViaCartoCiudad("ETORBIDEA")).toBe("AV");
    expect(siglaViaCartoCiudad("PLAÇA")).toBe("PZ");
    expect(siglaViaCartoCiudad("ENPARANTZA")).toBe("PZ");
    expect(siglaViaCartoCiudad("PASSEIG")).toBe("PS");
    expect(siglaViaCartoCiudad("TRAVESSERA")).toBe("TR");
    expect(siglaViaCartoCiudad("CAMÍ")).toBe("CM");
    expect(siglaViaCartoCiudad("PASSATGE")).toBe("PJ");
    expect(siglaViaCartoCiudad("AUZOA")).toBe("BO");
    expect(siglaViaCartoCiudad("PARTIDA")).toBe("PD");
    expect(siglaViaCartoCiudad("DISEMINADO")).toBe("DS");
    expect(siglaViaCartoCiudad("CUESTA")).toBe("CT");
    expect(siglaViaCartoCiudad("RUA")).toBe("RU");
    expect(siglaViaCartoCiudad("Rúa")).toBe("RU");
  });

  it("no deja etiquetas del catálogo sin sigla oficial", () => {
    expect(cartoViaCatalogoCompleto()).toEqual([]);
  });
});
