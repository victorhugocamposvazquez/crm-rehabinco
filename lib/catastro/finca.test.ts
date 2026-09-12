import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  coincideCodigoPostal,
  codigoPostalDePropiedad,
  codigosPostalesOficiales,
  direccionOficialDeFinca,
  filtrarPropiedadesPorCodigoPostal,
  fincaPuedePertenecerAlCodigoPostal,
  propiedadesDesdeInmuebles,
  seleccionarFincasParaResolverLtp,
  superficieSolarOficial,
} from "./finca";
import { parseConsultaDnp } from "./parse";
import { agruparPorFinca } from "./resolve-finca-ltp";
import type { DireccionNormalizada, InmuebleNormalizado } from "./types";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__");

const DIR: DireccionNormalizada = {
  tipoVia: "CL",
  via: "DEMO",
  numero: "10",
  numero2: null,
  bloque: null,
  escalera: null,
  planta: null,
  puerta: null,
  codigoPostal: "46388",
  provincia: "VALENCIA",
  municipio: "GODELLETA",
  literal: null,
};

function inmueble(opts: {
  rc20: string;
  numero?: string;
  numero2?: string;
  cp?: string | null;
  literal?: string;
  superficie?: number;
  anio?: number;
  uso?: string;
}): InmuebleNormalizado {
  return {
    referenciaCatastral: opts.rc20,
    referenciaParcela: opts.rc20.slice(0, 14),
    cargo: opts.rc20.slice(14, 18),
    tipoBien: "UR",
    direccion: {
      ...DIR,
      numero: opts.numero ?? "10",
      numero2: opts.numero2 ?? null,
      codigoPostal: opts.cp === undefined ? "46388" : opts.cp,
      literal: opts.literal ?? null,
    },
    superficie: opts.superficie ?? 50,
    anio: opts.anio ?? 1976,
    uso: opts.uso ?? "Residencial",
    coeficienteParticipacion: 100,
    finca: null,
    unidades: [],
    raw: null,
  };
}

const query = {
  provincia: "VALENCIA",
  municipio: "GODELLETA",
  sigla: "CL",
  via: "DEMO",
};

describe("modelo de finca vs inmueble", () => {
  it("3 y 4. misma finca en varios portales y múltiples RC", () => {
    const grupo = [
      inmueble({ rc20: "AAAAAAAAAAAAAA0001AA", numero: "10" }),
      inmueble({ rc20: "AAAAAAAAAAAAAA0002BB", numero: "12" }),
    ];
    const props = propiedadesDesdeInmuebles(grupo);
    assert.equal(props.length, 2);
    assert.deepEqual(
      props.map((item) => item.reference),
      ["AAAAAAAAAAAAAA0001AA", "AAAAAAAAAAAAAA0002BB"]
    );
    const dir = direccionOficialDeFinca(grupo, query);
    assert.equal(dir.numero, undefined);
    assert.deepEqual(props.map((item) => item.numero), ["10", "12"]);
  });

  it("7 y 8. conserva dirección y numeración oficial compleja", () => {
    const grupo = [
      inmueble({
        rc20: "AAAAAAAAAAAAAA0001AA",
        numero: "10",
        numero2: "BIS",
        literal: "CL DEMO 10-BIS 46388 GODELLETA (VALENCIA)",
      }),
    ];
    const dir = direccionOficialDeFinca(grupo, query);
    const props = propiedadesDesdeInmuebles(grupo);
    assert.equal(dir.numero, "10");
    assert.equal(dir.numero2, "BIS");
    assert.equal(dir.literal, "CL DEMO 10-BIS 46388 GODELLETA (VALENCIA)");
    assert.equal(props[0]?.numero, "10");
    assert.equal(props[0]?.numero2, "BIS");

    const diezA = propiedadesDesdeInmuebles([
      inmueble({ rc20: "AAAAAAAAAAAAAA0001AA", numero: "10A" }),
    ]);
    assert.equal(diezA[0]?.numero, "10A");
  });

  it("9. una finca puede acumular varios CP oficiales", () => {
    const grupo = [
      inmueble({ rc20: "AAAAAAAAAAAAAA0001AA", numero: "10", cp: "46388" }),
      inmueble({ rc20: "AAAAAAAAAAAAAA0002BB", numero: "12", cp: "28004" }),
    ];
    const cps = codigosPostalesOficiales(grupo);
    assert.deepEqual(cps, ["28004", "46388"]);
    assert.equal(coincideCodigoPostal(cps, "46388"), true);
    assert.equal(coincideCodigoPostal(cps, "28004"), true);
    assert.equal(coincideCodigoPostal(cps, "99999"), false);
  });

  it("descarta RC mal formadas al agrupar", () => {
    const grupos = agruparPorFinca([
      inmueble({ rc20: "AAAAAAAAAAAAAA0001AA" }),
      {
        ...inmueble({ rc20: "AAAAAAAAAAAAAA0001AA" }),
        referenciaCatastral: "CORTA",
        referenciaParcela: "CORTA",
      },
    ]);
    assert.equal(grupos.size, 1);
    assert.ok(grupos.has("AAAAAAAAAAAAAA"));
  });

  it("10. no inventa campos ausentes en una lista DNPLOC", () => {
    const parsed = parseConsultaDnp(
      JSON.parse(readFileSync(join(fixtures, "dnploc-fuencarral-50.json"), "utf8"))
    );
    const props = propiedadesDesdeInmuebles(parsed.results);
    assert.equal(props.length, 13);
    assert.ok(parsed.results.every((item) => item.finca == null));
    assert.equal(superficieSolarOficial(parsed.results), undefined);
    assert.ok(props.every((item) => item.unidades.length === 0));
    assert.ok(props.every((item) => item.superficie != null && item.anio != null && item.uso));
    assert.ok(!("coordenadas" in props[0]!));
  });

  it("Godelleta detalle sí trae superficieSolar y unidades de inmueble", () => {
    const parsed = parseConsultaDnp(
      JSON.parse(readFileSync(join(fixtures, "dnploc-godelleta.json"), "utf8"))
    );
    const props = propiedadesDesdeInmuebles(parsed.results);
    const dir = direccionOficialDeFinca(parsed.results, {
      provincia: "VALENCIA",
      municipio: "GODELLETA",
      sigla: "CL",
      via: "GUAYANA-MOJONERA",
    });
    assert.equal(dir.numero, "3");
    assert.equal(dir.literal, "CL GUAYANA-MOJONERA 3 46388 GODELLETA (VALENCIA)");
    assert.equal(superficieSolarOficial(parsed.results), 839);
    assert.equal(props[0]?.superficie, 94);
    assert.equal(props[0]?.anio, 1976);
    assert.equal(props[0]?.uso, "Residencial");
    assert.equal(props[0]?.unidades.length, 3);
  });
});

describe("prefiltro seguro por código postal", () => {
  const rcA1 = "AAAAAAAAAAAAAA0001AA";
  const rcA2 = "AAAAAAAAAAAAAA0002BB";
  const rcB1 = "BBBBBBBBBBBBBB0001CC";

  it("1. CP coincidente → conservar", () => {
    const props = [inmueble({ rc20: rcA1, cp: "46388" })];
    assert.equal(filtrarPropiedadesPorCodigoPostal(props, "46388").length, 1);
  });

  it("2. CP diferente → descartar", () => {
    const props = [inmueble({ rc20: rcA1, cp: "28004" })];
    assert.equal(filtrarPropiedadesPorCodigoPostal(props, "46388").length, 0);
  });

  it("3. CP ausente → conservar", () => {
    const props = [inmueble({ rc20: rcA1, cp: null })];
    assert.equal(codigoPostalDePropiedad(props[0]!), undefined);
    assert.equal(filtrarPropiedadesPorCodigoPostal(props, "46388").length, 1);
  });

  it("4 y 5. finca con RCs de varios CP: basta una coincidencia", () => {
    const grupo = [
      inmueble({ rc20: rcA1, cp: "46388" }),
      inmueble({ rc20: rcA2, cp: "28004" }),
    ];
    assert.equal(fincaPuedePertenecerAlCodigoPostal(grupo, "46388"), true);
    assert.equal(fincaPuedePertenecerAlCodigoPostal(grupo, "28004"), true);
    assert.equal(filtrarPropiedadesPorCodigoPostal(grupo, "46388").map((item) => item.referenciaCatastral)[0], rcA1);
  });

  it("6. ninguna RC coincide → no procesar la finca", () => {
    const grupo = [
      inmueble({ rc20: rcA1, cp: "28004" }),
      inmueble({ rc20: rcA2, cp: "28005" }),
    ];
    assert.equal(fincaPuedePertenecerAlCodigoPostal(grupo, "46388"), false);
  });

  it("7. no produce falsos negativos (ausencia o coincidencia parcial)", () => {
    const ausente = [inmueble({ rc20: rcA1, cp: null })];
    const mixta = [inmueble({ rc20: rcA1, cp: "46388" }), inmueble({ rc20: rcA2, cp: "28004" })];
    assert.equal(fincaPuedePertenecerAlCodigoPostal(ausente, "46388"), true);
    assert.equal(fincaPuedePertenecerAlCodigoPostal(mixta, "46388"), true);
  });

  it("8 y 9. no cambia fincaReference y conserva todas las RC al seleccionar", () => {
    const grupos = agruparPorFinca([
      inmueble({ rc20: rcA1, cp: "46388" }),
      inmueble({ rc20: rcA2, cp: "28004" }),
      inmueble({ rc20: rcB1, cp: "28004" }),
    ]);
    const { grupos: seleccion, stats } = seleccionarFincasParaResolverLtp(grupos, "46388");
    assert.equal(seleccion.size, 1);
    assert.ok(seleccion.has("AAAAAAAAAAAAAA"));
    const grupoA = seleccion.get("AAAAAAAAAAAAAA") ?? [];
    assert.deepEqual(
      grupoA.map((item) => item.referenciaCatastral).sort(),
      [rcA1, rcA2]
    );
    assert.equal(stats.propertiesSeen, 3);
    assert.equal(stats.propertiesRejectedByPostalCode, 2);
    assert.equal(stats.fincasPotentiallyMatchingPostalCode, 1);
    assert.equal(stats.dnprcAvoidedByPostalCode, 1);
  });

  it("12. sin CP el prefiltro no se aplica", () => {
    const grupos = agruparPorFinca([
      inmueble({ rc20: rcA1, cp: "46388" }),
      inmueble({ rc20: rcB1, cp: "28004" }),
    ]);
    const { grupos: seleccion, stats } = seleccionarFincasParaResolverLtp(grupos, undefined);
    assert.equal(seleccion.size, 2);
    assert.equal(stats.dnprcAvoidedByPostalCode, 0);
    assert.equal(stats.propertiesRejectedByPostalCode, 0);
  });
});
