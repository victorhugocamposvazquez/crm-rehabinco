import { describe, expect, it } from "vitest";
import { avisoMunicipioSinRastreo } from "../market-loading";

describe("aviso de municipio sin rastreo", () => {
  it("avisa cuando no hay anuncios ni mediana y el municipio no se rastrea", () => {
    expect(avisoMunicipioSinRastreo(false, 0, false)).toMatch(/no entra en el rastreo/);
  });

  it("calla si el municipio se rastrea, hay comparables o hay mediana", () => {
    expect(avisoMunicipioSinRastreo(true, 0, false)).toBeNull();
    expect(avisoMunicipioSinRastreo(false, 3, false)).toBeNull();
    expect(avisoMunicipioSinRastreo(false, 0, true)).toBeNull();
  });
});
