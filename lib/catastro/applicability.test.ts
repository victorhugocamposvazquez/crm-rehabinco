import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluarAplicabilidadDh,
  evidenciaSueloOficial,
  RAZON_NOT_APPLICABLE_LDT_SUELO,
  RAZON_NOT_APPLICABLE_LUSO_SUELO,
  RAZON_NOT_APPLICABLE_LUSO_URBANIZACION,
} from "./applicability";
import { clasificarCandidatos, filtrarPorDivision, parsearFiltroDivision } from "./candidates";
import { detectHorizontalDivision } from "./horizontal-division";
import type { FincaDescubierta } from "./finca";
import type { DireccionNormalizada, InmuebleNormalizado } from "./types";

const DIR: DireccionNormalizada = {
  tipoVia: "CL",
  via: "DEMO",
  numero: "2",
  numero2: null,
  bloque: null,
  escalera: null,
  planta: null,
  puerta: null,
  codigoPostal: "46388",
  provincia: "VALENCIA",
  municipio: "GODELLETA",
  literal: "CL DEMO 2 46388 GODELLETA (VALENCIA)",
};

function inmueble(opts: {
  rc20?: string;
  uso?: string | null;
  literal?: string | null;
  superficie?: number | null;
  ltp?: string | null;
  unidades?: number;
}): InmuebleNormalizado {
  const rc20 = opts.rc20 ?? "AAAAAAAAAAAAAA0001AA";
  return {
    referenciaCatastral: rc20,
    referenciaParcela: rc20.slice(0, 14),
    cargo: rc20.slice(14, 18),
    tipoBien: "UR",
    direccion: { ...DIR, literal: opts.literal === undefined ? DIR.literal : opts.literal },
    superficie: opts.superficie === undefined ? 50 : opts.superficie,
    anio: 1976,
    uso: opts.uso === undefined ? "Residencial" : opts.uso,
    coeficienteParticipacion: 100,
    finca: opts.ltp
      ? { literal: null, tipoLiteral: opts.ltp, superficieSolar: null, urlGrafico: null }
      : null,
    unidades: Array.from({ length: opts.unidades ?? 0 }, () => ({
      uso: "VIVIENDA",
      tipologia: null,
      superficie: 40,
      escalera: null,
      planta: "01",
      puerta: "A",
    })),
    raw: null,
  };
}

function fincaUi(opts: {
  ref: string;
  status: "YES" | "NO" | "UNKNOWN" | "NOT_APPLICABLE";
}): FincaDescubierta {
  return {
    fincaReference: opts.ref,
    propertyReferences: [`${opts.ref}0001AA`],
    properties: [],
    portals: ["1"],
    address: { provincia: "VALENCIA", municipio: "GODELLETA", sigla: "CL", via: "DEMO" },
    postalCodes: ["46388"],
    horizontalDivision: {
      status: opts.status,
      confidence: opts.status === "UNKNOWN" ? 0 : 1,
      reason: opts.status,
    },
  };
}

const completo = { complete: true, hasNextPage: false, possibleCut: false, portalErrors: 0 };

describe("aplicabilidad DH (conservadora)", () => {
  it("1. suelo sin edificar → NOT_APPLICABLE", () => {
    const r = evaluarAplicabilidadDh([
      inmueble({ uso: "Suelos sin edificar", superficie: 0 }),
    ]);
    assert.equal(r.aplicable, false);
    if (!r.aplicable) {
      assert.equal(r.status, "NOT_APPLICABLE");
      assert.equal(r.reason, RAZON_NOT_APPLICABLE_LUSO_SUELO);
    }
  });

  it("2. obras de urbanización/jardinería → NOT_APPLICABLE", () => {
    const r = evaluarAplicabilidadDh([
      inmueble({
        uso: "Obras de urbanización y jardineria, suelos sin edificar",
        superficie: 0,
      }),
    ]);
    assert.equal(r.aplicable, false);
    if (!r.aplicable) assert.equal(r.reason, RAZON_NOT_APPLICABLE_LUSO_SUELO);
    const soloUrbanizacion = evaluarAplicabilidadDh([
      inmueble({ uso: "Obras de urbanización y jardineria" }),
    ]);
    assert.equal(soloUrbanizacion.aplicable, false);
    if (!soloUrbanizacion.aplicable) {
      assert.equal(soloUrbanizacion.reason, RAZON_NOT_APPLICABLE_LUSO_URBANIZACION);
    }
  });

  it("3. ldt claramente de suelo → NOT_APPLICABLE", () => {
    const r = evaluarAplicabilidadDh([
      inmueble({
        uso: "Residencial",
        literal: "CL 9 DE OCTUBRE-MONSEC 2 Suelo 46388 GODELLETA (VALENCIA)",
      }),
    ]);
    assert.equal(r.aplicable, false);
    if (!r.aplicable) assert.equal(r.reason, RAZON_NOT_APPLICABLE_LDT_SUELO);
    assert.equal(evidenciaSueloOficial(inmueble({ literal: "CL CONSUELO 2" })), null);
  });

  it("4. superficie 0 sola → no convertir", () => {
    const r = evaluarAplicabilidadDh([inmueble({ uso: "Residencial", superficie: 0 })]);
    assert.equal(r.aplicable, true);
  });

  it("5. ausencia de ltp sola → no es NOT_APPLICABLE (UNKNOWN del clasificador)", () => {
    const grupo = [inmueble({ uso: "Residencial", ltp: null })];
    assert.equal(evaluarAplicabilidadDh(grupo).aplicable, true);
    assert.equal(detectHorizontalDivision({ rawLtp: null }).status, "UNKNOWN");
  });

  it("6. un único inmueble sin evidencia de suelo → no inferir", () => {
    assert.equal(evaluarAplicabilidadDh([inmueble({ uso: "Residencial" })]).aplicable, true);
  });

  it("7. varias RC no infieren por sí solas", () => {
    const r = evaluarAplicabilidadDh([
      inmueble({ rc20: "AAAAAAAAAAAAAA0001AA", uso: "Residencial" }),
      inmueble({ rc20: "AAAAAAAAAAAAAA0002BB", uso: "Residencial" }),
    ]);
    assert.equal(r.aplicable, true);
  });

  it("8. lcons no infiere", () => {
    const r = evaluarAplicabilidadDh([inmueble({ uso: "Residencial", unidades: 6 })]);
    assert.equal(r.aplicable, true);
  });

  it("9. NOT_APPLICABLE no es NO ni candidato", () => {
    const na = fincaUi({ ref: "5472105YJ0657S", status: "NOT_APPLICABLE" });
    const result = clasificarCandidatos([na], completo);
    assert.equal(result.notApplicable.length, 1);
    assert.equal(result.withoutHorizontalDivision.length, 0);
    assert.equal(result.unknown.length, 0);
    assert.notEqual(na.horizontalDivision.status, "NO");
  });

  it("si una RC tiene ltp, la finca sigue siendo aplicable", () => {
    const r = evaluarAplicabilidadDh([
      inmueble({
        rc20: "AAAAAAAAAAAAAA0001AA",
        uso: "Suelos sin edificar",
        ltp: "Parcela construida sin división horizontal",
      }),
    ]);
    assert.equal(r.aplicable, true);
  });

  it("jardinería suelta o luso dudoso no convierten", () => {
    assert.equal(evaluarAplicabilidadDh([inmueble({ uso: "Jardinería" })]).aplicable, true);
    assert.equal(evaluarAplicabilidadDh([inmueble({ uso: "Almacén-Estacionamiento" })]).aplicable, true);
    assert.equal(evaluarAplicabilidadDh([inmueble({ uso: "Agrario" })]).aplicable, true);
  });

  it("ldt en finca.literal también cuenta", () => {
    const r = evaluarAplicabilidadDh([
      {
        ...inmueble({ uso: "Residencial" }),
        finca: {
          literal: "CL DEMO 2 Suelo 46388 GODELLETA (VALENCIA)",
          tipoLiteral: null,
          superficieSolar: null,
          urlGrafico: null,
        },
      },
    ]);
    assert.equal(r.aplicable, false);
    if (!r.aplicable) assert.equal(r.reason, RAZON_NOT_APPLICABLE_LDT_SUELO);
  });

  it("si una RC no es suelo, la finca no pasa a NOT_APPLICABLE", () => {
    const r = evaluarAplicabilidadDh([
      inmueble({ rc20: "AAAAAAAAAAAAAA0001AA", uso: "Suelos sin edificar" }),
      inmueble({ rc20: "AAAAAAAAAAAAAA0002BB", uso: "Residencial" }),
    ]);
    assert.equal(r.aplicable, true);
  });
});

describe("filtros y completeCandidates con NOT_APPLICABLE", () => {
  const fincas = [
    fincaUi({ ref: "AAAAAAAAAAAAAA", status: "NO" }),
    fincaUi({ ref: "BBBBBBBBBBBBBB", status: "YES" }),
    fincaUi({ ref: "CCCCCCCCCCCCCC", status: "UNKNOWN" }),
    fincaUi({ ref: "DDDDDDDDDDDDDD", status: "NOT_APPLICABLE" }),
  ];

  it("10. filtro NOT_APPLICABLE", () => {
    assert.deepEqual(
      filtrarPorDivision(fincas, "NOT_APPLICABLE").map((item) => item.fincaReference),
      ["DDDDDDDDDDDDDD"]
    );
    assert.equal(parsearFiltroDivision("not_applicable").ok, true);
  });

  it("11. filtro NO no devuelve NOT_APPLICABLE", () => {
    const soloNo = filtrarPorDivision(fincas, "NO");
    assert.deepEqual(soloNo.map((item) => item.fincaReference), ["AAAAAAAAAAAAAA"]);
    assert.ok(soloNo.every((item) => item.horizontalDivision.status === "NO"));
  });

  it("12. ALL devuelve las cuatro categorías", () => {
    assert.equal(filtrarPorDivision(fincas, "ALL").length, 4);
    const result = clasificarCandidatos(fincas, completo);
    assert.equal(result.withoutHorizontalDivision.length, 1);
    assert.equal(result.withHorizontalDivision.length, 1);
    assert.equal(result.unknown.length, 1);
    assert.equal(result.notApplicable.length, 1);
  });

  it("13. completeCandidates ignora NOT_APPLICABLE como pendiente", () => {
    const soloNa = clasificarCandidatos(
      [fincaUi({ ref: "DDDDDDDDDDDDDD", status: "NOT_APPLICABLE" }), fincaUi({ ref: "AAAAAAAAAAAAAA", status: "NO" })],
      completo
    );
    assert.equal(soloNa.completeCandidates, true);
    assert.equal(soloNa.unknown.length, 0);
    const conUnknown = clasificarCandidatos(fincas, completo);
    assert.equal(conUnknown.completeCandidates, false);
  });
});
