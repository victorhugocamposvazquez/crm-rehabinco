import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decidirEarlyExit } from "./early-exit-decision";
import { acumularMetricas, metricasRafagaVacias } from "./metricas-rafaga";
import { INGESTA_PARALELO_DEFAULT } from "./rafaga-config";

describe("config optimización captación", () => {
  it("ingesta paralelo por defecto entre 1 y 5", () => {
    assert.ok(INGESTA_PARALELO_DEFAULT >= 1 && INGESTA_PARALELO_DEFAULT <= 5);
  });

  it("acumula métricas de fase", () => {
    const m = metricasRafagaVacias();
    acumularMetricas(m, { ms_descarga: 10, ms_parseo: 5, sin_cambios: 3, anuncios: 30 });
    acumularMetricas(m, { ms_descarga: 20, sin_cambios: 2, anuncios: 10 });
    assert.equal(m.ms_descarga, 30);
    assert.equal(m.ms_parseo, 5);
    assert.equal(m.sin_cambios, 5);
    assert.equal(m.anuncios, 40);
  });

  it("early-exit no salta el cierre de recogidas", () => {
    assert.deepEqual(decidirEarlyExit(true, false), { accion: "procesar" });
    assert.deepEqual(decidirEarlyExit(false, true), { accion: "cerrar_recogidas", motivo: "cola_vacia" });
    assert.deepEqual(decidirEarlyExit(false, false), { accion: "omitir_sin_lock", motivo: "cola_vacia" });
  });
});
