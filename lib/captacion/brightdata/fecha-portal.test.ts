import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  esEntradaHoy,
  esNuevoHoy,
  existiaAntesDePasada,
  fechaDeFiltro,
  fechaDeListadoDiario,
  filtroDeListado,
  filtroDiario,
  fusionarFechaPortal,
  parsearActualizadoIdealista,
  textoFechaPortal,
  urlConFiltroFecha,
} from "./fecha-portal";

const AHORA = new Date("2026-09-24T04:30:00.000Z");

describe("filtro de fecha de Idealista", () => {
  it("añade el segmento comprobado junto a particulares", () => {
    const url = urlConFiltroFecha("https://www.idealista.com/venta-viviendas/oleiros-a-coruna/", "24h");
    assert.equal(url, "https://www.idealista.com/venta-viviendas/oleiros-a-coruna/con-publicado_ultimas-24-horas/");
    assert.equal(filtroDeListado(url), "24h");
    assert.equal(
      urlConFiltroFecha("https://www.idealista.com/venta-viviendas/madrid-madrid/con-particulares/", "7d"),
      "https://www.idealista.com/venta-viviendas/madrid-madrid/con-publicado_ultima-semana/"
    );
  });

  it("no empeora la precisión y pone el centro de la franja", () => {
    const fina = fechaDeFiltro("24h", AHORA);
    assert.equal(fina.publicado_en_portal, "2026-09-23T16:30:00.000Z");
    const peor = fusionarFechaPortal(
      { publicado_en_portal: fina.publicado_en_portal, publicado_precision: "24h" },
      fechaDeFiltro("30d", AHORA)
    );
    assert.equal(peor.escrito, false);
    assert.equal(peor.publicado_precision, "24h");
    const exacta = fusionarFechaPortal(
      { publicado_en_portal: fina.publicado_en_portal, publicado_precision: "24h" },
      { publicado_en_portal: "2026-09-20T12:00:00.000Z", publicado_precision: "exacta" }
    );
    assert.equal(exacta.escrito, true);
    assert.equal(exacta.publicado_precision, "exacta");
  });

  it("en venta distingue 24 h y 48 h; en alquiler el filtro diario es 24 h", () => {
    const venta = "https://www.idealista.com/venta-viviendas/oleiros-a-coruna/con-particulares/";
    const alquiler = "https://www.idealista.com/alquiler-viviendas/oleiros-a-coruna/con-particulares/";
    assert.equal(filtroDiario(venta), "48h");
    assert.equal(filtroDiario(alquiler), "24h");
    const pasadaAyer = "2026-09-23T04:30:00.000Z";
    const nuevo = fechaDeListadoDiario("48h", AHORA, { venta: true, existiaAntes: existiaAntesDePasada(null, pasadaAyer) });
    assert.equal(nuevo.publicado_precision, "24h");
    assert.equal(nuevo.publicado_en_portal, "2026-09-23T16:30:00.000Z");
    const viejo = fechaDeListadoDiario("48h", AHORA, {
      venta: true,
      existiaAntes: existiaAntesDePasada("2026-09-22T04:30:00.000Z", pasadaAyer),
    });
    assert.equal(viejo.publicado_precision, "48h");
    assert.equal(viejo.publicado_en_portal, "2026-09-23T04:30:00.000Z");
    const alq = fechaDeListadoDiario("24h", AHORA, { venta: false, existiaAntes: true });
    assert.equal(alq.publicado_precision, "24h");
    assert.equal(esNuevoHoy(nuevo.publicado_precision, nuevo.publicado_en_portal, AHORA), true);
    assert.equal(esNuevoHoy(alq.publicado_precision, alq.publicado_en_portal, AHORA), true);
    assert.equal(esNuevoHoy(viejo.publicado_precision, viejo.publicado_en_portal, AHORA), false);
  });

  it("escribe la franja y marca nuevos de hoy solo con precisión 24h reciente", () => {
    assert.equal(
      textoFechaPortal({ publicado_en_portal: "2026-09-21T04:30:00.000Z", publicado_precision: "7d" }, AHORA),
      "Publicado en Idealista: hace 3 días (±3 días)"
    );
    assert.equal(esNuevoHoy("24h", "2026-09-23T16:30:00.000Z", AHORA), true);
    assert.equal(esNuevoHoy("48h", "2026-09-23T16:30:00.000Z", AHORA), false);
    assert.equal(esNuevoHoy("24h", "2026-09-20T04:30:00.000Z", AHORA), false);
    assert.equal(
      esEntradaHoy({ publicado_precision: "48h", publicado_en_portal: "2026-09-23T04:30:00.000Z", visto_primera_vez: "2026-09-24T08:00:00.000Z" }, AHORA),
      true
    );
  });

  it("lee Anuncio actualizado el …", () => {
    assert.equal(parsearActualizadoIdealista("Anuncio actualizado el 3 de marzo", AHORA), "2026-03-03T12:00:00.000Z");
    assert.equal(parsearActualizadoIdealista("23/09/2026", AHORA), "2026-09-23T12:00:00.000Z");
  });
});
