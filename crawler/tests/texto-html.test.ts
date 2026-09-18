import { describe, expect, it } from "vitest";
import { decodificarEntidadesHtml, normalizarTexto } from "../../lib/captacion/pipeline/normalize.js";

describe("decodificarEntidadesHtml", () => {
  it("decodifica hex, decimal y nombradas", () => {
    expect(decodificarEntidadesHtml("Piso en Nar&#xF3;n")).toBe("Piso en Narón");
    expect(decodificarEntidadesHtml("A Coru&#xF1;a")).toBe("A Coruña");
    expect(decodificarEntidadesHtml("Pla&#xE7;a")).toBe("Plaça");
    expect(decodificarEntidadesHtml("Carrer d&#x27;Emp&#xFA;ries")).toBe("Carrer d'Empúries");
    expect(decodificarEntidadesHtml("115 m&#xB2;")).toBe("115 m²");
    expect(decodificarEntidadesHtml("1&#xAA; planta")).toBe("1ª planta");
    expect(decodificarEntidadesHtml("Tom &amp; Jerry")).toBe("Tom & Jerry");
  });

  it("normalizarTexto recorta espacios", () => {
    expect(normalizarTexto("  Piso en Nar&#xF3;n  ")).toBe("Piso en Narón");
  });
});
