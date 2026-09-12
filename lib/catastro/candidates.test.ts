import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clasificarCandidatos,
  filtrarPorDivision,
  fusionarFincas,
  getNonHorizontalDivisionFincas,
  parsearFiltroDivision,
} from "./candidates";
import { detectHorizontalDivision } from "./horizontal-division";
import type { FincaDescubierta } from "./discovery";

const ltpNo = "Parcela construida sin división horizontal";
const ltpYes = "Parcela con varios inmuebles (division horizontal)";

function finca(opts: {
  ref: string;
  status: "YES" | "NO" | "UNKNOWN" | "NOT_APPLICABLE";
  portals?: string[];
  refs?: string[];
  ltp?: string;
  reasonCode?: FincaDescubierta["horizontalDivision"]["reasonCode"];
}): FincaDescubierta {
  return {
    fincaReference: opts.ref,
    propertyReferences: opts.refs ?? [`${opts.ref}0001AA`],
    properties: [],
    portals: opts.portals ?? ["1"],
    address: { provincia: "VALENCIA", municipio: "GODELLETA", sigla: "CL", via: "DEMO" },
    postalCode: "46388",
    postalCodes: ["46388"],
    ltp: opts.ltp,
    horizontalDivision: {
      status: opts.status,
      confidence: opts.status === "UNKNOWN" ? 0 : 1,
      reason: opts.status,
      ...(opts.reasonCode ? { reasonCode: opts.reasonCode } : {}),
    },
  };
}

const completo = {
  complete: true,
  hasNextPage: false,
  possibleCut: false,
  portalErrors: 0,
};

describe("clasificarCandidatos", () => {
  it("1. una finca NO aparece como candidata", () => {
    const no = finca({ ref: "AAAAAAAAAAAAAA", status: "NO", ltp: ltpNo });
    const result = clasificarCandidatos([no], completo);
    assert.deepEqual(
      getNonHorizontalDivisionFincas([no], completo).map((item) => item.fincaReference),
      ["AAAAAAAAAAAAAA"]
    );
    assert.equal(result.withoutHorizontalDivision.length, 1);
    assert.equal(result.completeCandidates, true);
  });

  it("2. una finca YES no aparece como candidata", () => {
    const yes = finca({ ref: "0751301VK4705B", status: "YES", ltp: ltpYes });
    const result = clasificarCandidatos([yes], completo);
    assert.equal(result.withHorizontalDivision.length, 1);
    assert.equal(result.withoutHorizontalDivision.length, 0);
  });

  it("3. una finca UNKNOWN no aparece como candidata", () => {
    const unknown = finca({ ref: "UUUUUUUUUUUUUU", status: "UNKNOWN" });
    const result = clasificarCandidatos([unknown], completo);
    assert.equal(result.unknown.length, 1);
    assert.equal(result.withoutHorizontalDivision.length, 0);
    assert.equal(result.completeCandidates, false);
  });

  it("4. error DNPRC / ltp ausente / ltp desconocido → UNKNOWN, nunca candidato", () => {
    const porError = detectHorizontalDivision({
      error: { codigo: "33", descripcion: "LA VÍA NO EXISTE" },
    });
    const ausente = detectHorizontalDivision({ rawLtp: null });
    const desconocido = detectHorizontalDivision({ rawLtp: "Parcela rústica sin edificar" });
    assert.equal(porError.status, "UNKNOWN");
    assert.equal(ausente.status, "UNKNOWN");
    assert.equal(desconocido.status, "UNKNOWN");

    const fincas = [
      finca({ ref: "EEEEEEEEEEEEEE", status: porError.status }),
      finca({ ref: "NNNNNNNNNNNNNN", status: ausente.status }),
      finca({ ref: "DDDDDDDDDDDDDD", status: desconocido.status }),
    ];
    const result = clasificarCandidatos(fincas, completo);
    assert.equal(result.unknown.length, 3);
    assert.equal(result.withoutHorizontalDivision.length, 0);
    assert.ok(result.all.every((item) => item.horizontalDivision.status === "UNKNOWN"));
  });

  it("5 y 18. varias RC y fusión no duplican fincas", () => {
    const a = finca({
      ref: "AAAAAAAAAAAAAA",
      status: "NO",
      portals: ["10"],
      refs: ["AAAAAAAAAAAAAA0001AA"],
    });
    const b = finca({
      ref: "AAAAAAAAAAAAAA",
      status: "NO",
      portals: ["12"],
      refs: ["AAAAAAAAAAAAAA0002BB"],
    });
    const fusion = fusionarFincas(a, b);
    const result = clasificarCandidatos([fusion], completo);
    assert.equal(result.all.length, 1);
    assert.deepEqual(fusion.portals, ["10", "12"]);
    assert.equal(fusion.propertyReferences.length, 2);
  });

  it("6. misma finca en varias páginas se agrupa por 14 caracteres", () => {
    const p1 = finca({ ref: "AAAAAAAAAAAAAA", status: "NO", portals: ["10"] });
    const p2 = finca({ ref: "AAAAAAAAAAAAAA", status: "NO", portals: ["12"] });
    const fusion = fusionarFincas(p1, p2);
    assert.equal(fusion.fincaReference, "AAAAAAAAAAAAAA");
    assert.deepEqual(fusion.portals, ["10", "12"]);
  });

  it("11 y 12. página incompleta → completeCandidates false", () => {
    const no = finca({ ref: "AAAAAAAAAAAAAA", status: "NO", ltp: ltpNo });
    const result = clasificarCandidatos([no], {
      complete: false,
      hasNextPage: true,
      possibleCut: false,
      portalErrors: 0,
    });
    assert.equal(result.withoutHorizontalDivision.length, 1);
    assert.equal(result.completeCandidates, false);
  });

  it("13. possibleCut → completeCandidates false", () => {
    const no = finca({ ref: "AAAAAAAAAAAAAA", status: "NO", ltp: ltpNo });
    const result = clasificarCandidatos([no], {
      complete: false,
      hasNextPage: false,
      possibleCut: true,
      portalErrors: 0,
    });
    assert.equal(result.completeCandidates, false);
  });

  it("14. errores parciales → completeCandidates false", () => {
    const no = finca({ ref: "AAAAAAAAAAAAAA", status: "NO", ltp: ltpNo });
    const result = clasificarCandidatos([no], {
      complete: true,
      hasNextPage: false,
      possibleCut: false,
      portalErrors: 2,
    });
    assert.equal(result.withoutHorizontalDivision.length, 1);
    assert.equal(result.completeCandidates, false);
  });

  it("15. todo procesado y clasificado → completeCandidates true", () => {
    const result = clasificarCandidatos(
      [
        finca({ ref: "AAAAAAAAAAAAAA", status: "NO", ltp: ltpNo }),
        finca({ ref: "0751301VK4705B", status: "YES", ltp: ltpYes }),
      ],
      completo
    );
    assert.equal(result.completeCandidates, true);
    assert.equal(result.unknown.length, 0);
  });

  it("los cinco conjuntos son mutuamente excluyentes", () => {
    const fincas = [
      finca({ ref: "AAAAAAAAAAAAAA", status: "NO" }),
      finca({ ref: "BBBBBBBBBBBBBB", status: "YES" }),
      finca({ ref: "CCCCCCCCCCCCCC", status: "UNKNOWN" }),
      finca({ ref: "DDDDDDDDDDDDDD", status: "NOT_APPLICABLE" }),
    ];
    const result = clasificarCandidatos(fincas, completo);
    const refs = [
      ...result.withoutHorizontalDivision,
      ...result.withHorizontalDivision,
      ...result.unknown,
      ...result.notApplicable,
    ].map((item) => item.fincaReference);
    assert.equal(new Set(refs).size, 4);
    assert.equal(refs.length, 4);
    assert.equal(result.all.length, 4);
    assert.equal(result.notApplicable[0]?.horizontalDivision.status, "NOT_APPLICABLE");
    assert.equal(result.withoutHorizontalDivision[0]?.horizontalDivision.status, "NO");
  });

  it("UNKNOWN gana a NOT_APPLICABLE al fusionar; YES/NO no cambian", () => {
    const na = finca({ ref: "AAAAAAAAAAAAAA", status: "NOT_APPLICABLE" });
    const unknown = finca({ ref: "AAAAAAAAAAAAAA", status: "UNKNOWN" });
    const no = finca({ ref: "AAAAAAAAAAAAAA", status: "NO" });
    assert.equal(fusionarFincas(na, unknown).horizontalDivision.status, "UNKNOWN");
    assert.equal(fusionarFincas(unknown, no).horizontalDivision.status, "NO");
    assert.equal(fusionarFincas(na, no).horizontalDivision.status, "NO");
  });

  it("5. UNKNOWN + MIXED_URBAN_RURAL sigue sin ser candidato", () => {
    const mixto = finca({
      ref: "MMMMMMMMMMMMMM",
      status: "UNKNOWN",
      reasonCode: "MIXED_URBAN_RURAL",
    });
    const result = clasificarCandidatos([mixto], completo);
    assert.equal(mixto.horizontalDivision.status, "UNKNOWN");
    assert.equal(mixto.horizontalDivision.reasonCode, "MIXED_URBAN_RURAL");
    assert.equal(result.unknown.length, 1);
    assert.equal(result.withoutHorizontalDivision.length, 0);
    assert.equal(result.completeCandidates, false);
  });

  it("al fusionar dos UNKNOWN gana el motivo más informativo, sin cambiar el status", () => {
    const query = finca({
      ref: "AAAAAAAAAAAAAA",
      status: "UNKNOWN",
      reasonCode: "QUERY_ERROR",
    });
    const mixto = finca({
      ref: "AAAAAAAAAAAAAA",
      status: "UNKNOWN",
      reasonCode: "MIXED_URBAN_RURAL",
    });
    const fusion = fusionarFincas(query, mixto);
    assert.equal(fusion.horizontalDivision.status, "UNKNOWN");
    assert.equal(fusion.horizontalDivision.reasonCode, "MIXED_URBAN_RURAL");
    assert.equal(fusionarFincas(mixto, query).horizontalDivision.reasonCode, "MIXED_URBAN_RURAL");
  });
});

describe("filtrarPorDivision", () => {
  const fincas = [
    finca({ ref: "AAAAAAAAAAAAAA", status: "NO" }),
    finca({ ref: "BBBBBBBBBBBBBB", status: "YES" }),
    finca({ ref: "CCCCCCCCCCCCCC", status: "UNKNOWN" }),
  ];

  it("7. filtro NO", () => {
    assert.deepEqual(
      filtrarPorDivision(fincas, "NO").map((item) => item.fincaReference),
      ["AAAAAAAAAAAAAA"]
    );
  });

  it("8. filtro YES", () => {
    assert.deepEqual(
      filtrarPorDivision(fincas, "YES").map((item) => item.fincaReference),
      ["BBBBBBBBBBBBBB"]
    );
  });

  it("9. filtro UNKNOWN", () => {
    assert.deepEqual(
      filtrarPorDivision(fincas, "UNKNOWN").map((item) => item.fincaReference),
      ["CCCCCCCCCCCCCC"]
    );
  });

  it("6. filtro UNKNOWN incluye todos los motivos", () => {
    const conMotivos = [
      finca({ ref: "MIXMIXMIXMIXMI", status: "UNKNOWN", reasonCode: "MIXED_URBAN_RURAL" }),
      finca({ ref: "MISMISMISMISMI", status: "UNKNOWN", reasonCode: "LTP_MISSING" }),
      finca({ ref: "UNRUNRUNRUNRUN", status: "UNKNOWN", reasonCode: "LTP_UNRECOGNIZED" }),
      finca({ ref: "ERRERRERRERRER", status: "UNKNOWN", reasonCode: "QUERY_ERROR" }),
      finca({ ref: "AAAAAAAAAAAAAA", status: "NO" }),
    ];
    const unknown = filtrarPorDivision(conMotivos, "UNKNOWN");
    assert.deepEqual(
      unknown.map((item) => item.fincaReference),
      ["MIXMIXMIXMIXMI", "MISMISMISMISMI", "UNRUNRUNRUNRUN", "ERRERRERRERRER"]
    );
    assert.ok(unknown.every((item) => item.horizontalDivision.status === "UNKNOWN"));
    assert.equal(filtrarPorDivision(conMotivos, "NO").length, 1);
  });

  it("10. ALL no filtra", () => {
    assert.equal(filtrarPorDivision(fincas, "ALL").length, 3);
    assert.equal(parsearFiltroDivision("").ok, true);
    assert.equal(parsearFiltroDivision("maybe").ok, false);
  });

  it("filtro NOT_APPLICABLE y ALL con cuatro categorías", () => {
    const conNa = [
      ...fincas,
      finca({ ref: "DDDDDDDDDDDDDD", status: "NOT_APPLICABLE" }),
    ];
    assert.deepEqual(
      filtrarPorDivision(conNa, "NOT_APPLICABLE").map((item) => item.fincaReference),
      ["DDDDDDDDDDDDDD"]
    );
    assert.equal(filtrarPorDivision(conNa, "NO").some((item) => item.horizontalDivision.status === "NOT_APPLICABLE"), false);
    assert.equal(filtrarPorDivision(conNa, "ALL").length, 4);
    assert.equal(parsearFiltroDivision("NOT_APPLICABLE").ok, true);
  });
});
