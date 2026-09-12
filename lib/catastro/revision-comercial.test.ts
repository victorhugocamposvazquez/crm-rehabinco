import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clasificarCandidatos,
  getNonHorizontalDivisionFincas,
} from "./candidates";
import type { FincaBusquedaUi } from "./search-ui";
import { etiquetaEstadoDivision, textoMotivoUnknownUi } from "./search-ui";
import {
  COLUMNAS_CSV,
  SELECCION_VACIA,
  alternarSeleccion,
  csvDesdeFincas,
  detalleFinca,
  estaSeleccionada,
  filaCsvDesdeFinca,
  nombreArchivoExportacion,
  prepararExportacionCsv,
  prepararExportacionRevisionCsv,
  seleccionParaBusqueda,
} from "./selection-export";
import {
  FILTROS_REVISION_COMERCIAL,
  REVISION_VACIA,
  alternarRevision,
  estadoRevisionDe,
  estaEnRevision,
  filtrarPorRevisionComercial,
  etiquetaEstadoComercial,
  limpiarRevision,
  marcarRevision,
  puedeMarcarseRevision,
  quitarRevision,
  revisionParaBusqueda,
  textoBarraSeleccionYRevision,
  textoRevision,
  textoRevisionUi,
} from "./revision-comercial";

const CLAVE = "VALENCIA|GODELLETA|CL|DEMO|||ALL";
const OTRA = "VALENCIA|GODELLETA|CL|OTRA|||ALL";

function finca(
  ref: string,
  status: "YES" | "NO" | "UNKNOWN" | "NOT_APPLICABLE",
  extra: Partial<FincaBusquedaUi> = {}
): FincaBusquedaUi {
  return {
    fincaReference: ref,
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
      ...(status === "UNKNOWN" ? { reasonCode: "MIXED_URBAN_RURAL" } : {}),
    },
    ...extra,
  };
}

const MIXTO = finca("MIXMIXMIXMIXMI", "UNKNOWN");
const CANDIDATO = finca("2749704YJ0624N", "NO");
const CON_DH = finca("0751301VK4705B", "YES");
const SUELO = finca("5472105YJ0657S", "NOT_APPLICABLE");

describe("revisión comercial (UNKNOWN)", () => {
  it("1. marcar UNKNOWN para revisar", () => {
    const revision = marcarRevision(REVISION_VACIA, MIXTO, CLAVE);
    assert.equal(estaEnRevision(revision, MIXTO.fincaReference), true);
    assert.equal(estadoRevisionDe(revision, MIXTO.fincaReference), "REVIEW");
    assert.equal(puedeMarcarseRevision(MIXTO), true);
  });

  it("2. quitar revisión", () => {
    const marcada = marcarRevision(REVISION_VACIA, MIXTO, CLAVE);
    const quitada = quitarRevision(marcada, MIXTO.fincaReference, CLAVE);
    assert.equal(estaEnRevision(quitada, MIXTO.fincaReference), false);
    assert.equal(estadoRevisionDe(quitada, MIXTO.fincaReference), "NONE");
    assert.equal(alternarRevision(marcada, MIXTO, CLAVE).fincas.length, 0);
  });

  it("3. no cambia horizontalDivision", () => {
    const antes = MIXTO.horizontalDivision?.status;
    const revision = marcarRevision(REVISION_VACIA, MIXTO, CLAVE);
    assert.equal(MIXTO.horizontalDivision?.status, antes);
    assert.equal(MIXTO.horizontalDivision?.status, "UNKNOWN");
    assert.equal(revision.fincas[0]?.horizontalDivision?.status, "UNKNOWN");
    assert.notEqual(etiquetaEstadoDivision(MIXTO.horizontalDivision?.status), "SIN DIVISIÓN HORIZONTAL");
  });

  it("4. persiste entre páginas por fincaReference, no por índice", () => {
    const pagina1 = [MIXTO, CANDIDATO];
    const pagina2 = [CON_DH];
    let revision = marcarRevision(REVISION_VACIA, pagina1[0], CLAVE);
    assert.equal(estaEnRevision(revision, MIXTO.fincaReference), true);
    assert.equal(estaEnRevision(revision, pagina2[0].fincaReference), false);
    revision = revisionParaBusqueda(revision, CLAVE);
    assert.equal(revision.fincas[0]?.fincaReference, MIXTO.fincaReference);
    assert.equal(revision.fincas.some((item, indice) => indice === 0 && item.fincaReference !== MIXTO.fincaReference), false);
  });

  it("5. limpiar al cambiar búsqueda; no mezcla revisiones", () => {
    const revision = marcarRevision(REVISION_VACIA, MIXTO, CLAVE);
    assert.equal(revisionParaBusqueda(revision, CLAVE).fincas.length, 1);
    assert.equal(revisionParaBusqueda(revision, OTRA).fincas.length, 0);
    assert.deepEqual(limpiarRevision(), REVISION_VACIA);
  });

  it("6. filtro Para revisar es local y no incluye candidatos", () => {
    const revision = marcarRevision(REVISION_VACIA, MIXTO, CLAVE);
    const visibles = [MIXTO, CANDIDATO, CON_DH, SUELO];
    assert.deepEqual(
      FILTROS_REVISION_COMERCIAL.map((item) => item.label),
      ["Todos", "Candidatos confirmados", "Para revisar"]
    );
    assert.deepEqual(
      filtrarPorRevisionComercial(visibles, "REVIEW", revision).map((item) => item.fincaReference),
      [MIXTO.fincaReference]
    );
    assert.deepEqual(
      filtrarPorRevisionComercial(visibles, "CANDIDATES", revision).map((item) => item.fincaReference),
      [CANDIDATO.fincaReference]
    );
    assert.equal(filtrarPorRevisionComercial(visibles, "ALL", revision).length, 4);
  });

  it("7 y 8. CSV de revisión y CSV normal con Estado comercial", () => {
    const revision = marcarRevision(REVISION_VACIA, MIXTO, CLAVE);
    const csvRevision = csvDesdeFincas(revision.fincas, revision);
    const filaReview = filaCsvDesdeFinca(MIXTO, revision);
    assert.ok(COLUMNAS_CSV.includes("Estado comercial"));
    assert.equal(filaReview["División horizontal"], "NO DETERMINADO");
    assert.equal(filaReview["Estado comercial"], "Para revisar");
    assert.equal(filaReview.Motivo, "Parcela urbano-rústica");
    assert.equal(csvRevision.includes("SIN DIVISIÓN HORIZONTAL"), false);
    assert.equal(csvRevision.includes("sin división horizontal"), false);

    const csvNo = csvDesdeFincas([CANDIDATO]);
    assert.equal(filaCsvDesdeFinca(CANDIDATO)["Estado comercial"], "Candidato confirmado");
    assert.equal(filaCsvDesdeFinca(CANDIDATO)["División horizontal"], "SIN DIVISIÓN HORIZONTAL");
    assert.match(csvNo, /Candidato confirmado/);
    assert.equal(filaCsvDesdeFinca(CON_DH)["Estado comercial"], "Sin marcar");
    assert.equal(filaCsvDesdeFinca(SUELO)["Estado comercial"], "Sin marcar");
    assert.equal(filaCsvDesdeFinca(MIXTO)["Estado comercial"], "Sin marcar");

    const exclusiva = prepararExportacionRevisionCsv({
      revision,
      criterios: { municipio: "GODELLETA", via: "DEMO", numero: "", horizontalDivision: "ALL" },
      cobertura: { completeCandidates: true, possibleCut: false },
      fecha: new Date(2026, 8, 12),
    });
    assert.equal(exclusiva.ok, true);
    if (exclusiva.ok) {
      assert.equal(exclusiva.totalFincas, 1);
      assert.match(exclusiva.nombreArchivo, /fincas_para_revisar_Godelleta_Demo_2026-09-12\.csv/);
      assert.match(exclusiva.contenido, /MIXMIXMIXMIXMI/);
      assert.equal(exclusiva.contenido.includes("2749704YJ0624N"), false);
    }
    const vacia = prepararExportacionRevisionCsv({
      revision: REVISION_VACIA,
      criterios: { municipio: "GODELLETA", via: "DEMO", numero: "", horizontalDivision: "ALL" },
      cobertura: { completeCandidates: true, possibleCut: false },
    });
    assert.equal(vacia.ok, false);
  });

  it("9. NO nunca aparece como UNKNOWN", () => {
    const revision = marcarRevision(REVISION_VACIA, CANDIDATO, CLAVE);
    assert.equal(CANDIDATO.horizontalDivision?.status, "NO");
    assert.equal(estaEnRevision(revision, CANDIDATO.fincaReference), false);
    assert.equal(puedeMarcarseRevision(CANDIDATO), false);
    assert.notEqual(CANDIDATO.horizontalDivision?.status, "UNKNOWN");
  });

  it("10. REVIEW no convierte UNKNOWN en candidato", () => {
    marcarRevision(REVISION_VACIA, MIXTO, CLAVE);
    assert.equal(MIXTO.horizontalDivision?.status, "UNKNOWN");
    const dominio = {
      fincaReference: MIXTO.fincaReference,
      propertyReferences: [],
      properties: [],
      portals: ["1"],
      address: { provincia: "VALENCIA", municipio: "GODELLETA", sigla: "CL", via: "DEMO" },
      postalCode: "46388",
      postalCodes: ["46388"],
      horizontalDivision: { status: "UNKNOWN" as const, confidence: 0, reason: "UNKNOWN" },
    };
    const result = clasificarCandidatos([dominio], {
      complete: true,
      hasNextPage: false,
      possibleCut: false,
      portalErrors: 0,
    });
    assert.equal(result.withoutHorizontalDivision.length, 0);
    assert.equal(getNonHorizontalDivisionFincas([dominio], {
      complete: true,
      hasNextPage: false,
      possibleCut: false,
      portalErrors: 0,
    }).length, 0);
    assert.equal(result.unknown.length, 1);
    assert.equal(result.completeCandidates, false);
    assert.equal(
      filtrarPorRevisionComercial([MIXTO], "CANDIDATES", marcarRevision(REVISION_VACIA, MIXTO, CLAVE)).length,
      0
    );
  });

  it("11. selección y revisión son independientes", () => {
    let seleccion = alternarSeleccion(SELECCION_VACIA, MIXTO, CLAVE);
    let revision = marcarRevision(REVISION_VACIA, MIXTO, CLAVE);
    assert.equal(estaSeleccionada(seleccion, MIXTO.fincaReference), true);
    assert.equal(estaEnRevision(revision, MIXTO.fincaReference), true);
    seleccion = alternarSeleccion(seleccion, MIXTO, CLAVE);
    assert.equal(estaSeleccionada(seleccion, MIXTO.fincaReference), false);
    assert.equal(estaEnRevision(revision, MIXTO.fincaReference), true);
    revision = quitarRevision(revision, MIXTO.fincaReference, CLAVE);
    seleccion = alternarSeleccion(seleccion, CANDIDATO, CLAVE);
    assert.equal(estaSeleccionada(seleccion, CANDIDATO.fincaReference), true);
    assert.equal(estaEnRevision(revision, CANDIDATO.fincaReference), false);
    assert.equal(seleccionParaBusqueda(seleccion, CLAVE).fincas.length, 1);
  });

  it("12. detalle muestra reasonCode y no etiqueta REVIEW como candidato", () => {
    const revision = marcarRevision(REVISION_VACIA, MIXTO, CLAVE);
    const detalle = detalleFinca(MIXTO, revision);
    assert.equal(detalle.general.find((item) => item.label === "División horizontal")?.value, "NO DETERMINADO");
    assert.equal(detalle.general.find((item) => item.label === "Motivo")?.value, "Parcela urbano-rústica");
    assert.equal(detalle.general.find((item) => item.label === "Estado comercial")?.value, "Para revisar");
    assert.equal(textoMotivoUnknownUi(MIXTO.horizontalDivision), "Parcela urbano-rústica");
    assert.equal(textoRevisionUi(true, "UNKNOWN"), "Para revisar");
    assert.notEqual(textoRevisionUi(true, "UNKNOWN"), "Candidato");
    assert.notEqual(textoRevisionUi(true, "UNKNOWN"), "SIN DIVISIÓN HORIZONTAL");
    assert.equal(textoRevisionUi(true, "NO"), null);
    assert.equal(etiquetaEstadoComercial(MIXTO, revision), "Para revisar");
    assert.notEqual(etiquetaEstadoDivision("UNKNOWN"), "SIN DIVISIÓN HORIZONTAL");
  });

  it("13. muestra Godelleta: solo UNKNOWN puede ser REVIEW", () => {
    const muestra = [MIXTO, CANDIDATO, CON_DH, SUELO];
    let revision = REVISION_VACIA;
    for (const item of muestra) {
      revision = marcarRevision(revision, item, CLAVE);
    }
    assert.deepEqual(
      revision.fincas.map((item) => item.fincaReference),
      [MIXTO.fincaReference]
    );
    assert.equal(MIXTO.horizontalDivision?.status, "UNKNOWN");
    assert.equal(CANDIDATO.horizontalDivision?.status, "NO");
    assert.equal(CON_DH.horizontalDivision?.status, "YES");
    assert.equal(SUELO.horizontalDivision?.status, "NOT_APPLICABLE");
    assert.equal(textoRevision(revision.fincas.length), "1 para revisar");
    assert.equal(textoBarraSeleccionYRevision(3, 5), "3 fincas seleccionadas · 5 para revisar");
  });
});

describe("exportación normal con revisión", () => {
  it("el CSV de la selección incluye Estado comercial de las revisadas", () => {
    const seleccion = alternarSeleccion(SELECCION_VACIA, MIXTO, CLAVE);
    const revision = marcarRevision(REVISION_VACIA, MIXTO, CLAVE);
    const preparada = prepararExportacionCsv({
      seleccion,
      revision,
      criterios: { municipio: "GODELLETA", via: "DEMO", numero: "", horizontalDivision: "ALL" },
      cobertura: { completeCandidates: true, possibleCut: false },
    });
    assert.equal(preparada.ok, true);
    if (preparada.ok) {
      assert.match(preparada.contenido, /NO DETERMINADO/);
      assert.match(preparada.contenido, /Para revisar/);
      assert.match(preparada.contenido, /Parcela urbano-rústica/);
      assert.equal(preparada.contenido.toLowerCase().includes("sin división horizontal"), false);
    }
  });

  it("nombre de archivo de revisión no usa el prefijo de candidatos", () => {
    assert.equal(
      nombreArchivoExportacion(
        { municipio: "GODELLETA", via: "DEMO", numero: "", horizontalDivision: "REVIEW" },
        new Date(2026, 8, 12)
      ),
      "fincas_para_revisar_Godelleta_Demo_2026-09-12.csv"
    );
  });
});
