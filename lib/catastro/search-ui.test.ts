import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  claveCriterios,
  criteriosDesdeSearchParams,
  criteriosListos,
  FILTROS_DIVISION,
  LEYENDA_ESTADOS_DIVISION,
  LEYENDA_FILTRO_TODAS,
  etiquetaEstadoDivision,
  mensajeErrorBusqueda,
  textoMotivoUnknownUi,
  searchParamsDesdeCriterios,
  textosCobertura,
  textoContadorFincas,
  textoVacioResultados,
  tituloDireccionFinca,
  type FincaBusquedaUi,
  etiquetaEstadoDivisionLista,
  filtrarListaFincas,
  ordenarListaFincas,
  etiquetaUsoLista,
  metricasFincaLista,
  recuentoEstadosDivision,
  resumenTarjetaMovil,
  resumenComercialFinca,
  aplicarCriterioOrdenLista,
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
    assert.match(mensajeErrorBusqueda(504), /Reanudar/);
    assert.match(mensajeErrorBusqueda(500), /Reanudar/);
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

  it("explica los cuatro estados de división horizontal y no trata ALL como estado", () => {
    assert.deepEqual(
      LEYENDA_ESTADOS_DIVISION.map((item) => item.status),
      ["NO", "YES", "NOT_APPLICABLE", "UNKNOWN"]
    );
    assert.equal(
      LEYENDA_ESTADOS_DIVISION.find((item) => item.status === "NO")?.etiqueta,
      etiquetaEstadoDivisionLista("NO")
    );
    assert.equal(
      LEYENDA_ESTADOS_DIVISION.find((item) => item.status === "YES")?.etiqueta,
      etiquetaEstadoDivisionLista("YES")
    );
    assert.match(LEYENDA_ESTADOS_DIVISION[0]?.texto ?? "", /no está partido en pisos/);
    assert.match(LEYENDA_ESTADOS_DIVISION[1]?.texto ?? "", /ya hay división horizontal/);
    assert.match(LEYENDA_ESTADOS_DIVISION[2]?.texto ?? "", /Suelo sin edificar/);
    assert.match(LEYENDA_ESTADOS_DIVISION[3]?.texto ?? "", /No se trata como candidata/);
    assert.equal(
      LEYENDA_ESTADOS_DIVISION[3]?.texto.includes("SIN DIVISIÓN HORIZONTAL"),
      false
    );
    assert.match(LEYENDA_FILTRO_TODAS, /Todas las fincas/);
    assert.equal(
      LEYENDA_ESTADOS_DIVISION.some((item) => item.status === "ALL"),
      false
    );
  });

  it("15. el filtro UI incluye NOT_APPLICABLE y no lo etiqueta como candidato", () => {
    assert.deepEqual(
      FILTROS_DIVISION.map((item) => item.value),
      ["NO", "YES", "UNKNOWN", "NOT_APPLICABLE", "ALL"]
    );
    assert.equal(
      FILTROS_DIVISION.find((item) => item.value === "NOT_APPLICABLE")?.label,
      "No aplica"
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

  it("filtra la lista por estado y texto sin cambiar la clasificación", () => {
    const candidata: FincaBusquedaUi = {
      fincaReference: "11111111111111",
      portals: ["1"],
      address: { sigla: "CL", via: "MAYOR", numero: "1" },
      superficieSolar: 420,
      horizontalDivision: { status: "NO" },
      properties: [{ reference: "111111111111110001AA", anio: 1964, uso: "Residencial" }],
    };
    const conPisos: FincaBusquedaUi = {
      fincaReference: "22222222222222",
      portals: ["2"],
      address: { sigla: "CL", via: "NUEVA", numero: "2" },
      horizontalDivision: { status: "YES" },
      properties: [{ reference: "222222222222220001AA", uso: "Residencial" }],
    };
    assert.deepEqual(recuentoEstadosDivision([candidata, conPisos]), {
      ALL: 2,
      NO: 1,
      YES: 1,
      UNKNOWN: 0,
      NOT_APPLICABLE: 0,
    });
    assert.equal(filtrarListaFincas([candidata, conPisos], { status: "NO" }).length, 1);
    assert.equal(filtrarListaFincas([candidata, conPisos], { q: "mayor" })[0]?.fincaReference, "11111111111111");
    assert.equal(filtrarListaFincas([candidata, conPisos], { minParcela: 400 }).length, 1);
    assert.equal(filtrarListaFincas([candidata, conPisos], { minInmuebles: 2 }).length, 0);
    const conVarios: FincaBusquedaUi = {
      ...candidata,
      fincaReference: "55555555555555",
      superficieSolar: 500,
      properties: [
        { reference: "a", anio: 1970 },
        { reference: "b", anio: 1968 },
      ],
    };
    assert.equal(
      filtrarListaFincas([candidata, conPisos, conVarios], {
        minParcela: 400,
        minInmuebles: 2,
        maxAnio: 1980,
      }).map((item) => item.fincaReference).join(),
      "55555555555555"
    );
    assert.equal(filtrarListaFincas([candidata], { maxAnio: 1960 }).length, 0);
    assert.equal(filtrarListaFincas([candidata], { maxAnio: 1964 }).length, 1);
    const reciente: FincaBusquedaUi = {
      ...candidata,
      fincaReference: "66666666666666",
      properties: [{ reference: "z", anio: 2009 }],
    };
    assert.equal(filtrarListaFincas([reciente], { maxAnio: 1980 }).length, 0);
    assert.equal(
      filtrarListaFincas(
        [
          {
            ...candidata,
            fincaReference: "77777777777777",
            properties: [
              { reference: "a", anio: 1960 },
              { reference: "b", anio: 2009 },
            ],
          },
        ],
        { maxAnio: 1980 }
      ).length,
      0
    );
    assert.equal(
      metricasFincaLista({
        ...candidata,
        properties: [
          { reference: "a", anio: 1968 },
          { reference: "b", anio: 1970 },
        ],
      }).anio,
      "1968–1970"
    );
    const chica: FincaBusquedaUi = { ...conPisos, superficieSolar: 80, properties: [{ reference: "x", anio: 2001 }] };
    const sinDato: FincaBusquedaUi = { ...conPisos, fincaReference: "33333333333333", superficieSolar: undefined, properties: [] };
    assert.deepEqual(
      ordenarListaFincas([candidata, chica, sinDato], [{ campo: "parcela", direccion: "desc" }]).map(
        (item) => item.fincaReference
      ),
      ["11111111111111", "22222222222222", "33333333333333"]
    );
    assert.deepEqual(
      ordenarListaFincas([candidata, chica, sinDato], [{ campo: "parcela", direccion: "asc" }]).map(
        (item) => item.fincaReference
      ),
      ["22222222222222", "11111111111111", "33333333333333"]
    );
    assert.equal(
      ordenarListaFincas([chica, candidata], [{ campo: "anio", direccion: "desc" }])[0]?.fincaReference,
      "22222222222222"
    );
    assert.equal(
      ordenarListaFincas([candidata, sinDato], [{ campo: "inmuebles", direccion: "asc" }])[0]?.fincaReference,
      "33333333333333"
    );
    const mismaParcelaAntigua: FincaBusquedaUi = {
      ...candidata,
      fincaReference: "44444444444444",
      superficieSolar: 420,
      properties: [{ reference: "y", anio: 1950 }],
    };
    assert.deepEqual(
      ordenarListaFincas(
        [mismaParcelaAntigua, candidata, chica],
        [
          { campo: "parcela", direccion: "desc" },
          { campo: "anio", direccion: "desc" },
        ]
      ).map((item) => item.fincaReference),
      ["11111111111111", "44444444444444", "22222222222222"]
    );
    assert.deepEqual(aplicarCriterioOrdenLista([], "parcela"), [{ campo: "parcela", direccion: "desc" }]);
    assert.deepEqual(aplicarCriterioOrdenLista([{ campo: "parcela", direccion: "desc" }], "parcela"), [
      { campo: "parcela", direccion: "asc" },
    ]);
    assert.deepEqual(aplicarCriterioOrdenLista([{ campo: "parcela", direccion: "asc" }], "parcela"), []);
    assert.deepEqual(aplicarCriterioOrdenLista([{ campo: "parcela", direccion: "desc" }], "anio"), [
      { campo: "parcela", direccion: "desc" },
      { campo: "anio", direccion: "desc" },
    ]);
    assert.deepEqual(
      aplicarCriterioOrdenLista(
        [
          { campo: "parcela", direccion: "desc" },
          { campo: "anio", direccion: "asc" },
        ],
        "anio"
      ),
      [{ campo: "parcela", direccion: "desc" }]
    );
    const parcelaGrandePocos: FincaBusquedaUi = {
      ...chica,
      fincaReference: "aaaaaaaaaaaaaa",
      superficieSolar: 36000,
      properties: [{ reference: "1" }],
    };
    const parcelaMediaMuchos: FincaBusquedaUi = {
      ...chica,
      fincaReference: "bbbbbbbbbbbbbb",
      superficieSolar: 25000,
      properties: [{ reference: "1" }, { reference: "2" }, { reference: "3" }],
    };
    const parcelaEnorme: FincaBusquedaUi = {
      ...chica,
      fincaReference: "cccccccccccccc",
      superficieSolar: 240000,
      properties: [{ reference: "1" }, { reference: "2" }],
    };
    assert.deepEqual(
      ordenarListaFincas(
        [parcelaGrandePocos, parcelaMediaMuchos, parcelaEnorme],
        [
          { campo: "parcela", direccion: "desc" },
          { campo: "inmuebles", direccion: "desc" },
        ]
      ).map((item) => item.fincaReference),
      ["cccccccccccccc", "bbbbbbbbbbbbbb", "aaaaaaaaaaaaaa"]
    );
    assert.equal(metricasFincaLista(candidata).parcela, "420 m²");
    assert.equal(metricasFincaLista(candidata).anio, "1964");
    assert.equal(etiquetaUsoLista("Obras de urbanización y jardineria, suelos sin edificar"), "Urbanización");
    assert.equal(
      metricasFincaLista({
        ...candidata,
        properties: [{ reference: "111111111111110001AA", uso: "Obras de urbanización y jardineria, suelos sin edificar" }],
      }).uso,
      "Urbanización"
    );
    assert.equal(resumenTarjetaMovil(candidata), "420 m² de parcela · 1 inmueble · 1964 · Residencial");
    assert.equal(
      resumenTarjetaMovil({
        fincaReference: "33333333333333",
        portals: ["10"],
        address: { sigla: "LG", via: "AGRA MONTES", numero: "10" },
        superficieSolar: 3617,
        horizontalDivision: { status: "NOT_APPLICABLE" },
        properties: [],
      }),
      "3.617 m² de parcela · 0 inmuebles · — · Suelo"
    );
  });
});
