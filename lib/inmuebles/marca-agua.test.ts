import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { aplicarMarcaAgua } from "./marca-agua";
import {
  urlFotoConMarca,
  urlOrigenPermitida,
  urlsFotosConMarca,
  yaTieneMarca,
} from "./marca-agua-url";

const SUPABASE =
  "https://ohwcnfigexzgqpmwmbib.supabase.co/storage/v1/object/public/inmuebles/abc/foto.jpg";

describe("marca de agua", () => {
  it("solo admite fotos del bucket inmuebles", () => {
    assert.equal(urlOrigenPermitida(SUPABASE), true);
    assert.equal(urlOrigenPermitida("https://images.idealista.com/foto.jpg"), false);
    assert.equal(urlOrigenPermitida("https://evil.com/storage/v1/object/public/inmuebles/x.jpg"), false);
    assert.equal(urlOrigenPermitida("/local.jpg"), false);
  });

  it("envuelve la URL pública una sola vez", () => {
    const marcada = urlFotoConMarca(SUPABASE, "https://crm.rehabinco.es");
    assert.match(marcada, /^https:\/\/crm\.rehabinco\.es\/api\/media\/marca\?u=/);
    assert.equal(yaTieneMarca(marcada), true);
    assert.equal(urlFotoConMarca(marcada, "https://crm.rehabinco.es"), marcada);
    assert.equal(urlFotoConMarca("https://cdn.ejemplo/foto.jpg"), "https://cdn.ejemplo/foto.jpg");
  });

  it("marca la lista y deja fuera las externas", () => {
    const out = urlsFotosConMarca([SUPABASE, "https://cdn.ejemplo/a.jpg"], "https://web.rehabinco.es");
    assert.equal(out.length, 2);
    assert.match(out[0]!, /\/api\/media\/marca\?u=/);
    assert.equal(out[1], "https://cdn.ejemplo/a.jpg");
  });

  it("compone el logo sobre la foto", async () => {
    const base = await sharp({
      create: { width: 800, height: 600, channels: 3, background: { r: 40, g: 80, b: 120 } },
    })
      .jpeg()
      .toBuffer();
    const out = await aplicarMarcaAgua(base);
    const meta = await sharp(out).metadata();
    assert.equal(meta.format, "jpeg");
    assert.equal(meta.width, 800);
    assert.equal(meta.height, 600);
    assert.ok(out.length > 1000);
  });
});
