import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { soporteAvisos, versionIos } from "./pwa-soporte";

const IPHONE_18 =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const IPHONE_16_3 =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Mobile/15E148 Safari/604.1";

describe("soporte de avisos en el móvil", () => {
  it("lee la versión de iOS del iPhone", () => {
    assert.deepEqual(versionIos(IPHONE_18), { major: 18, minor: 5 });
    assert.equal(versionIos("Mozilla/5.0 (Macintosh)"), null);
  });

  it("en la pestaña de Safari del iPhone pide la pantalla de inicio", () => {
    const soporte = soporteAvisos({
      ua: IPHONE_18,
      notification: false,
      serviceWorker: true,
      pushManager: false,
      instalada: false,
    });
    assert.deepEqual(soporte, { ok: false, motivo: "ios-pestana" });
  });

  it("desde el icono de la pantalla de inicio deja activar", () => {
    const soporte = soporteAvisos({
      ua: IPHONE_18,
      notification: true,
      serviceWorker: true,
      pushManager: true,
      instalada: true,
    });
    assert.deepEqual(soporte, { ok: true });
  });

  it("un iPhone anterior a 16.4 no tiene avisos", () => {
    const soporte = soporteAvisos({
      ua: IPHONE_16_3,
      notification: false,
      serviceWorker: true,
      pushManager: false,
      instalada: true,
    });
    assert.deepEqual(soporte, { ok: false, motivo: "ios-antiguo" });
  });

  it("un navegador de escritorio sin push no se confunde con el iPhone", () => {
    const soporte = soporteAvisos({
      ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      notification: false,
      serviceWorker: false,
      pushManager: false,
      instalada: false,
    });
    assert.deepEqual(soporte, { ok: false, motivo: "sin-push" });
  });
});
