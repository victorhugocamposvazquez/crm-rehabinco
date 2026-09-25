import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { simularListadoZonas } from "./simulacion-zonas";
import { zonasPorDefecto } from "./zonas";

describe("simulación listado zonas", () => {
  it("14 grandes ≈ 143 pág/día municipios + 1 provincia", () => {
    const s = simularListadoZonas(zonasPorDefecto(), {}, { topeMes: 11666, creditosGratis: 5000, usdMes: 10, usadasMes: 0, restantesMes: 11666 });
    assert.equal(s.paginasMunicipiosDia, 143);
    assert.equal(s.paginasDia, 144);
    assert.ok(s.dentroTope);
    assert.equal(s.usdTarifaListadoMes, 6.48);
  });
});
