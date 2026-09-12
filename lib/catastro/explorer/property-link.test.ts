import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { etiquetaEstadoDivision } from "../search-ui";
import type { FincaDescubierta } from "../finca";
import { crearStoreMemoriaExplorer } from "./store";
import { recordDesdeFinca, resultadoDesdeFinca } from "./model";
import {
  actualizarDatosDesdeCatastro,
  coincideDhCatastro,
  coincideOrigenCatastral,
  crearOReutilizarPropiedad,
  datosPropiedadDesdeFinca,
  etiquetasVinculoPropiedad,
  fechasCatastroYProperty,
  filtrarPorVinculoPropiedad,
  fincaReferenceDesdeVinculo,
  frescuraInformacionCatastral,
  ofertanteParaAltaCatastro,
  puedeCrearPropiedadDesdeClasificacion,
  rutaPropiedadCrm,
  ERRORES_VINCULO_HTTP,
  ORIGEN_CATASTRO_EXPLORER,
} from "./index";
import { FILTROS_HISTORICOS } from "./history-ui";
import type { CatastroFinca } from "./types";
import type { CatastroPropertyIntegration, CatastroPropertyLink } from "./property-port";

function finca(
  ref14: string,
  status: FincaDescubierta["horizontalDivision"]["status"],
  extra: Partial<FincaDescubierta> = {}
): CatastroFinca {
  return {
    fincaReference: ref14,
    propertyReferences: [`${ref14}0001DI`],
    properties: [
      {
        reference: `${ref14}0001DI`,
        superficie: 120,
        anio: 1980,
        uso: "Residencial",
        unidades: [],
      },
    ],
    portals: ["3"],
    address: {
      provincia: "VALENCIA",
      municipio: "GODELLETA",
      sigla: "CL",
      via: "GUAYANA-MOJONERA",
      numero: "3",
    },
    postalCode: "46388",
    postalCodes: ["46388"],
    horizontalDivision: {
      status,
      confidence: status === "UNKNOWN" ? 0 : 1,
      reason: status,
      ...(status === "UNKNOWN" ? { reasonCode: "MIXED_URBAN_RURAL" as const } : {}),
    },
    ...extra,
  };
}

const GODELLETA = finca("2749704YJ0624N", "NO");
const UNKNOWN = finca("UNKNOWN0000001", "UNKNOWN");
const SUELO = finca("SUELO000000001", "NOT_APPLICABLE");
const YES = finca("YES00000000001", "YES");

function integrationMemoria(): CatastroPropertyIntegration & {
  created: CatastroPropertyLink[];
  ofertantes: string[];
  failCreate?: "PROPERTY_FAILED" | "LINK_FAILED" | "FAILED";
} {
  const links = new Map<string, CatastroPropertyLink>();
  const api: CatastroPropertyIntegration & {
    created: CatastroPropertyLink[];
    ofertantes: string[];
    failCreate?: "PROPERTY_FAILED" | "LINK_FAILED" | "FAILED";
  } = {
    created: [],
    ofertantes: [],
    async findLinksByFincaReference(fincaReference) {
      const link = links.get(fincaReference);
      return link ? [link] : [];
    },
    async findLinksByFincaReferences(fincaReferences) {
      return fincaReferences.map((ref) => links.get(ref)).filter((item): item is CatastroPropertyLink => Boolean(item));
    },
    async createPropertyFromCatastro(input) {
      if (!input.ofertanteId) return { ok: false, error: "OFERTANTE_REQUIRED" };
      if (api.failCreate) return { ok: false, error: api.failCreate };
      const existente = links.get(input.datos.fincaReference);
      if (existente) return { ok: true, created: false, link: existente };
      const link: CatastroPropertyLink = {
        fincaReference: input.datos.fincaReference,
        propertyId: `prop-${input.datos.fincaReference}`,
        source: ORIGEN_CATASTRO_EXPLORER,
        linkedAt: input.now,
      };
      links.set(link.fincaReference, link);
      api.created.push(link);
      api.ofertantes.push(input.ofertanteId);
      return { ok: true, created: true, link };
    },
  };
  return api;
}

describe("Catastro Explorer → Property", () => {
  it("1. crea una Property desde una finca persistida", async () => {
    const store = crearStoreMemoriaExplorer();
    await store.putFinca(recordDesdeFinca(GODELLETA, "2026-09-12T10:00:00.000Z"));
    const integration = integrationMemoria();
    const resultado = await crearOReutilizarPropiedad(store, integration, {
      fincaReference: GODELLETA.fincaReference,
      userId: "user-1",
      now: "2026-09-12T11:00:00.000Z",
      puedeCrear: true,
      ofertanteId: "cliente-1",
    });
    assert.equal(resultado.ok, true);
    if (!resultado.ok) return;
    assert.equal(resultado.created, true);
    assert.equal(resultado.link.fincaReference, "2749704YJ0624N");
    assert.equal(resultado.link.source, "CATASTRO_EXPLORER");
    assert.notEqual(resultado.link.propertyId, "2749704YJ0624N");
    assert.equal(integration.created.length, 1);
  });

  it("2. no duplica si la finca ya está vinculada", async () => {
    const store = crearStoreMemoriaExplorer();
    await store.putFinca(recordDesdeFinca(GODELLETA, "2026-09-12T10:00:00.000Z"));
    const integration = integrationMemoria();
    const primero = await crearOReutilizarPropiedad(store, integration, {
      fincaReference: GODELLETA.fincaReference,
      userId: "user-1",
      now: "2026-09-12T11:00:00.000Z",
      puedeCrear: true,
      ofertanteId: "cliente-1",
    });
    const segundo = await crearOReutilizarPropiedad(store, integration, {
      fincaReference: GODELLETA.fincaReference,
      userId: "user-1",
      now: "2026-09-12T11:01:00.000Z",
      puedeCrear: true,
      ofertanteId: "cliente-1",
    });
    assert.equal(primero.ok && primero.created, true);
    assert.equal(segundo.ok && segundo.created, false);
    if (primero.ok && segundo.ok) {
      assert.equal(segundo.link.propertyId, primero.link.propertyId);
    }
    assert.equal(integration.created.length, 1);
  });

  it("3-6. UNKNOWN, NOT_APPLICABLE, NO y YES pueden crear Property sin reinterpretar DH", async () => {
    for (const muestra of [UNKNOWN, SUELO, GODELLETA, YES]) {
      assert.equal(puedeCrearPropiedadDesdeClasificacion(muestra.horizontalDivision.status), true);
      const store = crearStoreMemoriaExplorer();
      await store.putFinca(recordDesdeFinca(muestra, "2026-09-12T10:00:00.000Z"));
      const resultado = await crearOReutilizarPropiedad(store, integrationMemoria(), {
        fincaReference: muestra.fincaReference,
        userId: "user-1",
        now: "2026-09-12T11:00:00.000Z",
        puedeCrear: true,
        ofertanteId: "cliente-1",
      });
      assert.equal(resultado.ok, true);
      const datos = datosPropiedadDesdeFinca(muestra);
      assert.equal(datos.horizontalDivision.status, muestra.horizontalDivision.status);
      if (muestra.horizontalDivision.status === "UNKNOWN") {
        assert.equal(datos.horizontalDivision.reasonCode, "MIXED_URBAN_RURAL");
        assert.equal(etiquetaEstadoDivision(datos.horizontalDivision.status), "NO DETERMINADO");
        assert.notEqual(etiquetaEstadoDivision(datos.horizontalDivision.status), "SIN DIVISIÓN HORIZONTAL");
      }
    }
  });

  it("7. 403 si el usuario no puede crear propiedades", async () => {
    const store = crearStoreMemoriaExplorer();
    await store.putFinca(recordDesdeFinca(GODELLETA, "2026-09-12T10:00:00.000Z"));
    const resultado = await crearOReutilizarPropiedad(store, integrationMemoria(), {
      fincaReference: GODELLETA.fincaReference,
      userId: "editor",
      now: "2026-09-12T11:00:00.000Z",
      puedeCrear: false,
    });
    assert.deepEqual(resultado, { ok: false, error: "FORBIDDEN" });
    assert.equal(ERRORES_VINCULO_HTTP.FORBIDDEN.status, 403);
  });

  it("8. 404 si la finca no está persistida", async () => {
    const resultado = await crearOReutilizarPropiedad(crearStoreMemoriaExplorer(), integrationMemoria(), {
      fincaReference: "NOEXISTE000001",
      userId: "user-1",
      now: "2026-09-12T11:00:00.000Z",
      puedeCrear: true,
      ofertanteId: "cliente-1",
    });
    assert.deepEqual(resultado, { ok: false, error: "NOT_FOUND" });
    assert.equal(ERRORES_VINCULO_HTTP.NOT_FOUND.status, 404);
  });

  it("9. fallo al crear Property", async () => {
    const store = crearStoreMemoriaExplorer();
    await store.putFinca(recordDesdeFinca(GODELLETA, "2026-09-12T10:00:00.000Z"));
    const integration = integrationMemoria();
    integration.failCreate = "PROPERTY_FAILED";
    const resultado = await crearOReutilizarPropiedad(store, integration, {
      fincaReference: GODELLETA.fincaReference,
      userId: "user-1",
      now: "2026-09-12T11:00:00.000Z",
      puedeCrear: true,
      ofertanteId: "cliente-1",
    });
    assert.deepEqual(resultado, { ok: false, error: "PROPERTY_FAILED" });
  });

  it("10. fallo al crear el vínculo", async () => {
    const store = crearStoreMemoriaExplorer();
    await store.putFinca(recordDesdeFinca(GODELLETA, "2026-09-12T10:00:00.000Z"));
    const integration = integrationMemoria();
    integration.failCreate = "LINK_FAILED";
    const resultado = await crearOReutilizarPropiedad(store, integration, {
      fincaReference: GODELLETA.fincaReference,
      userId: "user-1",
      now: "2026-09-12T11:00:00.000Z",
      puedeCrear: true,
      ofertanteId: "cliente-1",
    });
    assert.deepEqual(resultado, { ok: false, error: "LINK_FAILED" });
  });

  it("11. concurrencia: el adaptador idempotente deja una sola Property", async () => {
    const store = crearStoreMemoriaExplorer();
    await store.putFinca(recordDesdeFinca(GODELLETA, "2026-09-12T10:00:00.000Z"));
    const integration = integrationMemoria();
    const [a, b] = await Promise.all([
      crearOReutilizarPropiedad(store, integration, {
        fincaReference: GODELLETA.fincaReference,
        userId: "user-1",
        now: "2026-09-12T11:00:00.000Z",
        puedeCrear: true,
        ofertanteId: "cliente-1",
      }),
      crearOReutilizarPropiedad(store, integration, {
        fincaReference: GODELLETA.fincaReference,
        userId: "user-2",
        now: "2026-09-12T11:00:01.000Z",
        puedeCrear: true,
        ofertanteId: "cliente-1",
      }),
    ]);
    assert.equal(a.ok && b.ok, true);
    if (a.ok && b.ok) {
      assert.equal(a.link.propertyId, b.link.propertyId);
    }
    assert.equal(integration.created.length, 1);
  });

  it("12. el vínculo conserva fincaReference y source, no Property.id", () => {
    const link = {
      fincaReference: "2749704YJ0624N",
      propertyId: "11111111-2222-3333-4444-555555555555",
      source: ORIGEN_CATASTRO_EXPLORER,
      linkedAt: "2026-09-12T11:00:00.000Z",
    } as const;
    assert.equal(link.fincaReference.length, 14);
    assert.notEqual(link.propertyId, link.fincaReference);
    assert.equal(
      fincaReferenceDesdeVinculo({
        propertyId: link.propertyId,
        origen: "CATASTRO_EXPLORER",
        referenciaCatastral: link.fincaReference,
        link,
      }),
      "2749704YJ0624N"
    );
    assert.equal(
      fincaReferenceDesdeVinculo({
        propertyId: link.propertyId,
        origen: "MANUAL",
        referenciaCatastral: "otra",
        link: null,
      }),
      null
    );
    assert.equal(rutaPropiedadCrm(link.propertyId), `/propiedades/${link.propertyId}`);
  });

  it("13. el detalle conserva UNKNOWN como NO DETERMINADO", () => {
    const persistida = recordDesdeFinca(UNKNOWN, "2026-09-12T10:00:00.000Z");
    assert.equal(persistida.horizontalDivision.status, "UNKNOWN");
    assert.equal(etiquetaEstadoDivision(persistida.horizontalDivision.status), "NO DETERMINADO");
    assert.equal(coincideDhCatastro("UNKNOWN", "UNKNOWN"), true);
    assert.equal(coincideDhCatastro("UNKNOWN", "NO"), false);
    assert.equal(coincideOrigenCatastral("CATASTRO_EXPLORER", "CATASTRO_EXPLORER"), true);
    assert.equal(coincideOrigenCatastral("MANUAL", "UNLINKED"), true);
  });

  it("14. persistir un SearchResult no crea Property", async () => {
    const store = crearStoreMemoriaExplorer();
    const ahora = "2026-09-12T10:00:00.000Z";
    await store.putSearchResult(resultadoDesdeFinca("search-1", GODELLETA, ahora));
    const persist = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "persist.ts"), "utf8");
    const model = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "model.ts"), "utf8");
    assert.equal(persist.includes("property-link"), false);
    assert.equal(persist.includes("createPropertyFromCatastro"), false);
    assert.equal(model.includes("createPropertyFromCatastro"), false);
    assert.equal((await store.getSearchResult("search-1", GODELLETA.fincaReference))?.fincaReference, GODELLETA.fincaReference);
  });

  it("los filtros históricos de DH no cambian y el de vínculo es independiente", () => {
    assert.deepEqual(
      FILTROS_HISTORICOS.map((item) => item.value),
      ["ALL", "CANDIDATES", "UNKNOWN", "NOT_APPLICABLE", "REVIEW"]
    );
    const fincas = [GODELLETA, UNKNOWN].map((item) => ({ fincaReference: item.fincaReference }));
    const links: CatastroPropertyLink[] = [
      {
        fincaReference: GODELLETA.fincaReference,
        propertyId: "p1",
        source: ORIGEN_CATASTRO_EXPLORER,
        linkedAt: "2026-09-12T11:00:00.000Z",
      },
    ];
    assert.equal(filtrarPorVinculoPropiedad(fincas, links, "LINKED").length, 1);
    assert.equal(filtrarPorVinculoPropiedad(fincas, links, "UNLINKED")[0]?.fincaReference, UNKNOWN.fincaReference);
    assert.equal(etiquetasVinculoPropiedad([]).accion, "Crear propiedad");
    assert.equal(etiquetasVinculoPropiedad(links).badge, "VINCULADA A PROPERTY");
  });

  it("el alta desde Explorer respeta ofertante_id y no lo inventa", async () => {
    const store = crearStoreMemoriaExplorer();
    await store.putFinca(recordDesdeFinca(GODELLETA, "2026-01-01T08:00:00.000Z"));
    assert.equal(ofertanteParaAltaCatastro(""), null);
    assert.equal(ofertanteParaAltaCatastro(undefined), null);
    assert.equal(ofertanteParaAltaCatastro("cliente-1"), "cliente-1");
    assert.notEqual(ofertanteParaAltaCatastro("cliente-1"), "user-1");

    const sinOfertante = await crearOReutilizarPropiedad(store, integrationMemoria(), {
      fincaReference: GODELLETA.fincaReference,
      userId: "user-1",
      now: "2026-09-12T11:00:00.000Z",
      puedeCrear: true,
    });
    assert.deepEqual(sinOfertante, { ok: false, error: "OFERTANTE_REQUIRED" });
    assert.equal(ERRORES_VINCULO_HTTP.OFERTANTE_REQUIRED.status, 400);

    const integration = integrationMemoria();
    const creada = await crearOReutilizarPropiedad(store, integration, {
      fincaReference: GODELLETA.fincaReference,
      userId: "user-1",
      now: "2026-09-12T11:00:00.000Z",
      puedeCrear: true,
      ofertanteId: "cliente-1",
    });
    assert.equal(creada.ok, true);
    assert.deepEqual(integration.ofertantes, ["cliente-1"]);
    assert.equal(integration.ofertantes[0], "cliente-1");
    assert.notEqual(integration.ofertantes[0], "user-1");

    const repetida = await crearOReutilizarPropiedad(store, integration, {
      fincaReference: GODELLETA.fincaReference,
      userId: "user-1",
      now: "2026-09-12T12:00:00.000Z",
      puedeCrear: true,
    });
    assert.equal(repetida.ok && repetida.created, false);
    assert.equal(integration.created.length, 1);
  });

  it("lastSeenAt se conserva y es independiente de la fecha de creación de Property", async () => {
    const store = crearStoreMemoriaExplorer();
    await store.putFinca(recordDesdeFinca(GODELLETA, "2026-01-01T08:00:00.000Z"));
    const persistida = await store.getFinca(GODELLETA.fincaReference);
    const propertyCreatedAt = "2026-09-12T11:00:00.000Z";
    const fechas = fechasCatastroYProperty({
      lastSeenAt: persistida?.lastSeenAt,
      propertyCreatedAt,
    });
    assert.equal(fechas.ultimaInformacionCatastro, "2026-01-01T08:00:00.000Z");
    assert.equal(fechas.fechaCreacionProperty, propertyCreatedAt);
    assert.notEqual(fechas.ultimaInformacionCatastro, fechas.fechaCreacionProperty);
    await crearOReutilizarPropiedad(store, integrationMemoria(), {
      fincaReference: GODELLETA.fincaReference,
      userId: "user-1",
      now: propertyCreatedAt,
      puedeCrear: true,
      ofertanteId: "cliente-1",
    });
    assert.equal((await store.getFinca(GODELLETA.fincaReference))?.lastSeenAt, "2026-01-01T08:00:00.000Z");
  });

  it("actualizarDatosDesdeCatastro localiza la finca y no consulta Catastro", async () => {
    const store = crearStoreMemoriaExplorer();
    await store.putFinca(recordDesdeFinca(GODELLETA, "2026-01-01T08:00:00.000Z"));
    const resultado = await actualizarDatosDesdeCatastro(
      store,
      GODELLETA.fincaReference,
      "2026-09-12T11:00:00.000Z"
    );
    assert.equal(resultado.ok, true);
    if (!resultado.ok) return;
    assert.equal(resultado.executed, false);
    assert.equal(resultado.reason, "NOT_IMPLEMENTED");
    assert.equal(resultado.lastSeenAt, "2026-01-01T08:00:00.000Z");
    assert.equal(resultado.reciente, false);
    assert.equal(frescuraInformacionCatastral(resultado.lastSeenAt, "2026-01-02T08:00:00.000Z").etiqueta, "Reciente");
    assert.equal(
      (await actualizarDatosDesdeCatastro(store, "NOEXISTE000001", "2026-09-12T11:00:00.000Z")).ok,
      false
    );
    const fuente = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "property-link.ts"), "utf8");
    assert.equal(fuente.includes("from \"../client\""), false);
    assert.equal(fuente.includes("from \"../discovery\""), false);
    assert.equal(fuente.includes("ovcservweb"), false);
  });
});
