import { describe, expect, it } from "vitest";
import { armarViaCatastro, provinciaNombreCatastro } from "./carto-catastro";
import { parseCartoRow } from "./geocoder-carto";

describe("carto → Catastro DNPLOC", () => {
  it("parseCartoRow extrae tip_via, portal y calle MONSERRAT", () => {
    const c = parseCartoRow({
      address: "AVENIDA MONSERRAT 12",
      lat: 43.336,
      lng: -8.408,
      postalCode: "15009",
      muni: "A Coruña",
      tip_via: "AVENIDA",
      portalNumber: 12,
      muniCode: "15030",
    });
    expect(c?.streetType).toBe("AVENIDA");
    expect(c?.streetNumber).toBe("12");
    expect(c?.streetName).toBe("MONSERRAT");
    expect(c?.muniCode).toBe("15030");
  });

  it("genera Consulta_DNPLOC A CORUÑA / AV / MONSERRAT / 12", () => {
    const via = armarViaCatastro(
      {
        address: "AVENIDA MONSERRAT 12",
        lat: 43.336,
        lng: -8.408,
        postcode: "15009",
        municipality: "A Coruña",
        province: "15",
        streetType: "AVENIDA",
        streetName: "MONSERRAT",
        streetNumber: "12",
        muniCode: "15030",
      },
      { provincia: "A CORUÑA", municipio: "A CORUÑA" },
    );
    expect(via).toEqual({
      provincia: "A CORUÑA",
      municipio: "A CORUÑA",
      sigla: "AV",
      calle: "MONSERRAT",
      numero: "12",
    });
  });

  it("provincia por código INE municipio", () => {
    expect(provinciaNombreCatastro("15", "15009", "15030")).toBe("A CORUÑA");
    expect(provinciaNombreCatastro(null, null, "48020")).toBe("BIZKAIA");
  });
});
