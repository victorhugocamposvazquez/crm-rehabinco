import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AVISO_FALLBACK_CATALOGO } from "./catalog-client-cache";
import {
  ESTADO_UBICACION_VACIO,
  aplicarCallesCargadas,
  aplicarCambioCalle,
  aplicarCambioMunicipio,
  aplicarCambioProvincia,
  aplicarEstadoCalles,
  aplicarEstadoMunicipios,
  aplicarMunicipiosCargados,
  aplicarProvinciasCargadas,
  calleDeshabilitada,
  clavePeticionCatalogo,
  criteriosDesdeUbicacion,
  esRespuestaObsoleta,
  filtrarCallesLocal,
  municipioDeshabilitado,
  seleccionarCallePorUrl,
  textoCargaCalles,
  textoCargaMunicipios,
  textoRevalidacionCalles,
  urlDesdeUbicacion,
  type CalleUi,
  type MunicipioUi,
  type ProvinciaUi,
} from "./location-ui";

const MADRID: ProvinciaUi = { code: "28", name: "MADRID" };
const VALENCIA: ProvinciaUi = { code: "46", name: "VALENCIA" };
const MUN_MADRID: MunicipioUi = { code: "79", name: "MADRID" };
const MUN_GODELLETA: MunicipioUi = { code: "138", name: "GODELLETA" };
const FUENCARRAL: CalleUi = { code: "2365", sigla: "CL", name: "FUENCARRAL" };
const CAMINO: CalleUi = { code: "2366", sigla: "CM", name: "FUENCARRAL" };
const GUAYANA: CalleUi = { code: "57", sigla: "CL", name: "GUAYANA-MOJONERA" };

describe("location-ui", () => {
  it("1. cargar provincias deja el selector listo y puede restaurar la URL", () => {
    const estado = aplicarProvinciasCargadas(ESTADO_UBICACION_VACIO, [MADRID, VALENCIA], "Madrid");
    assert.equal(estado.provincias.length, 2);
    assert.deepEqual(estado.provincia, MADRID);
    assert.equal(estado.cargandoProvincias, false);
  });

  it("2. el municipio empieza deshabilitado", () => {
    assert.equal(municipioDeshabilitado(ESTADO_UBICACION_VACIO), true);
  });

  it("3. seleccionar provincia marca carga de municipios", () => {
    const estado = aplicarCambioProvincia(ESTADO_UBICACION_VACIO, MADRID);
    assert.deepEqual(estado.provincia, MADRID);
    assert.equal(estado.cargandoMunicipios, true);
    assert.equal(municipioDeshabilitado(estado), false);
  });

  it("4. cambiar de provincia limpia municipio y calle", () => {
    const conCalle = aplicarCambioCalle(
      {
        ...aplicarCambioMunicipio(aplicarCambioProvincia(ESTADO_UBICACION_VACIO, MADRID), MUN_MADRID),
        calles: [FUENCARRAL],
      },
      FUENCARRAL
    );
    const cambiado = aplicarCambioProvincia(conCalle, VALENCIA);
    assert.equal(cambiado.municipio, null);
    assert.equal(cambiado.calle, null);
    assert.deepEqual(cambiado.calles, []);
    assert.deepEqual(cambiado.municipios, []);
  });

  it("5. la calle está deshabilitada hasta tener municipio", () => {
    const soloProvincia = aplicarCambioProvincia(ESTADO_UBICACION_VACIO, MADRID);
    assert.equal(calleDeshabilitada(soloProvincia), true);
    const conMunicipio = aplicarCambioMunicipio(soloProvincia, MUN_MADRID);
    assert.equal(calleDeshabilitada(conMunicipio), false);
  });

  it("6. seleccionar municipio marca carga de calles y limpia la calle", () => {
    const estado = aplicarCambioMunicipio(
      aplicarCambioCalle(
        { ...ESTADO_UBICACION_VACIO, provincia: MADRID, municipio: MUN_MADRID, calle: FUENCARRAL },
        FUENCARRAL
      ),
      MUN_GODELLETA
    );
    assert.equal(estado.calle, null);
    assert.equal(estado.cargandoCalles, true);
    assert.deepEqual(estado.municipio, MUN_GODELLETA);
  });

  it("7. la calle seleccionada conserva code + sigla + name", () => {
    const estado = aplicarCambioCalle(ESTADO_UBICACION_VACIO, FUENCARRAL);
    assert.deepEqual(estado.calle, { code: "2365", sigla: "CL", name: "FUENCARRAL" });
  });

  it("8. la búsqueda envía la sigla oficial, no una reconstruida", () => {
    const estado = {
      ...ESTADO_UBICACION_VACIO,
      provincia: MADRID,
      municipio: MUN_MADRID,
      calle: FUENCARRAL,
    };
    const criterios = criteriosDesdeUbicacion(estado, {
      numero: "50",
      postalCode: "",
      horizontalDivision: "NO",
    });
    assert.equal(criterios?.sigla, "CL");
    assert.equal(criterios?.via, "FUENCARRAL");
    assert.equal(criterios?.sigla === "CL", true);
    const url = urlDesdeUbicacion(estado, {
      numero: "50",
      postalCode: "",
      horizontalDivision: "NO",
    });
    assert.equal(url.get("sigla"), "CL");
    assert.equal(url.has("code"), false);
    assert.equal(url.has("cursor"), false);
  });

  it("9. una respuesta antigua no pisa el estado actual", () => {
    const madrid = clavePeticionCatalogo("municipalities", "MADRID");
    const valencia = clavePeticionCatalogo("municipalities", "VALENCIA");
    assert.equal(esRespuestaObsoleta(madrid, valencia), true);
    assert.equal(esRespuestaObsoleta(valencia, valencia), false);
  });

  it("10. restaurar desde URL elige la calle oficial por sigla + nombre", () => {
    const conMunicipios = aplicarMunicipiosCargados(
      aplicarCambioProvincia(ESTADO_UBICACION_VACIO, MADRID),
      [MUN_MADRID],
      "Madrid"
    );
    const restaurado = aplicarCallesCargadas(conMunicipios, [FUENCARRAL, CAMINO], "Fuencarral", "CL");
    assert.deepEqual(restaurado.calle, FUENCARRAL);
    assert.equal(seleccionarCallePorUrl([FUENCARRAL, CAMINO], "Fuencarral", "CM")?.code, "2366");
  });

  it("11 y 12. textos de carga específicos, no un loading global", () => {
    assert.equal(textoCargaMunicipios(true), "Cargando municipios...");
    assert.equal(textoCargaCalles(true), "Cargando calles...");
    assert.equal(textoCargaMunicipios(false), null);
    assert.equal(textoCargaCalles(false), null);
  });

  it("SWR: la revalidación de calles no pierde la selección ni bloquea el combobox", () => {
    const base = aplicarEstadoCalles(
      aplicarCambioMunicipio(aplicarCambioProvincia(ESTADO_UBICACION_VACIO, MADRID), MUN_MADRID),
      { items: [FUENCARRAL, CAMINO], revalidating: true, aviso: null }
    );
    assert.equal(base.cargandoCalles, false);
    assert.equal(base.revalidandoCalles, true);
    const conCalle = aplicarCambioCalle(base, FUENCARRAL);
    const actualizado = aplicarEstadoCalles(conCalle, {
      items: [FUENCARRAL, CAMINO, GUAYANA],
      revalidating: false,
      aviso: null,
    });
    assert.deepEqual(actualizado.calle, FUENCARRAL);
    assert.equal(actualizado.calles.length, 3);
    assert.equal(actualizado.revalidandoCalles, false);
    assert.equal(textoRevalidacionCalles(true), "Actualizando calles...");
    assert.equal(textoCargaCalles(true, "MADRID"), "Cargando calles de MADRID...");
  });

  it("fallback: el aviso llega al estado y la revalidación de municipios respeta el elegido", () => {
    const conMunicipio = aplicarEstadoMunicipios(
      aplicarCambioProvincia(ESTADO_UBICACION_VACIO, MADRID),
      { items: [MUN_MADRID], revalidating: true, aviso: null },
      "Madrid"
    );
    assert.deepEqual(conMunicipio.municipio, MUN_MADRID);
    const final = aplicarEstadoMunicipios(conMunicipio, {
      items: [MUN_MADRID, MUN_GODELLETA],
      revalidating: false,
      aviso: AVISO_FALLBACK_CATALOGO,
    });
    assert.deepEqual(final.municipio, MUN_MADRID);
    assert.equal(final.municipios.length, 2);
    assert.equal(final.avisoCatalogo, AVISO_FALLBACK_CATALOGO);
    assert.equal(aplicarCambioProvincia(final, VALENCIA).avisoCatalogo, null);
  });

  it("filtra calles en local sin enviar el texto a Catastro", () => {
    const visibles = filtrarCallesLocal([FUENCARRAL, CAMINO, GUAYANA], "fuenc");
    assert.deepEqual(
      visibles.map((item) => `${item.sigla} ${item.name}`),
      ["CL FUENCARRAL", "CM FUENCARRAL"]
    );
    assert.deepEqual(filtrarCallesLocal([FUENCARRAL], "f"), []);
  });
});
