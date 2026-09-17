import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DOCUMENTO_PADDING, DOCUMENTO_PAGE_H } from "./documentos-pdf";
import {
  ALTURA_UTIL_PAGINA,
  MARGEN_SEGURIDAD_PAGINA,
  aplicarNegritas,
  empaquetarBloquesEnPaginas,
  encontrarPrimerHuecoRellenable,
  partirSegmentosPorPalabras,
  unirTextoFragmentos,
  type BloqueMedido,
} from "./documentos-paginacion";

function bloque(alto: number, opts?: Partial<BloqueMedido>): BloqueMedido {
  return { el: {} as HTMLElement, alto, evitarCorte: false, tituloSeccion: false, ...opts };
}

/** Simula un elemento con texto y unión, sin DOM. */
function fragmento(texto: string, union?: "br" | "sp"): HTMLElement {
  return { innerText: texto, textContent: texto, dataset: union ? { union } : {} } as unknown as HTMLElement;
}

describe("motor de paginación de documentos", () => {
  it("deja un margen de seguridad entre la medida y la hoja física", () => {
    assert.ok(MARGEN_SEGURIDAD_PAGINA >= 12, "al menos media línea de tolerancia");
    assert.equal(
      ALTURA_UTIL_PAGINA,
      DOCUMENTO_PAGE_H - DOCUMENTO_PADDING.top - DOCUMENTO_PADDING.bottom - MARGEN_SEGURIDAD_PAGINA
    );
    // Una hoja A4 real mide 297mm = 1122,5px; el contenido empaquetado tiene que caber siempre.
    const altoHojaReal = (297 / 25.4) * 96;
    assert.ok(ALTURA_UTIL_PAGINA + DOCUMENTO_PADDING.top + DOCUMENTO_PADDING.bottom < altoHojaReal);
  });

  it("estrés: cientos de bloques de tamaños variados nunca desbordan una hoja ni se pierden", () => {
    const medidas: BloqueMedido[] = [];
    let semilla = 7;
    const rnd = () => {
      semilla = (semilla * 9301 + 49297) % 233280;
      return semilla / 233280;
    };
    for (let i = 0; i < 400; i++) {
      const r = rnd();
      if (r < 0.1) medidas.push(bloque(30, { tituloSeccion: true }));
      else if (r < 0.15) medidas.push(bloque(120, { evitarCorte: true }));
      else medidas.push(bloque(20 + Math.floor(rnd() * 300)));
    }
    const pages = empaquetarBloquesEnPaginas(medidas);

    // Nada se pierde ni se duplica, y se conserva el orden.
    const planos = pages.flat();
    assert.equal(planos.length, medidas.length);
    planos.forEach((b, i) => assert.equal(b, medidas[i]));

    for (const page of pages) {
      const alto = page.reduce((s, b) => s + b.alto, 0);
      assert.ok(alto <= ALTURA_UTIL_PAGINA, `hoja de ${alto}px supera ${ALTURA_UTIL_PAGINA}px`);
      assert.ok(page.length > 0);
    }

    // Ningún título queda solo al final de una hoja si su párrafo cabía en la siguiente.
    for (let p = 0; p < pages.length - 1; p++) {
      const ultimo = pages[p][pages[p].length - 1];
      const primeroSig = pages[p + 1][0];
      if (ultimo.tituloSeccion && ultimo.alto + primeroSig.alto <= ALTURA_UTIL_PAGINA) {
        assert.fail(`título huérfano al final de la hoja ${p + 1}`);
      }
    }
  });

  it("un bloque más alto que la hoja va solo y no arrastra a los demás", () => {
    const gigante = bloque(ALTURA_UTIL_PAGINA * 2);
    const pages = empaquetarBloquesEnPaginas([bloque(100), gigante, bloque(100)]);
    assert.equal(pages.length, 3);
    assert.deepEqual(pages[1], [gigante]);
    assert.equal(encontrarPrimerHuecoRellenable([bloque(100), gigante])?.indiceBloque, 1);
  });

  it("partir por palabras conserva todo el texto, incluidas palabras larguísimas", () => {
    const texto = `Cláusula con una URL https://ejemplo.com/${"x".repeat(300)} y más texto después de la URL para terminar.`;
    const partes = partirSegmentosPorPalabras(texto, (s) => s.length <= 40);
    assert.ok(partes.length > 3);
    assert.ok(partes.every((p) => p.length <= 40));
    // Reunidas, recomponen el texto original (salvo espacios de corte de palabras).
    assert.equal(partes.join("").replace(/\s+/g, ""), texto.replace(/\s+/g, ""));
  });

  it("vuelve a poner en negrita los fragmentos al partir un párrafo, escapando el HTML", () => {
    const html = aplicarNegritas('Vende DON Juan & Cía <S.L.> a DOÑA Ana', ["DON Juan & Cía <S.L.>", "DOÑA Ana"]);
    assert.equal(
      html,
      "Vende <strong>DON Juan &amp; Cía &lt;S.L.&gt;</strong> a <strong>DOÑA Ana</strong>"
    );
  });

  it("reúne los fragmentos de una cláusula respetando dónde se cortó", () => {
    const texto = unirTextoFragmentos([
      fragmento("QUINTA: la parte compradora"),
      fragmento("perderá las arras entregadas.", "sp"),
      fragmento("Asimismo, la vendedora devolverá el doble.", "br"),
    ]);
    assert.equal(
      texto,
      "QUINTA: la parte compradora perderá las arras entregadas.\nAsimismo, la vendedora devolverá el doble."
    );
  });
});
