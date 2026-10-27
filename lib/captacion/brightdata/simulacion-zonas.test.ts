import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { simularListadoZonas } from "./simulacion-zonas";
import { zonasPorDefecto } from "./zonas";

describe("simulación listado zonas", () => {
  it("14 grandes: pasada completa + sondeos 15 min", () => {
    const abril = new Date(2026, 3, 15);
    const s = simularListadoZonas(
      zonasPorDefecto(),
      {},
      { topeMes: 50000, creditosGratis: 5000, usdMes: 50, usadasMes: 0, restantesMes: 50000 },
      abril
    );
    assert.equal(s.diasMes, 30);
    assert.equal(s.paginasMunicipiosDia, 143);
    assert.equal(s.paginasCompletaDia, 144);
    assert.equal(s.sondeosNovedadesDia, 96);
    assert.equal(s.paginasSondeoDia, 192);
    assert.equal(s.paginasDia, 336);
    assert.equal(s.usdTarifaCompletaMes, 6.48);
    assert.equal(s.usdTarifaSondeoMes, 8.64);
    assert.equal(s.usdTarifaListadoMes, 15.12);
    assert.equal(s.dentroTope, true);
  });

  it("sin zonas activas no cuenta sondeos", () => {
    const s = simularListadoZonas([], {}, { topeMes: 11666, creditosGratis: 5000, usdMes: 10, usadasMes: 0, restantesMes: 11666 });
    assert.equal(s.paginasDia, 0);
    assert.equal(s.sondeosNovedadesDia, 0);
  });
});
