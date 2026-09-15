import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  esPathExterno,
  moverMedia,
  presentacionDeUrl,
  urlsDeFotosPortal,
  validarArchivoMedia,
} from "./media";

describe("media de inmueble", () => {
  it("embebe YouTube, Vimeo y Matterport", () => {
    const yt = presentacionDeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    assert.equal(yt?.kind, "iframe");
    if (yt?.kind === "iframe") assert.match(yt.src, /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);

    const vimeo = presentacionDeUrl("https://vimeo.com/123456789");
    assert.equal(vimeo?.kind, "iframe");
    if (vimeo?.kind === "iframe") assert.equal(vimeo.src, "https://player.vimeo.com/video/123456789");

    const mp = presentacionDeUrl("https://my.matterport.com/show/?m=AbC123");
    assert.equal(mp?.kind, "iframe");
    if (mp?.kind === "iframe") assert.match(mp.src, /m=AbC123/);
  });

  it("recoge thumbs y arrays de fotos del portal sin duplicar", () => {
    const urls = urlsDeFotosPortal({
      thumb: "https://img.idealista.com/a.jpg",
      fotos: ["https://img.idealista.com/a.jpg", { url: "https://img.idealista.com/b.jpg" }],
      raw: { thumbnailRetina: "https://img.idealista.com/c.jpg" },
    });
    assert.deepEqual(urls.sort(), [
      "https://img.idealista.com/a.jpg",
      "https://img.idealista.com/b.jpg",
      "https://img.idealista.com/c.jpg",
    ]);
  });

  it("no borra de Storage las fotos traídas del portal", () => {
    assert.equal(esPathExterno("externo/uuid"), true);
    assert.equal(esPathExterno("prop/foto.jpg"), false);
  });

  it("reordena fotos vecinas", () => {
    const next = moverMedia(
      [
        { id: "a", orden: 0 },
        { id: "b", orden: 1 },
        { id: "c", orden: 2 },
      ],
      "a",
      1
    );
    assert.deepEqual(
      next?.map((x) => x.id),
      ["b", "a", "c"]
    );
  });

  it("rechaza un plano que no es PDF ni imagen", () => {
    const file = new File(["x"], "notas.txt", { type: "text/plain" });
    assert.match(validarArchivoMedia("plano", file) ?? "", /plano/);
  });
});
