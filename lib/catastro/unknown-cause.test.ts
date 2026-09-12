import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RAZON_UNKNOWN_ERROR,
  RAZON_UNKNOWN_LTP_AUSENTE,
  RAZON_UNKNOWN_LTP_NO_RECONOCIDO,
  detectHorizontalDivision,
} from "./horizontal-division";
import { parseConsultaDnp } from "./parse";
import { resolverDivisionHorizontal } from "./resolve-finca-ltp";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  causaUnknownDe,
  recuentoCausasUnknown,
  type FincaParaDiagnosticoUnknown,
} from "./unknown-cause";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__");

function finca(opts: {
  ref: string;
  status?: "YES" | "NO" | "UNKNOWN";
  reason?: string;
  ltp?: string | null;
}): FincaParaDiagnosticoUnknown {
  const clasificacion =
    opts.status === "NO"
      ? detectHorizontalDivision({ rawLtp: "Parcela construida sin división horizontal" })
      : opts.status === "YES"
        ? detectHorizontalDivision({
            rawLtp: "Parcela con varios inmuebles (division horizontal)",
          })
        : detectHorizontalDivision({
            rawLtp: opts.ltp === undefined ? "Parcela rústica sin edificar" : opts.ltp,
            error: opts.reason === RAZON_UNKNOWN_ERROR ? { codigo: "33", descripcion: "x" } : null,
          });
  return {
    fincaReference: opts.ref,
    ltp: opts.ltp === undefined ? clasificacion.rawLtp : opts.ltp,
    horizontalDivision: {
      status: opts.status ?? clasificacion.status,
      reason: opts.reason ?? clasificacion.reason,
    },
  };
}

describe("causas reales de UNKNOWN", () => {
  it("error de consulta (DNPRC / Catastro) → consulta_error", () => {
    const clasificacion = detectHorizontalDivision({
      error: { codigo: "33", descripcion: "ERROR EN LA REFERENCIA" },
    });
    assert.equal(clasificacion.status, "UNKNOWN");
    assert.equal(clasificacion.reason, RAZON_UNKNOWN_ERROR);
    assert.equal(clasificacion.evidence, "consulta.error");
    assert.equal(
      causaUnknownDe({
        fincaReference: "AAAAAAAAAAAAAA",
        ltp: null,
        horizontalDivision: clasificacion,
      }),
      "consulta_error"
    );
  });

  it("ltp ausente (incluido vacío) → ltp_ausente", () => {
    const ausente = detectHorizontalDivision({ rawLtp: null });
    const vacio = detectHorizontalDivision({ rawLtp: "   " });
    assert.equal(ausente.reason, RAZON_UNKNOWN_LTP_AUSENTE);
    assert.equal(vacio.reason, RAZON_UNKNOWN_LTP_AUSENTE);
    assert.equal(ausente.evidence, null);
    assert.equal(
      causaUnknownDe({
        fincaReference: "AAAAAAAAAAAAAA",
        ltp: null,
        horizontalDivision: ausente,
      }),
      "ltp_ausente"
    );
  });

  it("ltp presente no reconocido → ltp_desconocido", () => {
    const rustica = detectHorizontalDivision({ rawLtp: "Parcela rústica sin edificar" });
    const unica = detectHorizontalDivision({ rawLtp: "Parcela con un único inmueble." });
    assert.equal(rustica.reason, RAZON_UNKNOWN_LTP_NO_RECONOCIDO);
    assert.equal(unica.reason, RAZON_UNKNOWN_LTP_NO_RECONOCIDO);
    assert.equal(rustica.evidence, "finca.ltp");
    assert.equal(
      causaUnknownDe({
        fincaReference: "AAAAAAAAAAAAAA",
        ltp: rustica.rawLtp,
        horizontalDivision: rustica,
      }),
      "ltp_desconocido"
    );
  });

  it("error al consultar el detalle (fixture) se distingue de ltp ausente", async () => {
    const consulta = parseConsultaDnp(
      JSON.parse(readFileSync(join(fixtures, "dnploc-fuencarral-50.json"), "utf8"))
    );
    const clasificaciones = await resolverDivisionHorizontal(consulta, {
      consultarReferencia: async () =>
        parseConsultaDnp(JSON.parse(readFileSync(join(fixtures, "dnploc-via-inexistente.json"), "utf8"))),
    });
    assert.equal(clasificaciones[0]?.status, "UNKNOWN");
    assert.equal(clasificaciones[0]?.reason, RAZON_UNKNOWN_ERROR);
    assert.notEqual(clasificaciones[0]?.reason, RAZON_UNKNOWN_LTP_AUSENTE);
  });

  it("DNPRC OK sin finca.ltp → ltp_ausente, no consulta_error", () => {
    const okSinLtp = detectHorizontalDivision({
      rawLtp: null,
      tipo: "detalle",
      error: null,
    });
    assert.equal(okSinLtp.reason, RAZON_UNKNOWN_LTP_AUSENTE);
    assert.equal(okSinLtp.evidence, null);
  });

  it("NO y YES no entran en el recuento de UNKNOWN", () => {
    const recuento = recuentoCausasUnknown([
      finca({ ref: "N0000000000001", status: "NO" }),
      finca({ ref: "Y0000000000001", status: "YES" }),
      {
        fincaReference: "U0000000000001",
        ltp: "Parcela rústica sin edificar",
        horizontalDivision: detectHorizontalDivision({ rawLtp: "Parcela rústica sin edificar" }),
      },
      {
        fincaReference: "U0000000000002",
        ltp: null,
        horizontalDivision: detectHorizontalDivision({ rawLtp: null }),
      },
      {
        fincaReference: "U0000000000003",
        ltp: null,
        horizontalDivision: detectHorizontalDivision({
          error: { codigo: "http", descripcion: "timeout" },
        }),
      },
    ]);
    assert.equal(recuento.unknownTotal, 3);
    assert.deepEqual(recuento.byReason, {
      consultaError: 1,
      ltpAusente: 1,
      ltpDesconocido: 1,
      otra: 0,
    });
    assert.deepEqual(recuento.byLtp, [{ ltp: "Parcela rústica sin edificar", count: 1 }]);
    assert.equal(recuento.catastroNoClasifica, 2);
    assert.equal(recuento.falloOperativo, 1);
  });
});
