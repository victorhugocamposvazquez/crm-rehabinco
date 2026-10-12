import { describe, expect, it } from "vitest";
import { fotocasaTieneMas } from "../market/fotocasa-cards";
import { pistaEstado, slugZona } from "../market/card";

describe("tarjetas de mercado", () => {
  it("sigue de página mientras no se haya visto el total", () => {
    expect(fotocasaTieneMas(542, 31, 31)).toBe(true);
    expect(fotocasaTieneMas(542, 542, 10)).toBe(false);
    expect(fotocasaTieneMas(10, 0, 0)).toBe(false);
  });

  it("normaliza la zona y la pista de estado sin datos personales", () => {
    expect(slugZona("Centro - Juan Flórez")).toBe("centro-juan-florez");
    expect(pistaEstado("Piso a reformar en Eirís")).toBe("reformar");
    expect(pistaEstado("Ático de obra nueva")).toBe("nuevo");
  });
});
