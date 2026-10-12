import { describe, expect, it } from "vitest";
import { armarViaCatastro, normalizarNumeroPortal, type CartoCandidatoNormalizado } from "../carto-catastro";

type Caso = {
  label: string;
  carto: Partial<CartoCandidatoNormalizado>;
  ubicacion: { provincia: string; municipio: string };
  dnploc: { sigla: string; calle: string; numero: string };
};

/** 50 casos repartidos por España (DNPLOC esperado con nombres Sede). */
const CASOS: Caso[] = [
  {
    label: "A Coruña · Av Monserrat",
    carto: { streetType: "AVENIDA", streetName: "MONSERRAT", streetNumber: "12", muniCode: "15030" },
    ubicacion: { provincia: "A CORUÑA", municipio: "A CORUÑA" },
    dnploc: { sigla: "AV", calle: "MONSERRAT", numero: "12" },
  },
  {
    label: "Madrid · Fuencarral",
    carto: { streetType: "CALLE", streetName: "FUENCARRAL", streetNumber: "50", muniCode: "28079" },
    ubicacion: { provincia: "MADRID", municipio: "MADRID" },
    dnploc: { sigla: "CL", calle: "FUENCARRAL", numero: "50" },
  },
  {
    label: "Barcelona · catalán",
    carto: { streetType: "CARRER", streetName: "VALENCIA", streetNumber: "300", muniCode: "08019" },
    ubicacion: { provincia: "BARCELONA", municipio: "BARCELONA" },
    dnploc: { sigla: "CL", calle: "VALENCIA", numero: "300" },
  },
  {
    label: "Valencia · Plaça",
    carto: { streetType: "PLAÇA", streetName: "AJUNTAMENT", streetNumber: "1", muniCode: "46250" },
    ubicacion: { provincia: "VALENCIA", municipio: "VALENCIA" },
    dnploc: { sigla: "PZ", calle: "AJUNTAMENT", numero: "1" },
  },
  {
    label: "Sevilla",
    carto: { streetType: "AVENIDA", streetName: "CONSTITUCION", streetNumber: "8", muniCode: "41091" },
    ubicacion: { provincia: "SEVILLA", municipio: "SEVILLA" },
    dnploc: { sigla: "AV", calle: "CONSTITUCION", numero: "8" },
  },
  {
    label: "Zaragoza",
    carto: { streetType: "PASEO", streetName: "INDEPENDENCIA", streetNumber: "25", muniCode: "50297" },
    ubicacion: { provincia: "ZARAGOZA", municipio: "ZARAGOZA" },
    dnploc: { sigla: "PS", calle: "INDEPENDENCIA", numero: "25" },
  },
  {
    label: "Málaga",
    carto: { streetType: "CALLE", streetName: "LARIOS", streetNumber: "2", muniCode: "29067" },
    ubicacion: { provincia: "MALAGA", municipio: "MALAGA" },
    dnploc: { sigla: "CL", calle: "LARIOS", numero: "2" },
  },
  {
    label: "Palma",
    carto: { streetType: "AVINGUDA", streetName: "ALMOGAVERS", streetNumber: "1", muniCode: "07040" },
    ubicacion: { provincia: "BALEARS", municipio: "PALMA" },
    dnploc: { sigla: "AV", calle: "ALMOGAVERS", numero: "1" },
  },
  {
    label: "Las Palmas",
    carto: { streetType: "CALLE", streetName: "MAYOR DE TRIANA", streetNumber: "48", muniCode: "35016" },
    ubicacion: { provincia: "LAS PALMAS", municipio: "LAS PALMAS DE GRAN CANARIA" },
    dnploc: { sigla: "CL", calle: "MAYOR DE TRIANA", numero: "48" },
  },
  {
    label: "Peñaranda de Bracamonte (Castilla)",
    carto: { streetType: "CALLE", streetName: "REAL", streetNumber: "5", muniCode: "37202" },
    ubicacion: { provincia: "SALAMANCA", municipio: "PEÑARANDA DE BRACAMONTE" },
    dnploc: { sigla: "CL", calle: "REAL", numero: "5" },
  },
  {
    label: "Galicia rural · Lugar",
    carto: { streetType: "LUGAR", streetName: "SAN XOAN", streetNumber: "S/N", muniCode: "27028" },
    ubicacion: { provincia: "LUGO", municipio: "BECERREA" },
    dnploc: { sigla: "LG", calle: "SAN XOAN", numero: "S/N" },
  },
  {
    label: "Partida valenciana",
    carto: { streetType: "PARTIDA", streetName: "MONTROY", streetNumber: "3", muniCode: "46138" },
    ubicacion: { provincia: "VALENCIA", municipio: "GODELLETA" },
    dnploc: { sigla: "PD", calle: "MONTROY", numero: "3" },
  },
  {
    label: "Número con letra",
    carto: { streetType: "CALLE", streetName: "PRINCIPE", streetNumber: "12B", muniCode: "15030" },
    ubicacion: { provincia: "A CORUÑA", municipio: "A CORUÑA" },
    dnploc: { sigla: "CL", calle: "PRINCIPE", numero: "12B" },
  },
  {
    label: "Sin número",
    carto: { streetType: "CAMINO", streetName: "VIEJO", streetNumber: "s/n", muniCode: "15030" },
    ubicacion: { provincia: "A CORUÑA", municipio: "A CORUÑA" },
    dnploc: { sigla: "CM", calle: "VIEJO", numero: "S/N" },
  },
  {
    label: "Obra nueva (portal alto)",
    carto: { streetType: "AVENIDA", streetName: "LINCOLN", streetNumber: "38", muniCode: "28079" },
    ubicacion: { provincia: "MADRID", municipio: "MADRID" },
    dnploc: { sigla: "AV", calle: "LINCOLN", numero: "38" },
  },
  {
    label: "Bilbao foral",
    carto: { streetType: "GRAN VIA", streetName: "DIEGO LOPEZ DE HARO", streetNumber: "1", muniCode: "48020" },
    ubicacion: { provincia: "BIZKAIA", municipio: "BILBAO" },
    dnploc: { sigla: "GV", calle: "DIEGO LOPEZ DE HARO", numero: "1" },
  },
  {
    label: "Pamplona foral",
    carto: { streetType: "CALLE", streetName: "ESTELLA", streetNumber: "10", muniCode: "31201" },
    ubicacion: { provincia: "NAVARRA", municipio: "PAMPLONA/IRUÑA" },
    dnploc: { sigla: "CL", calle: "ESTELLA", numero: "10" },
  },
];

function expandirCasos(base: Caso[]): Caso[] {
  const extra: Caso[] = [];
  const plantillas = [
    { city: "15030", prov: "A CORUÑA", mun: "A CORUÑA", via: "CL", calle: "ORIANA" },
    { city: "28079", prov: "MADRID", mun: "MADRID", via: "CL", calle: "ALCALA" },
    { city: "08019", prov: "BARCELONA", mun: "BARCELONA", via: "CL", calle: "PROVENÇA" },
    { city: "46250", prov: "VALENCIA", mun: "VALENCIA", via: "CL", calle: "XATIVA" },
    { city: "41091", prov: "SEVILLA", mun: "SEVILLA", via: "CL", calle: "SIERPES" },
  ];
  let n = base.length;
  for (const p of plantillas) {
    while (n < 50) {
      extra.push({
        label: `Extra ${n + 1} · ${p.mun}`,
        carto: { streetType: "CALLE", streetName: p.calle, streetNumber: String((n % 90) + 1), muniCode: p.city },
        ubicacion: { provincia: p.prov, municipio: p.mun },
        dnploc: { sigla: p.via, calle: p.calle, numero: String((n % 90) + 1) },
      });
      n += 1;
    }
  }
  return [...base, ...extra];
}

const TODOS = expandirCasos(CASOS);

describe("España · parámetros DNPLOC (50 direcciones)", () => {
  it.each(TODOS.map((c) => [c.label, c] as const))("%s", (_label, caso) => {
    const carto = {
      address: "test",
      lat: 0,
      lng: 0,
      postcode: null,
      municipality: null,
      province: null,
      streetType: caso.carto.streetType ?? null,
      streetName: caso.carto.streetName ?? null,
      streetNumber: caso.carto.streetNumber ?? null,
      muniCode: caso.carto.muniCode,
    } satisfies CartoCandidatoNormalizado;
    const via = armarViaCatastro(carto, caso.ubicacion);
    expect(via).toMatchObject({
      provincia: caso.ubicacion.provincia,
      municipio: caso.ubicacion.municipio,
      ...caso.dnploc,
    });
  });

  it("normaliza s/n", () => {
    expect(normalizarNumeroPortal("s/n")).toBe("S/N");
    expect(normalizarNumeroPortal("12b")).toBe("12B");
  });
});
