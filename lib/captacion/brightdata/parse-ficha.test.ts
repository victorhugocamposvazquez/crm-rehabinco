import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

  it("contrato de la ficha de ejemplo, sin teléfono", () => {
    const html = readFileSync(new URL("../../../tests/fixtures/idealista/ficha-ejemplo.html", import.meta.url), "utf8");
    const ficha = parsearFichaIdealista(html, "https://www.idealista.com/inmueble/112637603/");
    const ano = new Date().getFullYear();
    const ids = (ficha?.fotos ?? []).map((url) => (url.match(/id\.pro\.es\.image\.master\/([a-z0-9]{2}\/[a-z0-9]{2}\/[a-z0-9]{2}\/\d+)\.jpg$/) || [])[1]);
    assert.ok(ficha?.valida);
    assert.equal(ids.length, 27);
    assert.equal(new Set(ids).size, 27);
    assert.deepEqual(
      ficha?.fotos,
      ids.map((id) => `https://img4.idealista.com/blur/WEB_DETAIL-XL-L/0/id.pro.es.image.master/${id}.jpg`)
    );
    assert.equal(ficha?.fotos.some((url) => url.includes("WEB_DETAIL_TOP")), false);
    assert.equal(ficha?.banos, 2);
    assert.equal(ficha?.actualizado, new Date(Date.UTC(ano, 8, 24, 12)).toISOString());
    assert.equal(ficha?.contact_name == null || typeof ficha.contact_name === "string", true);
    assert.ok((ficha?.descripcion ?? "").length > 0);
    assert.equal(JSON.stringify(ficha).includes("contact-phones"), false);
    assert.equal("telefono" in (ficha ?? {}), false);
  });
});