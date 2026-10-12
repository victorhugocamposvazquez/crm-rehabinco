import { describe, expect, it } from "vitest";
import { consultasGeocoder, reordenarCandidatos, type CandidatoCarto } from "../geocoder-carto";

const ctx = {
  municipalityNames: ["A Coruña"],
  municipalityCodes: ["15030"],
  provinceCode: "15",
};

describe("geocoder CartoCiudad · sesgo agencia", () => {
  it('"montserra 12" prioriza Monserrat en A Coruña frente a otros municipios', () => {
    const candidatos: CandidatoCarto[] = [
      {
        address: "Calle Mayor 12, Alió (Tarragona)",
        lat: 41.2,
        lng: 1.1,
        postcode: "43428",
        municipality: "Alió",
        province: "43",
        streetType: null,
        streetName: null,
        streetNumber: null,
      },
      {
        address: "Calle Mayor 12, Arbeca (Lleida)",
        lat: 41.5,
        lng: 1.0,
        postcode: "25181",
        municipality: "Arbeca",
        province: "25",
        streetType: null,
        streetName: null,
        streetNumber: null,
      },
      {
        address: "Avenida Monserrat 12, Monserrat (A Coruña)",
        lat: 43.37,
        lng: -8.41,
        postcode: "15009",
        municipality: "A Coruña",
        province: "15",
        streetType: "AVENIDA",
        streetName: "MONSERRAT",
        streetNumber: "12",
      },
    ];
    const orden = reordenarCandidatos(candidatos, ctx);
    expect(orden[0].address).toContain("Monserrat");
    expect(orden[0].address).toMatch(/A Coruña/i);
  });

  it("montserra prioriza Avenida Monserrat 12 frente a calles Montseny en la misma ciudad", () => {
    const candidatos: CandidatoCarto[] = [
      {
        address: "CALLE FEDERICA MONTSENY 12, Curramontes (A Coruña)",
        lat: 1,
        lng: 1,
        postcode: "15009",
        municipality: "A Coruña",
        province: "15",
        muniCode: "15030",
        streetType: "CALLE",
        streetName: "FEDERICA MONTSENY",
        streetNumber: "12",
      },
      {
        address: "AVENIDA MONSERRAT 12, Monserrat (A Coruña)",
        lat: 2,
        lng: 2,
        postcode: "15009",
        municipality: "A Coruña",
        province: "15",
        muniCode: "15030",
        streetType: "AVENIDA",
        streetName: "MONSERRAT",
        streetNumber: "12",
      },
    ];
    const orden = reordenarCandidatos(candidatos, ctx, "montserra 12");
    expect(orden[0].address).toContain("MONSERRAT 12");
  });

  it("consultasGeocoder añade municipio y corrige montserra → montserrat", () => {
    const qs = consultasGeocoder("montserra 12", "A Coruña");
    expect(qs.some((q) => q.includes("A Coruña"))).toBe(true);
    expect(qs.some((q) => /montserrat/i.test(q))).toBe(true);
  });
});
