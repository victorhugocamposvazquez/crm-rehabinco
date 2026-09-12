import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectHorizontalDivision } from "./horizontal-division";
import {
  LTP_MIXTO_URBANO_RUSTICO,
  etiquetaMotivoUnknownCsv,
  etiquetaMotivoUnknownUi,
  reasonCodeUnknownDe,
  recuentoReasonCodeUnknown,
} from "./unknown-reason";

describe("reasonCode de UNKNOWN (descriptivo)", () => {
  it("1. mixto urbano/rústico → UNKNOWN + MIXED_URBAN_RURAL", () => {
    const dh = detectHorizontalDivision({ rawLtp: LTP_MIXTO_URBANO_RUSTICO });
    assert.equal(dh.status, "UNKNOWN");
    assert.equal(
      reasonCodeUnknownDe({ status: dh.status, reason: dh.reason, rawLtp: dh.rawLtp }),
      "MIXED_URBAN_RURAL"
    );
    const variante =
      "Parcela, a efectos catastrales, con inmuebles de distinta clase (urbano, rústico).";
    assert.equal(
      reasonCodeUnknownDe({
        status: "UNKNOWN",
        reason: dh.reason,
        rawLtp: variante,
      }),
      "MIXED_URBAN_RURAL"
    );
  });

  it("2. ltp ausente → LTP_MISSING", () => {
    const dh = detectHorizontalDivision({ rawLtp: null });
    assert.equal(reasonCodeUnknownDe({ status: dh.status, reason: dh.reason, rawLtp: null }), "LTP_MISSING");
  });

  it("3. ltp desconocido → LTP_UNRECOGNIZED", () => {
    const dh = detectHorizontalDivision({ rawLtp: "Parcela rústica sin edificar" });
    assert.equal(
      reasonCodeUnknownDe({ status: dh.status, reason: dh.reason, rawLtp: dh.rawLtp }),
      "LTP_UNRECOGNIZED"
    );
  });

  it("4. error de consulta → QUERY_ERROR", () => {
    const dh = detectHorizontalDivision({ error: { codigo: "33", descripcion: "ERROR" } });
    assert.equal(reasonCodeUnknownDe({ status: dh.status, reason: dh.reason, rawLtp: null }), "QUERY_ERROR");
  });

  it("8. misma finca → mismo motivo; no depende del momento", () => {
    const a = reasonCodeUnknownDe({
      status: "UNKNOWN",
      reason: detectHorizontalDivision({ rawLtp: LTP_MIXTO_URBANO_RUSTICO }).reason,
      rawLtp: LTP_MIXTO_URBANO_RUSTICO,
    });
    const b = reasonCodeUnknownDe({
      status: "UNKNOWN",
      reason: detectHorizontalDivision({ rawLtp: LTP_MIXTO_URBANO_RUSTICO }).reason,
      rawLtp: LTP_MIXTO_URBANO_RUSTICO,
    });
    assert.equal(a, b);
    assert.equal(a, "MIXED_URBAN_RURAL");
  });

  it("otra causa no prevista queda OTHER", () => {
    assert.equal(
      reasonCodeUnknownDe({
        status: "UNKNOWN",
        reason: "causa no catalogada",
        rawLtp: null,
      }),
      "OTHER"
    );
  });

  it("YES / NO / NOT_APPLICABLE no llevan reasonCode", () => {
    assert.equal(
      reasonCodeUnknownDe({
        status: "NO",
        reason: "x",
        rawLtp: "Parcela construida sin división horizontal",
      }),
      undefined
    );
    assert.equal(reasonCodeUnknownDe({ status: "YES", reason: "x", rawLtp: "y" }), undefined);
    assert.equal(reasonCodeUnknownDe({ status: "NOT_APPLICABLE", reason: "x", rawLtp: null }), undefined);
  });

  it("11. UI no etiqueta UNKNOWN como SIN DIVISIÓN HORIZONTAL", () => {
    assert.equal(etiquetaMotivoUnknownUi("MIXED_URBAN_RURAL"), "Parcela urbano-rústica");
    assert.equal(
      etiquetaMotivoUnknownUi("LTP_MISSING"),
      "Catastro no proporciona la clasificación de división horizontal"
    );
    assert.equal(etiquetaMotivoUnknownUi("QUERY_ERROR"), "No se pudo obtener la información necesaria");
    assert.notEqual(etiquetaMotivoUnknownUi("MIXED_URBAN_RURAL"), "SIN DIVISIÓN HORIZONTAL");
    assert.equal(etiquetaMotivoUnknownCsv("LTP_MISSING"), "LTP no informado");
    assert.equal(etiquetaMotivoUnknownCsv("LTP_UNRECOGNIZED"), "LTP no reconocido");
    assert.equal(etiquetaMotivoUnknownCsv("QUERY_ERROR"), "Error de consulta");
  });

  it("el recuento interno separa los cuatro motivos", () => {
    const recuento = recuentoReasonCodeUnknown([
      { horizontalDivision: { status: "UNKNOWN", reasonCode: "MIXED_URBAN_RURAL" } },
      { horizontalDivision: { status: "UNKNOWN", reasonCode: "LTP_MISSING" } },
      { horizontalDivision: { status: "UNKNOWN", reasonCode: "LTP_UNRECOGNIZED" } },
      { horizontalDivision: { status: "UNKNOWN", reasonCode: "QUERY_ERROR" } },
      { horizontalDivision: { status: "NO" } },
    ]);
    assert.deepEqual(recuento, {
      unknown: 4,
      unknownMixedUrbanRural: 1,
      unknownLtpMissing: 1,
      unknownLtpUnrecognized: 1,
      unknownQueryError: 1,
    });
  });
});
