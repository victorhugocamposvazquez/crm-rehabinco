import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FincaBusquedaUi } from "./search-ui";
import {
  AVISO_EXPORTACION_CORTE,
  AVISO_EXPORTACION_INCOMPLETA,
  COLUMNAS_CSV,
  CSV_BOM,
  SELECCION_VACIA,
  advertenciaExportacion,
  alternarSeleccion,
  coberturaExportacion,
  copiarAlPortapapeles,
  csvDesdeFincas,
  detalleFinca,
  direccionOficial,
  escaparCsv,
  estaSeleccionada,
  filaCsvDesdeFinca,
  generarCsv,
  limpiarSeleccion,
  nombreArchivoExportacion,
  prepararExportacionCsv,
  sanitizarNombreArchivo,
  seleccionParaBusqueda,
  textoSeleccion,
} from "./selection-export";

const CLAVE_FUENCARRAL = "MADRID|MADRID|CL|FUENCARRAL|||NO";
const CLAVE_GODELLETA = "VALENCIA|GODELLETA|CL|GUAYANA-MOJONERA|3||NO";

function finca(ref: string, extra: Partial<FincaBusquedaUi> = {}): FincaBusquedaUi {
  return {
    fincaReference: ref,
    portals: ["50"],
    address: { provincia: "MADRID", municipio: "MADRID", sigla: "CL", via: "FUENCARRAL", numero: "50" },
    postalCode: "28004",
    postalCodes: ["28004"],
    superficieSolar: 194,
    horizontalDivision: { status: "NO" },
    properties: [
      { reference: `${ref}0001AB`, superficie: 65, anio: 1900, uso: "Residencial", planta: "01", puerta: "A", postalCode: "28004" },
    ],
    ...extra,
  };
}

const GODELLETA: FincaBusquedaUi = {
  fincaReference: "2749704YJ0624N",
  portals: ["3"],
  address: { provincia: "VALENCIA", municipio: "GODELLETA", sigla: "CL", via: "GUAYANA-MOJONERA", numero: "3" },
  postalCode: "46388",
  postalCodes: ["46388"],
  superficieSolar: 839,
  horizontalDivision: { status: "NO" },
  properties: [{ reference: "2749704YJ0624N0001XX", superficie: 120, anio: 1980, uso: "Residencial", postalCode: "46388" }],
};

const A = finca("0751301VK4705B");
const B = finca("0751302VK4705B");
const C = finca("0751303VK4705B");

function lineas(csv: string): string[] {
  return csv.replace(CSV_BOM, "").split("\r\n").filter((linea) => linea.length > 0);
}

describe("selección de fincas", () => {
  it("1. seleccionar una finca por fincaReference", () => {
    const sel = alternarSeleccion(SELECCION_VACIA, A, CLAVE_FUENCARRAL);
    assert.equal(estaSeleccionada(sel, A.fincaReference), true);
    assert.equal(sel.fincas.length, 1);
    assert.equal(sel.claveBusqueda, CLAVE_FUENCARRAL);
    assert.equal(textoSeleccion(1), "1 finca seleccionada");
  });

  it("2. deseleccionar la misma finca la quita", () => {
    const sel = alternarSeleccion(alternarSeleccion(SELECCION_VACIA, A, CLAVE_FUENCARRAL), A, CLAVE_FUENCARRAL);
    assert.equal(estaSeleccionada(sel, A.fincaReference), false);
    assert.equal(sel.fincas.length, 0);
  });

  it("3. seleccionar varias conserva el orden y no duplica", () => {
    let sel = alternarSeleccion(SELECCION_VACIA, A, CLAVE_FUENCARRAL);
    sel = alternarSeleccion(sel, B, CLAVE_FUENCARRAL);
    sel = alternarSeleccion(sel, C, CLAVE_FUENCARRAL);
    // Misma finca llegada desde otra página (objeto distinto, misma referencia): no se duplica.
    sel = alternarSeleccion(sel, { ...B }, CLAVE_FUENCARRAL);
    assert.deepEqual(sel.fincas.map((f) => f.fincaReference), [A.fincaReference, C.fincaReference]);
    assert.equal(textoSeleccion(2), "2 fincas seleccionadas");
  });

  it("4. la selección sobrevive al cambio de página: no depende de results[]", () => {
    const pagina1 = [A, B];
    const pagina2 = [C];
    let sel = alternarSeleccion(SELECCION_VACIA, pagina1[0], CLAVE_FUENCARRAL);
    sel = alternarSeleccion(sel, pagina1[1], CLAVE_FUENCARRAL);
    // "Cambiar de página": results[] ahora es pagina2; la selección sigue viva.
    sel = alternarSeleccion(sel, pagina2[0], CLAVE_FUENCARRAL);
    assert.equal(estaSeleccionada(sel, A.fincaReference), true);
    assert.equal(estaSeleccionada(sel, B.fincaReference), true);
    assert.equal(estaSeleccionada(sel, C.fincaReference), true);
    // Volver a página 1 (misma clave de búsqueda): nada cambia.
    assert.equal(seleccionParaBusqueda(sel, CLAVE_FUENCARRAL), sel);
    assert.equal(sel.fincas.length, 3);
  });

  it("5. limpiar selección", () => {
    const sel = alternarSeleccion(SELECCION_VACIA, A, CLAVE_FUENCARRAL);
    assert.deepEqual(limpiarSeleccion(), SELECCION_VACIA);
    assert.equal(limpiarSeleccion().fincas.length, 0);
    assert.equal(sel.fincas.length, 1);
  });

  it("6. cambiar los criterios de búsqueda vacía la selección anterior", () => {
    const sel = alternarSeleccion(SELECCION_VACIA, A, CLAVE_FUENCARRAL);
    const nueva = seleccionParaBusqueda(sel, CLAVE_GODELLETA);
    assert.equal(nueva.fincas.length, 0);
    assert.equal(nueva.claveBusqueda, CLAVE_GODELLETA);
    // Seleccionar en la nueva búsqueda no arrastra candidatos de la anterior.
    const mezcla = alternarSeleccion(sel, GODELLETA, CLAVE_GODELLETA);
    assert.deepEqual(mezcla.fincas.map((f) => f.fincaReference), [GODELLETA.fincaReference]);
  });
});

describe("exportación CSV", () => {
  it("7. genera cabecera en el orden acordado y una fila por finca", () => {
    const csv = csvDesdeFincas([A, GODELLETA]);
    const filas = lineas(csv);
    assert.equal(filas.length, 3);
    assert.equal(filas[0], COLUMNAS_CSV.join(";"));
    const godelleta = filas[2].split(";");
    assert.equal(godelleta[0], "2749704YJ0624N");
    assert.equal(godelleta[1], "VALENCIA");
    assert.equal(godelleta[2], "GODELLETA");
    assert.equal(godelleta[3], "CL");
    assert.equal(godelleta[4], "GUAYANA-MOJONERA");
    assert.equal(godelleta[5], "3");
    assert.equal(godelleta[8], "46388");
    assert.equal(godelleta[10], "839");
    assert.equal(godelleta[11], "SIN DIVISIÓN HORIZONTAL");
    assert.equal(godelleta[12], "");
    assert.equal(godelleta[13], "Candidato confirmado");
    assert.equal(godelleta[15], "1");
    assert.equal(godelleta[16], "2749704YJ0624N0001XX");
    const fila = filaCsvDesdeFinca(A);
    assert.equal(fila["Datos inmuebles"], "0751301VK4705B0001AB · 65 m² · Año 1900 · Residencial · Pl 01 · Pt A · CP 28004");
    // Nada técnico.
    assert.equal(csv.includes("cursor"), false);
    assert.equal(csv.includes("discoveryId"), false);
    assert.equal(csv.includes("ltp"), false);
  });

  it("8. empieza por BOM UTF-8 y conserva ñ y tildes", () => {
    const csv = csvDesdeFincas([finca("1111111AA1111A", { address: { provincia: "A CORUÑA", municipio: "CAMARIÑAS", sigla: "CL", via: "PEÑA" } })]);
    assert.equal(csv.charCodeAt(0), 0xfeff);
    assert.ok(csv.includes("CAMARIÑAS"));
    assert.ok(csv.includes("PEÑA"));
    assert.ok(csv.includes("Tipo vía"));
    assert.ok(csv.includes("DIVISIÓN"));
    assert.ok(csv.endsWith("\r\n"));
  });

  it("9. escapa comillas doblándolas", () => {
    assert.equal(escaparCsv('CL "LA" PAZ'), '"CL ""LA"" PAZ"');
    const csv = csvDesdeFincas([finca("1111111AA1111A", { address: { sigla: "CL", via: 'DEL "REY"', provincia: "X", municipio: "Y" } })]);
    assert.ok(csv.includes('"DEL ""REY"""'));
  });

  it("10. escapa el separador ;", () => {
    assert.equal(escaparCsv("A;B"), '"A;B"');
    assert.equal(escaparCsv("sin separador"), "sin separador");
    const csv = csvDesdeFincas([finca("1111111AA1111A", { address: { sigla: "CL", via: "UNO; DOS", provincia: "X", municipio: "Y" } })]);
    const fila = lineas(csv)[1];
    assert.ok(fila.includes('"UNO; DOS"'));
  });

  it("11. escapa saltos de línea dentro de una celda", () => {
    assert.equal(escaparCsv("linea1\nlinea2"), '"linea1\nlinea2"');
    assert.equal(escaparCsv("a\r\nb"), '"a\r\nb"');
    const csv = generarCsv(["Col"], [["uno\ndos"]]);
    assert.equal(csv, `${CSV_BOM}Col\r\n"uno\ndos"\r\n`);
  });

  it("12. nombre de archivo legible, sin IDs y saneado", () => {
    const fecha = new Date(2026, 8, 11);
    assert.equal(
      nombreArchivoExportacion({ municipio: "MADRID", via: "FUENCARRAL", numero: "", horizontalDivision: "NO" }, fecha),
      "fincas_sin_division_horizontal_Madrid_Fuencarral_2026-09-11.csv"
    );
    assert.equal(
      nombreArchivoExportacion({ municipio: "MADRID", via: "FUENCARRAL", numero: "50", horizontalDivision: "NO" }, fecha),
      "fincas_sin_division_horizontal_Madrid_Fuencarral_50_2026-09-11.csv"
    );
    assert.equal(
      nombreArchivoExportacion({ municipio: "GODELLETA", via: "GUAYANA-MOJONERA", numero: "3", horizontalDivision: "NO" }, fecha),
      "fincas_sin_division_horizontal_Godelleta_Guayana-Mojonera_3_2026-09-11.csv"
    );
    assert.equal(
      nombreArchivoExportacion({ municipio: "SAN SEBASTIÁN DE LOS REYES", via: "REAL/ANTIGUA: <NORTE>?", numero: "1*", horizontalDivision: "ALL" }, fecha),
      "fincas_San_Sebastián_De_Los_Reyes_Real_Antigua_Norte_1_2026-09-11.csv"
    );
    assert.equal(
      nombreArchivoExportacion({ municipio: "GODELLETA", via: "DEMO", numero: "", horizontalDivision: "NOT_APPLICABLE" }, fecha),
      "fincas_division_no_aplica_Godelleta_Demo_2026-09-11.csv"
    );
    assert.equal(sanitizarNombreArchivo('a\\b/c:d*e?f"g<h>i|j'), "a_b_c_d_e_f_g_h_i_j");
  });

  it("10. UNKNOWN exporta NO DETERMINADO y Motivo legible; NO no cambia", () => {
    const unknown = finca("MIXMIXMIXMIXMI", {
      horizontalDivision: { status: "UNKNOWN", reasonCode: "MIXED_URBAN_RURAL" },
    });
    const filaUnknown = filaCsvDesdeFinca(unknown);
    assert.equal(filaUnknown["División horizontal"], "NO DETERMINADO");
    assert.equal(filaUnknown.Motivo, "Parcela urbano-rústica");
    assert.notEqual(filaUnknown["División horizontal"], "SIN DIVISIÓN HORIZONTAL");
    assert.equal(filaCsvDesdeFinca(finca("X", { horizontalDivision: { status: "UNKNOWN", reasonCode: "LTP_MISSING" } })).Motivo, "LTP no informado");
    assert.equal(filaCsvDesdeFinca(finca("X", { horizontalDivision: { status: "UNKNOWN", reasonCode: "LTP_UNRECOGNIZED" } })).Motivo, "LTP no reconocido");
    assert.equal(filaCsvDesdeFinca(finca("X", { horizontalDivision: { status: "UNKNOWN", reasonCode: "QUERY_ERROR" } })).Motivo, "Error de consulta");
    const csvNo = csvDesdeFincas([A]);
    assert.match(csvNo, /SIN DIVISIÓN HORIZONTAL/);
    assert.equal(filaCsvDesdeFinca(A).Motivo, "");
    assert.ok(COLUMNAS_CSV.includes("Motivo"));
  });

  it("14. CSV de NOT_APPLICABLE dice NO APLICA; el de NO no lo incluye", () => {
    const na = finca("5472105YJ0657S", { horizontalDivision: { status: "NOT_APPLICABLE" } });
    const csvNa = csvDesdeFincas([na]);
    assert.equal(filaCsvDesdeFinca(na)["División horizontal"], "NO APLICA");
    assert.match(csvNa, /NO APLICA/);
    assert.doesNotMatch(csvNa, /SIN DIVISIÓN HORIZONTAL/);
    const csvNo = csvDesdeFincas([A]);
    assert.equal(csvNo.includes("NO APLICA"), false);
    assert.match(csvNo, /SIN DIVISIÓN HORIZONTAL/);
  });

  it("13. advertencia cuando la búsqueda no está completa", () => {
    assert.equal(advertenciaExportacion({ completeCandidates: false, possibleCut: false }), AVISO_EXPORTACION_INCOMPLETA);
    assert.equal(advertenciaExportacion({ completeCandidates: true, possibleCut: false }), null);
    // Última página con hasNextPage: no se puede afirmar completitud.
    const cobertura = coberturaExportacion([
      { coverage: { completeCandidates: true, possibleCut: false }, pagination: { hasNextPage: true } },
    ]);
    assert.equal(advertenciaExportacion(cobertura), AVISO_EXPORTACION_INCOMPLETA);
    const completa = coberturaExportacion([
      { coverage: { completeCandidates: false, possibleCut: false }, pagination: { hasNextPage: true } },
      { coverage: { completeCandidates: true, possibleCut: false }, pagination: { hasNextPage: false } },
    ]);
    assert.equal(advertenciaExportacion(completa), null);
  });

  it("14. possibleCut manda sobre el resto y no impide exportar", () => {
    assert.equal(advertenciaExportacion({ completeCandidates: true, possibleCut: true }), AVISO_EXPORTACION_CORTE);
    const cobertura = coberturaExportacion([
      { coverage: { completeCandidates: false, possibleCut: true }, pagination: { hasNextPage: true } },
      { coverage: { completeCandidates: true, possibleCut: false }, pagination: { hasNextPage: false } },
    ]);
    assert.equal(cobertura.possibleCut, true);
    const preparada = prepararExportacionCsv({
      seleccion: alternarSeleccion(SELECCION_VACIA, A, CLAVE_FUENCARRAL),
      criterios: { municipio: "MADRID", via: "FUENCARRAL", numero: "", horizontalDivision: "NO" },
      cobertura,
      fecha: new Date(2026, 8, 11),
    });
    assert.equal(preparada.ok, true);
    if (preparada.ok) {
      assert.equal(preparada.advertencia, AVISO_EXPORTACION_CORTE);
      assert.equal(preparada.totalFincas, 1);
    }
  });

  it("15. exportar sin candidatos no genera archivo", () => {
    const preparada = prepararExportacionCsv({
      seleccion: SELECCION_VACIA,
      criterios: { municipio: "MADRID", via: "FUENCARRAL", numero: "", horizontalDivision: "NO" },
      cobertura: { completeCandidates: true, possibleCut: false },
    });
    assert.equal(preparada.ok, false);
    if (!preparada.ok) assert.match(preparada.motivo, /No hay fincas seleccionadas/);
    assert.equal(lineas(csvDesdeFincas([])).length, 1);
  });

  it("no duplica fincas seleccionadas en páginas distintas", () => {
    let sel = alternarSeleccion(SELECCION_VACIA, A, CLAVE_FUENCARRAL);
    sel = alternarSeleccion(sel, C, CLAVE_FUENCARRAL);
    sel = alternarSeleccion(sel, B, CLAVE_FUENCARRAL);
    const csv = csvDesdeFincas(sel.fincas);
    const refs = lineas(csv).slice(1).map((linea) => linea.split(";")[0]);
    assert.deepEqual(refs, [A.fincaReference, C.fincaReference, B.fincaReference]);
    assert.equal(new Set(refs).size, refs.length);
  });
});

describe("copiar y detalle", () => {
  it("16. copiar referencia escribe fincaReference en el portapapeles", async () => {
    const escritos: string[] = [];
    const ok = await copiarAlPortapapeles(GODELLETA.fincaReference, async (texto) => {
      escritos.push(texto);
    });
    assert.equal(ok, true);
    assert.deepEqual(escritos, ["2749704YJ0624N"]);
    const fallo = await copiarAlPortapapeles("x", async () => {
      throw new Error("denegado");
    });
    assert.equal(fallo, false);
    assert.equal(await copiarAlPortapapeles("x", null), false);
  });

  it("17. copiar dirección usa solo sigla + vía + número + número2", async () => {
    assert.equal(direccionOficial(A), "CL FUENCARRAL 50");
    assert.equal(direccionOficial(finca("1", { address: { sigla: "CL", via: "FUENCARRAL", numero: "50", numero2: "BIS" } })), "CL FUENCARRAL 50BIS");
    // Catastro envía snp "0" cuando no hay segundo número (caso real CL FUENCARRAL 13).
    const trece = finca("0549706VK4704H", { address: { sigla: "CL", via: "FUENCARRAL", numero: "13", numero2: "0", provincia: "MADRID", municipio: "MADRID" } });
    assert.equal(direccionOficial(trece), "CL FUENCARRAL 13");
    assert.equal(filaCsvDesdeFinca(trece)["Número secundario"], "");
    assert.equal(filaCsvDesdeFinca(trece)["Número"], "13");
    assert.equal(direccionOficial(finca("1", { address: { sigla: "CL", via: "FUENCARRAL" }, portals: ["48", "50"] })), "CL FUENCARRAL");
    assert.equal(direccionOficial(finca("1", { address: { sigla: null, via: null, literal: "CL FUENCARRAL 50 MADRID (MADRID)" }, portals: [] })), "CL FUENCARRAL 50 MADRID (MADRID)");
    const escritos: string[] = [];
    await copiarAlPortapapeles(direccionOficial(GODELLETA), async (t) => {
      escritos.push(t);
    });
    assert.deepEqual(escritos, ["CL GUAYANA-MOJONERA 3"]);
  });

  it("18. el detalle sale de la finca ya cargada, sin peticiones", () => {
    const original = globalThis.fetch;
    let llamadas = 0;
    globalThis.fetch = (async () => {
      llamadas += 1;
      throw new Error("no debería llamarse");
    }) as typeof fetch;
    try {
      const detalle = detalleFinca(GODELLETA);
      assert.equal(llamadas, 0);
      assert.deepEqual(
        detalle.general.map((d) => d.label),
        ["Referencia finca", "Provincia", "Municipio", "Dirección", "Código postal", "Superficie solar", "División horizontal", "Portal", "Número de inmuebles"]
      );
      assert.equal(detalle.general.find((d) => d.label === "Superficie solar")?.value, "839 m²");
      assert.equal(detalle.general.find((d) => d.label === "Código postal")?.value, "46388");
      assert.equal(detalle.general.some((d) => d.label === "Motivo"), false);
      const detalleUnknown = detalleFinca(
        finca("MIXMIXMIXMIXMI", {
          horizontalDivision: { status: "UNKNOWN", reasonCode: "MIXED_URBAN_RURAL" },
        })
      );
      assert.equal(detalleUnknown.general.find((d) => d.label === "División horizontal")?.value, "NO DETERMINADO");
      assert.equal(detalleUnknown.general.find((d) => d.label === "Motivo")?.value, "Parcela urbano-rústica");
      assert.equal(detalle.inmuebles.length, 1);
      assert.equal(detalle.inmuebles[0].reference, "2749704YJ0624N0001XX");
      assert.deepEqual(
        detalle.inmuebles[0].datos.map((d) => `${d.label}=${d.value}`),
        ["Superficie=120 m²", "Año=1980", "Uso=Residencial", "Código postal=46388"]
      );
    } finally {
      globalThis.fetch = original;
    }
  });
});
