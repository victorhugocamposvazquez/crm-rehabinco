import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fotosDeGaleria, parsearFichaIdealista } from "./parse-ficha";

describe("ficha Idealista", () => {
  it("se queda con una URL XL-L por imagen y conserva /blur/", () => {
    const fotos = fotosDeGaleria([
      "https://img4.idealista.com/blur/480_360_mq/0/id.pro.es.image.master/7a/71/cc/1471462338.jpg",
      "https://img4.idealista.com/blur/WEB_DETAIL-XL-L/0/id.pro.es.image.master/7a/71/cc/1471462338.webp",
      "https://img4.idealista.com/blur/WEB_DETAIL/0/id.pro.es.image.master/aa/bb/cc/1454485949.jpg",
    ]);
    assert.equal(fotos.length, 2);
    assert.ok(fotos.every((url) => url.includes("/blur/WEB_DETAIL-XL-L/")));
    assert.equal(new Set(fotos.map((url) => url.match(/(\d{6,})\./)?.[1])).size, 2);
  });

  it("contrato de la ficha de ejemplo, sin teléfono", { skip: !existsSync(new URL("../../../tests/fixtures/idealista/ficha-ejemplo.html", import.meta.url)) }, () => {
    const html = readFileSync(new URL("../../../tests/fixtures/idealista/ficha-ejemplo.html", import.meta.url), "utf8");
    const ficha = parsearFichaIdealista(html, "https://www.idealista.com/inmueble/106716142/");
    assert.ok(ficha?.valida);
    assert.ok((ficha?.fotos.length ?? 0) > 0);
    assert.ok(ficha?.fotos.every((url) => /img\d\.idealista\.com/i.test(url) && url.includes("/blur/WEB_DETAIL-XL-L/")));
    assert.equal(JSON.stringify(ficha).includes("contact-phones"), false);
    assert.equal("telefono" in (ficha ?? {}), false);
  });
});