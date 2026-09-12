import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FincaDescubierta } from "../finca";
import { LONGITUD_FINCA, LONGITUD_INMUEBLE, getFincaReference } from "../references";
import { marcarRevision, REVISION_VACIA } from "../revision-comercial";
import {
  actualizarBusqueda,
  crearBusqueda,
  criteriosHaciaCatastro,
  estadoDesdeZona,
  identidadFinca,
  ordenarBusquedasRecientes,
  recordDesdeFinca,
  resultadoDesdeFinca,
  resumenBusquedaReciente,
  revisionNoCambiaClasificacion,
  tituloBusquedaReciente,
  totalesDesdeFincas,
  validarCriteriosExplorer,
} from "./model";
import { crearStoreMemoriaExplorer, registrarDescubrimiento } from "./store";
import type { CatastroFinca } from "./types";

function finca(
  ref14: string,
  status: FincaDescubierta["horizontalDivision"]["status"],
  extra: Partial<FincaDescubierta> = {}
): CatastroFinca {
  return {
    fincaReference: ref14,
    propertyReferences: [`${ref14}0001AA`],
    properties: [],
    portals: ["1"],
    address: {
      provincia: "VALENCIA",
      municipio: "GODELLETA",
      sigla: "CL",
      via: "DEMO",
      numero: "1",
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

const MIXTO = finca("MIXMIXMIXMIXMI", "UNKNOWN");
const CANDIDATO = finca("2749704YJ0624N", "NO");
const CON_DH = finca("0751301VK4705B", "YES");
const SUELO = finca("5472105YJ0657S", "NOT_APPLICABLE");

describe("Catastro Explorer — frontera y modelo", () => {
  it("CatastroFinca es FincaDescubierta: no hay un segundo modelo", () => {
    const descubierta: FincaDescubierta = CANDIDATO;
    const canonica: CatastroFinca = descubierta;
    assert.equal(canonica.fincaReference, "2749704YJ0624N");
    assert.equal(canonica.fincaReference.length, LONGITUD_FINCA);
    assert.equal(canonica.propertyReferences[0]?.length, LONGITUD_INMUEBLE);
    assert.equal(identidadFinca("2749704YJ0624N0001AA"), "2749704YJ0624N");
    assert.equal(getFincaReference("2749704YJ0624N0001AA"), canonica.fincaReference);
    assert.notEqual(canonica.fincaReference, canonica.propertyReferences[0]);
  });

  it("la dirección canónica solo admite campos oficiales", () => {
    const dir = CANDIDATO.address;
    assert.equal(dir.provincia, "VALENCIA");
    assert.equal(dir.municipio, "GODELLETA");
    assert.equal(dir.sigla, "CL");
    assert.equal(dir.via, "DEMO");
    assert.equal(dir.numero, "1");
    assert.equal("lat" in dir, false);
    assert.equal("lng" in dir, false);
    assert.equal("geocode" in dir, false);
    assert.equal("google" in dir, false);
  });

  it("STREET y POSTAL_CODE; el CP no se envía a Catastro", () => {
    const calle = validarCriteriosExplorer({
      mode: "STREET",
      provincia: "VALENCIA",
      municipio: "GODELLETA",
      sigla: "CL",
      via: "GUAYANA-MOJONERA",
      numero: "3",
      horizontalDivision: "NO",
    });
    const zona = validarCriteriosExplorer({
      mode: "POSTAL_CODE",
      provincia: "VALENCIA",
      municipio: "GODELLETA",
      postalCode: "46388",
      horizontalDivision: "ALL",
    });
    assert.equal(calle.ok, true);
    assert.equal(zona.ok, true);
    assert.deepEqual(
      criteriosHaciaCatastro({
        mode: "POSTAL_CODE",
        provincia: "VALENCIA",
        municipio: "GODELLETA",
        postalCode: "46388",
        horizontalDivision: "NO",
      }),
      { enviaCodigoPostalACatastro: false, recorreCallejero: true }
    );
    assert.equal(
      validarCriteriosExplorer({
        mode: "POSTAL_CODE",
        provincia: "VALENCIA",
        municipio: "GODELLETA",
        postalCode: "4638",
        horizontalDivision: "NO",
      }).ok,
      false
    );
  });

  it("los totales separan candidatos, YES, UNKNOWN y NOT_APPLICABLE", () => {
    const totals = totalesDesdeFincas([MIXTO, CANDIDATO, CON_DH, SUELO]);
    assert.deepEqual(totals, {
      fincas: 4,
      candidates: 1,
      yes: 1,
      unknown: 1,
      notApplicable: 1,
    });
  });

  it("deduplica una finca global con dos SearchResult", async () => {
    const store = crearStoreMemoriaExplorer();
    const a = crearBusqueda({
      id: "search-a",
      ownerId: "user-1",
      now: "2026-09-12T10:00:00.000Z",
      criteria: {
        mode: "STREET",
        provincia: "VALENCIA",
        municipio: "GODELLETA",
        sigla: "CL",
        via: "DEMO",
        horizontalDivision: "ALL",
      },
    });
    const b = crearBusqueda({
      id: "search-b",
      ownerId: "user-1",
      now: "2026-09-12T11:00:00.000Z",
      criteria: {
        mode: "POSTAL_CODE",
        provincia: "VALENCIA",
        municipio: "GODELLETA",
        postalCode: "46388",
        horizontalDivision: "ALL",
      },
    });
    await store.putSearch(a);
    await store.putSearch(b);
    const primero = await registrarDescubrimiento(store, a, CANDIDATO, "2026-09-12T10:01:00.000Z");
    const segundo = await registrarDescubrimiento(
      store,
      b,
      { ...CANDIDATO, portals: ["3"] },
      "2026-09-12T11:01:00.000Z"
    );
    assert.equal(primero.finca.fincaReference, segundo.finca.fincaReference);
    assert.equal((await store.getFinca(CANDIDATO.fincaReference))?.fincaReference, "2749704YJ0624N");
    assert.deepEqual((await store.getFinca(CANDIDATO.fincaReference))?.portals, ["1", "3"]);
    assert.equal((await store.listResultsByFinca(CANDIDATO.fincaReference)).length, 2);
    assert.equal(segundo.finca.firstSeenAt, "2026-09-12T10:01:00.000Z");
    assert.equal(segundo.finca.lastSeenAt, "2026-09-12T11:01:00.000Z");
    const result = resultadoDesdeFinca(a.id, MIXTO, "2026-09-12T10:02:00.000Z");
    assert.equal("properties" in result, false);
    assert.equal("ltp" in result, false);
    assert.equal(result.classificationAtDiscovery.status, "UNKNOWN");
    assert.equal(result.classificationAtDiscovery.reasonCode, "MIXED_URBAN_RURAL");
  });

  it("REVIEW no convierte UNKNOWN en NO ni en candidato", () => {
    const revision = marcarRevision(REVISION_VACIA, MIXTO, "clave");
    assert.equal(revision.fincas[0]?.horizontalDivision?.status, "UNKNOWN");
    assert.equal(revisionNoCambiaClasificacion("UNKNOWN", "REVIEW"), "UNKNOWN");
    assert.notEqual(revisionNoCambiaClasificacion("UNKNOWN", "REVIEW"), "NO");
    assert.equal(totalesDesdeFincas([MIXTO]).candidates, 0);
    assert.equal(totalesDesdeFincas([MIXTO]).unknown, 1);
  });

  it("búsquedas recientes por updatedAt DESC, sin pantalla", () => {
    const godelleta = actualizarBusqueda(
      crearBusqueda({
        id: "zona-godelleta",
        ownerId: "user-1",
        now: "2026-09-12T08:00:00.000Z",
        criteria: {
          mode: "POSTAL_CODE",
          provincia: "VALENCIA",
          municipio: "GODELLETA",
          postalCode: "46388",
          horizontalDivision: "NO",
        },
      }),
      {
        status: "COMPLETED",
        totals: { fincas: 3031, candidates: 1888, yes: 0, unknown: 0, notApplicable: 0 },
        now: "2026-09-12T18:00:00.000Z",
      }
    );
    const madrid = actualizarBusqueda(
      crearBusqueda({
        id: "calle-fuencarral",
        ownerId: "user-1",
        now: "2026-09-11T08:00:00.000Z",
        criteria: {
          mode: "STREET",
          provincia: "MADRID",
          municipio: "MADRID",
          sigla: "CL",
          via: "FUENCARRAL",
          horizontalDivision: "NO",
        },
      }),
      { now: "2026-09-11T12:00:00.000Z" }
    );
    const recientes = ordenarBusquedasRecientes([madrid, godelleta]);
    assert.deepEqual(
      recientes.map((item) => item.id),
      ["zona-godelleta", "calle-fuencarral"]
    );
    assert.equal(tituloBusquedaReciente(godelleta), "GODELLETA · CP 46388");
    assert.deepEqual(resumenBusquedaReciente(godelleta), {
      titulo: "GODELLETA · CP 46388",
      fincas: 3031,
      candidatas: 1888,
      status: "COMPLETED",
      updatedAt: "2026-09-12T18:00:00.000Z",
    });
  });

  it("el record conserva firstSeenAt al fusionar", () => {
    const primero = recordDesdeFinca(CANDIDATO, "2026-09-01T00:00:00.000Z");
    const segundo = recordDesdeFinca({ ...CANDIDATO, portals: ["5"] }, "2026-09-12T00:00:00.000Z", primero);
    assert.equal(segundo.firstSeenAt, "2026-09-01T00:00:00.000Z");
    assert.equal(segundo.lastSeenAt, "2026-09-12T00:00:00.000Z");
    assert.deepEqual(segundo.portals, ["1", "5"]);
    assert.equal(segundo.horizontalDivision.status, "NO");
  });

  it("mapea el estado de zona al de Explorer", () => {
    assert.equal(estadoDesdeZona("prepared"), "PREPARED");
    assert.equal(estadoDesdeZona("running"), "RUNNING");
    assert.equal(estadoDesdeZona("upstream_paused"), "PAUSED");
    assert.equal(estadoDesdeZona("done"), "COMPLETED");
    assert.equal(estadoDesdeZona("cancelled"), "CANCELLED");
  });
});
