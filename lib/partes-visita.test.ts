import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  contextoCatastralDesdeProperty,
  partirVisitasPorFecha,
  rutaNuevaVisitaDesdeProperty,
  visitaDesdePropertyExigePropiedad,
} from "./partes-visita";

describe("Property → Visit", () => {
  it("la visita se crea desde Property, no desde Catastro", () => {
    assert.equal(
      rutaNuevaVisitaDesdeProperty("11111111-2222-3333-4444-555555555555"),
      "/partes-visita/nuevo?propiedad=11111111-2222-3333-4444-555555555555"
    );
    assert.equal(rutaNuevaVisitaDesdeProperty("abc").includes("/catastro"), false);
    const raiz = dirname(fileURLToPath(import.meta.url));
    const puertos = readFileSync(join(raiz, "catastro/explorer/ports.ts"), "utf8");
    assert.equal(/from ["'][^"']*partes-visita/.test(puertos), false);
    assert.equal(/from ["'][^"']*Visit/.test(puertos), false);
    const vinculoUi = readFileSync(
      join(raiz, "../components/catastro/CatastroPropertyVinculo.tsx"),
      "utf8"
    );
    assert.equal(vinculoUi.includes("Nueva visita"), false);
    assert.equal(vinculoUi.includes("partes-visita"), false);
    assert.match(vinculoUi, /Crear propiedad|Ver propiedad/);
  });

  it("desde Property la visita exige propertyId; en otros flujos puede quedar huérfana", () => {
    assert.equal(visitaDesdePropertyExigePropiedad(true, ""), false);
    assert.equal(visitaDesdePropertyExigePropiedad(true, "prop-1"), true);
    assert.equal(visitaDesdePropertyExigePropiedad(false, ""), true);
    assert.equal(visitaDesdePropertyExigePropiedad(false, null), true);
  });

  it("el contexto catastral sale del vínculo y no copia la finca", () => {
    const conLink = contextoCatastralDesdeProperty({
      origen: "CATASTRO_EXPLORER",
      referenciaCatastral: "2749704YJ0624N",
      link: { fincaReference: "2749704YJ0624N" },
    });
    assert.deepEqual(conLink, { origen: "CATASTRO_EXPLORER", fincaReference: "2749704YJ0624N" });
    assert.equal(conLink && "properties" in conLink, false);
    assert.equal(conLink && "portals" in conLink, false);
    assert.equal(
      contextoCatastralDesdeProperty({ origen: "MANUAL", referenciaCatastral: "otra", link: null }),
      null
    );
  });

  it("parte próximas e historial por fecha de visita", () => {
    const { proximas, historial } = partirVisitasPorFecha(
      [
        { id: "pasada", fecha_visita: "2026-09-01" },
        { id: "hoy", fecha_visita: "2026-09-12" },
        { id: "futura", fecha_visita: "2026-09-20" },
        { id: "sin", fecha_visita: null },
      ],
      "2026-09-12"
    );
    assert.deepEqual(
      proximas.map((item) => item.id),
      ["hoy", "futura", "sin"]
    );
    assert.deepEqual(
      historial.map((item) => item.id),
      ["pasada"]
    );
  });
});
