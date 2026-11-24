import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canalDeTipo, canalesVisibles, itemPermitido, prefsCompletas, CANALES_AVISO, PREFS_AVISO_DEFAULT } from "./prefs";

describe("prefs de avisos", () => {
  it("sin fila guarda todo activo", () => {
    assert.deepEqual(prefsCompletas(null), PREFS_AVISO_DEFAULT);
  });

  it("completa huecos y no inventa canales", () => {
    const prefs = prefsCompletas({ visitas: false, tareas_vencidas: true, menciones: false });
    assert.equal(prefs.visitas, false);
    assert.equal(prefs.menciones, false);
    assert.equal(prefs.recordatorios, true);
    assert.equal(prefs.agenda, true);
  });

  it("separa visitas, recordatorios, agenda, tareas, menciones y partes", () => {
    assert.equal(canalDeTipo("visita"), "visitas");
    assert.equal(canalDeTipo("recordatorio"), "recordatorios");
    assert.equal(canalDeTipo("llamada"), "agenda");
    assert.equal(canalDeTipo("evento"), "agenda");
    assert.equal(canalDeTipo("tarea"), "tareas_hoy");
    assert.equal(canalDeTipo("tarea-vencida"), "tareas_vencidas");
    assert.equal(canalDeTipo("mencion"), "menciones");
    assert.equal(canalDeTipo("parte"), "partes");
    assert.equal(canalDeTipo("soporte"), "soporte");
  });

  it("marketing solo elige el aviso de sus diseños", () => {
    const canales = canalesVisibles("marketing");
    assert.deepEqual(canales.map((canal) => canal.id), ["estudio"]);
    assert.match(canales[0]!.hint, /aprueba/);
    assert.equal(canalesVisibles("comercial").length, CANALES_AVISO.length);
  });

  it("respeta el interruptor del canal", () => {
    const prefs = prefsCompletas({ visitas: false, recordatorios: false, menciones: true });
    assert.equal(itemPermitido("visita", prefs), false);
    assert.equal(itemPermitido("recordatorio", prefs), false);
    assert.equal(itemPermitido("llamada", prefs), true);
    assert.equal(itemPermitido("mencion", prefs), true);
  });
});
