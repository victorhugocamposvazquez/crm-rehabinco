import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { topePeticionesDiario } from "./presupuesto-unlocker";
import {
  creditosGratisMes,
  topePeticionesMensual,
  usdPresupuestoMes,
} from "./presupuesto-unlocker-math";

describe("presupuesto Unlocker", () => {
  it("5.000 créditos + 10 USD ≈ 11.666 peticiones/mes", () => {
    const prevC = process.env.CAPTACION_UNLOCKER_CREDITOS_GRATIS;
    const prevU = process.env.CAPTACION_UNLOCKER_USD_MES;
    const prevT = process.env.CAPTACION_UNLOCKER_TOPE_MES;
    delete process.env.CAPTACION_UNLOCKER_TOPE_MES;
    process.env.CAPTACION_UNLOCKER_CREDITOS_GRATIS = "5000";
    process.env.CAPTACION_UNLOCKER_USD_MES = "10";
    assert.equal(creditosGratisMes(), 5000);
    assert.equal(usdPresupuestoMes(), 10);
    assert.equal(topePeticionesMensual(), 11666);
    if (prevC === undefined) delete process.env.CAPTACION_UNLOCKER_CREDITOS_GRATIS;
    else process.env.CAPTACION_UNLOCKER_CREDITOS_GRATIS = prevC;
    if (prevU === undefined) delete process.env.CAPTACION_UNLOCKER_USD_MES;
    else process.env.CAPTACION_UNLOCKER_USD_MES = prevU;
    if (prevT === undefined) delete process.env.CAPTACION_UNLOCKER_TOPE_MES;
    else process.env.CAPTACION_UNLOCKER_TOPE_MES = prevT;
  });

  it("tope diario reparte el mes (30 días → ceil(11666/30))", () => {
    const sept = new Date(Date.UTC(2026, 8, 15));
    assert.equal(topePeticionesDiario(sept, 11666), 389);
  });
});
