import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { demandasSinMatching, stockPorComercial, visitasEnSemana } from "./informes";

describe("informes de operación", () => {
  it("cuenta visitas de la semana", () => {
    assert.equal(
      visitasEnSemana(
        [
          { comercialId: "a", fechaVisita: "2026-09-15", estado: "firmado" },
          { comercialId: "a", fechaVisita: "2026-09-22", estado: "firmado" },
        ],
        "2026-09-14",
        "2026-09-20"
      ),
      1
    );
  });

  it("agrupa stock por comercial", () => {
    const r = stockPorComercial([
      { comercialId: "a", comercialNombre: "Ana", estado: "disponible" },
      { comercialId: "a", comercialNombre: "Ana", estado: "vendida" },
      { comercialId: "b", comercialNombre: "Brais", estado: "disponible" },
    ]);
    assert.equal(r[0]?.nombre, "Ana");
    assert.equal(r[0]?.total, 2);
    assert.equal(r[0]?.disponibles, 1);
  });

  it("detecta demandas sin cruce", () => {
    assert.equal(
      demandasSinMatching([
        { id: "1", matches: 0 },
        { id: "2", matches: 3 },
      ]),
      1
    );
  });
});
