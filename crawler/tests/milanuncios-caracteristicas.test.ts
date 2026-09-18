import { describe, expect, it } from "vitest";
import {
  caracteristicasDesdeAttributes,
  caracteristicasDesdeTags,
} from "../src/adapters/milanuncios/caracteristicas.js";

describe("milanuncios características", () => {
  it("parsea tags de listado", () => {
    expect(
      caracteristicasDesdeTags([
        { type: "dormitorios", text: "3" },
        { type: "baños", text: "2" },
        { type: "metros cuadrados", text: "113 m²" },
      ])
    ).toEqual({ habitaciones: 3, banos: 2, superficie: 113 });
  });

  it("parsea attributes de detalle", () => {
    expect(
      caracteristicasDesdeAttributes([
        { type: "bedrooms", value: "3" },
        { type: "bathrooms", value: "1" },
        { type: "squareMeters", value: "75", valueFormatted: "75 m²" },
        { type: "floor", value: "floor_4", valueFormatted: "4º" },
      ])
    ).toEqual({ habitaciones: 3, banos: 1, superficie: 75, planta: "4º" });
  });
});
