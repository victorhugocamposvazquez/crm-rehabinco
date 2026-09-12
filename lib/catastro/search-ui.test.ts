import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  claveCriterios,
  criteriosDesdeSearchParams,
  criteriosListos,
  FILTROS_DIVISION,
  etiquetaEstadoDivision,
  mensajeErrorBusqueda,
  textoMotivoUnknownUi,
  searchParamsDesdeCriterios,
  textosCobertura,
  textoContadorFincas,
  textoVacioResultados,
  tituloDireccionFinca,
  etiquetaEstadoDivisionLista,
  resumenComercialFinca,
} from "./search-ui";

describe("search-ui", () => {
  it("traduce errores HTTP a mensajes humanos", () => {
    assert.equal(mensajeErrorBusqueda(400), "Revisa los datos introducidos.");
    assert.equal(
      mensajeErrorBusqueda(404),
      "No hemos encontrado esa calle o ubicación en Catastro."
    );
    assert.equal(
      mensajeErrorBusqueda(502),
      "Catastro no está disponible en este momento. Inténtalo de nuevo."
    );
    assert.equal(mensajeErrorBusqueda(500).includes("XML"), false);
  });

  it("etiqueta la división horizontal sin mostrar UNKNOWN", () => {
    assert.equal(etiquetaEstadoDivision("NO"), "SIN DIVISIÓN HORIZONTAL");
    assert.equal(etiquetaEstadoDivision("YES"), "CON DIVISIÓN HORIZONTAL");
    assert.equal(etiquetaEstadoDivision("UNKNOWN"), "NO DETERMINADO");
    assert.equal(etiquetaEstadoDivision("NOT_APPLICABLE"), "NO APLICA");
    assert.notEqual(etiquetaEstadoDivision("NOT_APPLICABLE"), "SIN DIVISIÓN HORIZONTAL");
    assert.equal(etiquetaEstadoDivision(undefined), "NO DETERMINADO");
  });

  it("11. UNKNOWN muestra motivo descriptivo, nunca SIN DIVISIÓN HORIZONTAL", () => {
    assert.equal(etiquetaEstadoDivision("UNKNOWN"), "NO DETERMINADO");
    assert.equal(
      textoMotivoUnknownUi({ status: "UNKNOWN", reasonCode: "MIXED_URBAN_RURAL" }),
      "Parcela urbano-rústica"
    );
    assert.equal(
      textoMotivoUnknownUi({ status: "UNKNOWN", reasonCode: "LTP_MISSING" }),
      "Catastro no proporciona la clasificación de división horizontal"
    );
    assert.equal(
      textoMotivoUnknownUi({ status: "UNKNOWN", reasonCode: "LTP_UNRECOGNIZED" }),
      "Catastro no proporciona la clasificación de división horizontal"
    );
    assert.equal(
      textoMotivoUnknownUi({ status: "UNKNOWN", reasonCode: "QUERY_ERROR" }),
      "No se pudo obtener la información necesaria"
    );
    assert.equal(textoMotivoUnknownUi({ status: "NO" }), null);
    assert.notEqual(textoMotivoUnknownUi({ status: "UNKNOWN", reasonCode: "MIXED_URBAN_RURAL" }), "SIN DIVISIÓN HORIZONTAL");
    assert.notEqual(etiquetaEstadoDivision("UNKNOWN"), "SIN DIVISIÓN HORIZONTAL");
  });

  it("15. el filtro UI incluye NOT_APPLICABLE y no lo etiqueta como candidato", () => {
    assert.deepEqual(
      FILTROS_DIVISION.map((item) => item.value),
      ["NO", "YES", "UNKNOWN", "NOT_APPLICABLE", "ALL"]
    );
    assert.equal(
      FILTROS_DIVISION.find((item) => item.value === "NOT_APPLICABLE")?.label,
      "No aplicable"
    );
    const leidos = criteriosDesdeSearchParams(
      new URLSearchParams("provincia=Valencia&municipio=Godelleta&via=Demo&horizontalDivision=NOT_APPLICABLE")
    );
    assert.equal(leidos.horizontalDivision, "NOT_APPLICABLE");
    assert.equal(searchParamsDesdeCriterios(leidos).get("horizontalDivision"), "NOT_APPLICABLE");
  });

  it("lee criterios de la URL y no incluye el cursor al serializar", () => {
    const leidos = criteriosDesdeSearchParams(
      new URLSearchParams(
        "provincia=Madrid&municipio=Madrid&sigla=CL&via=Fuencarral&numero=50&horizontalDivision=NO&cursor=secreto"
      )
    );
    assert.equal(leidos.via, "Fuencarral");
    assert.equal(leidos.horizontalDivision, "NO");
    assert.equal(leidos.numero, "50");

    const serializados = searchParamsDesdeCriterios(leidos);
    assert.equal(serializados.get("via"), "Fuencarral");
    assert.equal(serializados.get("horizontalDivision"), "NO");
    assert.equal(serializados.has("cursor"), false);
  });

  it("usa NO por defecto si la URL no trae filtro", () => {
    const leidos = criteriosDesdeSearchParams(
      new URLSearchParams("provincia=Madrid&municipio=Madrid&via=Serrano")
    );
    assert.equal(leidos.horizontalDivision, "NO");
    assert.equal(leidos.sigla, "CL");
    assert.equal(criteriosListos(leidos), true);
  });

  it("nunca afirma búsqueda completa si complete=false", () => {
    const textos = textosCobertura({
      complete: false,
      completeCandidates: true,
      hasNextPage: true,
      possibleCut: true,
    });
    assert.equal(textos.completa, null);
    assert.equal(
      textos.masResultados,
      "Hay más portales en esta calle. Pulsa Siguiente para continuar."
    );
    assert.match(textos.corte ?? "", /más resultados/);
  });

  it("sí muestra búsqueda completa cuando coverage.complete y completeCandidates", () => {
    const textos = textosCobertura({
      complete: true,
      completeCandidates: true,
      hasNextPage: false,
      possibleCut: false,
    });
    assert.equal(textos.completa, "Búsqueda completa");
  });

  it("el contador no afirma que cubre toda la calle", () => {
    assert.equal(textoContadorFincas(3), "3 fincas encontradas");
    assert.equal(textoContadorFincas(3).includes("toda la calle"), false);
  });

  it("distingue criterios para no reutilizar un cursor ajeno", () => {
    const a = criteriosDesdeSearchParams(
      new URLSearchParams("provincia=Madrid&municipio=Madrid&via=Fuencarral&sigla=CL")
    );
    const b = { ...a, via: "Serrano" };
    assert.notEqual(claveCriterios(a), claveCriterios(b));
  });

  it("compone la dirección visible sin datos técnicos", () => {
    assert.equal(
      tituloDireccionFinca({
        fincaReference: "12345678901234",
        portals: ["50"],
        address: { sigla: "CL", via: "FUENCARRAL", numero: "50" },
      }),
      "CL FUENCARRAL 50"
    );
    // snp "0" oficial = sin segundo número (CL FUENCARRAL 13 real).
    assert.equal(
      tituloDireccionFinca({
        fincaReference: "0549706VK4704H",
        portals: ["13"],
        address: { sigla: "CL", via: "FUENCARRAL", numero: "13", numero2: "0" },
      }),
      "CL FUENCARRAL 13"
    );
    assert.equal(
      tituloDireccionFinca({
        fincaReference: "12345678901234",
        portals: ["50"],
        address: { sigla: "CL", via: "FUENCARRAL", numero: "50", numero2: "BIS" },
      }),
      "CL FUENCARRAL 50BIS"
    );
  });

  it("explica un vacío por filtro de candidatas y ofrece ver todas", () => {
    const vacioNo = textoVacioResultados("NO");
    assert.match(vacioNo.mensaje, /candidatas/);
    assert.equal(vacioNo.accion?.filtro, "ALL");
    assert.equal(textoVacioResultados("ALL").accion, undefined);
    assert.equal(etiquetaEstadoDivisionLista("NO"), "Candidata");
    assert.equal(etiquetaEstadoDivisionLista("YES"), "Con pisos");
    assert.equal(etiquetaEstadoDivisionLista("UNKNOWN"), "Sin clasificar");
    assert.match(
      resumenComercialFinca({
        horizontalDivision: { status: "NO" },
        superficieSolar: 420,
        properties: [],
      }),
      /Sin dividir/
    );
  });
});
