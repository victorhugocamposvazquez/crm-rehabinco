import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AVISO_EXPORTACION_CORTE,
  AVISO_EXPORTACION_INCOMPLETA,
  SELECCION_VACIA,
  alternarSeleccion,
  estaSeleccionada,
  prepararExportacionCsv,
  seleccionParaBusqueda,
} from "./selection-export";
import { ErrorBusquedaUi, type FincaBusquedaUi } from "./search-ui";
import {
  ESTADO_ZONA_INICIAL,
  EXPLICACION_ZONA,
  accionesDisponibles,
  aplicarErrorZona,
  aplicarSnapshotZona,
  camposVisibles,
  claveZonaUi,
  coberturaExportacionZona,
  criteriosExportacionZona,
  criteriosMunicipioListos,
  criteriosZonaListos,
  textoSesionCaducada,
  textoZonaDemasiadoGrande,
  zonaDemasiadoGrande,
  debeContinuarPasos,
  etiquetaCandidatas,
  ejecutarBucleZona,
  estadoAlCambiarModo,
  iniciarTramo,
  listaErrores,
  modoDesdeTexto,
  ritmoMedido,
  textoCallesARevisar,
  textoEstadoFinal,
  textoPreparacion,
  textosProgreso,
  validarCodigoPostalZona,
  type EstadoZonaUi,
  type ZoneSnapshotUi,
} from "./zone-ui";

function finca(ref: string, numero: string, via = "GUAYANA-MOJONERA"): FincaBusquedaUi {
  return {
    fincaReference: ref,
    portals: [numero],
    address: { provincia: "VALENCIA", municipio: "GODELLETA", sigla: "CL", via, numero },
    postalCode: "46388",
    postalCodes: ["46388"],
    horizontalDivision: { status: "NO" },
    properties: [{ reference: `${ref}0001AA`, postalCode: "46388" }],
  };
}

type SnapshotParcial = Omit<Partial<ZoneSnapshotUi>, "progress" | "coverage"> & {
  progress?: Partial<ZoneSnapshotUi["progress"]>;
  coverage?: Partial<ZoneSnapshotUi["coverage"]>;
};

function snapshot(parcial: SnapshotParcial = {}): ZoneSnapshotUi {
  const progress = {
    streetsFound: 40,
    streetsProcessed: 0,
    streetsWithErrors: 0,
    streetsPending: 40,
    streetsInProgress: 0,
    fincasFound: 0,
    candidates: 0,
    portalsProcessed: 0,
    steps: 0,
    workMs: 0,
    ...parcial.progress,
  };
  const coverage = {
    streetsFound: progress.streetsFound,
    streetsProcessed: progress.streetsProcessed,
    streetsWithErrors: progress.streetsWithErrors,
    complete: false,
    completeCandidates: false,
    possibleCut: false,
    ...parcial.coverage,
  };
  return {
    ok: true,
    zoneSearchId: "zona-1",
    status: "prepared",
    criteria: { provincia: "VALENCIA", municipio: "GODELLETA", postalCode: "46388", horizontalDivision: "NO" },
    results: [],
    errors: [],
    nextAction: "start",
    ...parcial,
    progress,
    coverage,
  };
}

const enCurso = snapshot({
  status: "paused",
  nextAction: "step",
  progress: { streetsFound: 427, streetsProcessed: 17, streetsPending: 410, fincasFound: 8, candidates: 5, streetsWithErrors: 1, steps: 3, portalsProcessed: 340 },
  results: [finca("2749704YJ0624N", "3")],
  errors: [{ street: "CL ROTA", error: "Error externo de Catastro o INSPIRE." }],
});

describe("Zona UI: modo y formulario", () => {
  it("1. cambia entre Calle y Código postal y adapta los campos", () => {
    assert.equal(modoDesdeTexto(null), "calle");
    assert.equal(modoDesdeTexto("ZONA"), "zona");
    assert.equal(modoDesdeTexto("otro"), "calle");
    assert.deepEqual(camposVisibles("calle"), { calle: true, numero: true, postalCode: true, division: true });
    assert.deepEqual(camposVisibles("zona"), { calle: false, numero: false, postalCode: true, division: true });
    assert.deepEqual(estadoAlCambiarModo(), ESTADO_ZONA_INICIAL, "al cambiar de modo se limpia la zona");
    assert.match(EXPLICACION_ZONA, /no permite buscar directamente por código postal/);
    assert.doesNotMatch(EXPLICACION_ZONA, /WFS|DNPLOC|INSPIRE/);
  });

  it("2. el formulario de zona exige provincia, municipio y CP de 5 dígitos (NO por defecto)", () => {
    assert.equal(validarCodigoPostalZona(""), "Indica el código postal.");
    assert.equal(validarCodigoPostalZona("4638"), "El código postal debe tener 5 dígitos.");
    assert.equal(validarCodigoPostalZona("46388"), null);
    assert.equal(criteriosZonaListos({ provincia: "VALENCIA", municipio: null, postalCode: "46388", horizontalDivision: "NO" }), null);
    assert.equal(criteriosZonaListos({ provincia: "VALENCIA", municipio: "GODELLETA", postalCode: "463", horizontalDivision: "NO" }), null);
    assert.deepEqual(
      criteriosZonaListos({ provincia: "VALENCIA", municipio: "GODELLETA", postalCode: " 46388 ", horizontalDivision: "" }),
      { provincia: "VALENCIA", municipio: "GODELLETA", postalCode: "46388", horizontalDivision: "NO" }
    );
    assert.deepEqual(
      criteriosMunicipioListos({
        provincia: "A CORUÑA",
        municipio: "A CORUÑA",
        postalCode: "",
        horizontalDivision: "NO",
      }),
      { provincia: "A CORUÑA", municipio: "A CORUÑA", postalCode: "", horizontalDivision: "NO" }
    );
    assert.equal(
      criteriosMunicipioListos({
        provincia: "A CORUÑA",
        municipio: "A CORUÑA",
        postalCode: "150",
        horizontalDivision: "NO",
      }),
      null
    );
  });
});

describe("Zona UI: preparación y confirmación", () => {
  it("3. tras preparar muestra cuántas calles oficiales hay y no ejecuta nada", () => {
    const estado = aplicarSnapshotZona(ESTADO_ZONA_INICIAL, snapshot());
    assert.equal(estado.fase, "preparada");
    assert.equal(estado.zoneSearchId, "zona-1");
    assert.equal(
      textoPreparacion(427, "46388"),
      "Se han encontrado 427 calles oficiales en este municipio. La búsqueda recorrerá esas calles y filtrará después por código postal."
    );
    assert.match(textoPreparacion(427), /todas esas calles del municipio/);
    assert.match(textoPreparacion(1), /^Se ha encontrado 1 calle oficial/);
    assert.match(textoPreparacion(0), /No hay nada que recorrer/);
    assert.equal(textoCallesARevisar(427), "Se revisarán 427 calles. Puedes parar cuando quieras.");
    assert.equal(zonaDemasiadoGrande(40), false);
    assert.equal(zonaDemasiadoGrande(14991), true);
    assert.match(textoZonaDemasiadoGrande(14991, "A CORUÑA"), /elige una calle/i);
  });

  it("4. la búsqueda solo arranca con confirmación explícita (Comenzar)", () => {
    const preparada = aplicarSnapshotZona(ESTADO_ZONA_INICIAL, snapshot());
    const acciones = accionesDisponibles(preparada);
    assert.equal(acciones.comenzar, true);
    assert.equal(acciones.cancelar, false);
    assert.equal(acciones.reanudar, false);
    const sinCalles = aplicarSnapshotZona(ESTADO_ZONA_INICIAL, snapshot({ progress: { streetsFound: 0, streetsPending: 0 } }));
    assert.equal(accionesDisponibles(sinCalles).comenzar, false, "sin calles no hay nada que comenzar");
    const arrancada = iniciarTramo(preparada, 1_000);
    assert.equal(arrancada.fase, "ejecutando");
    assert.equal(arrancada.inicioMs, 1_000);
    assert.equal(accionesDisponibles(arrancada).cancelar, true);
    assert.equal(accionesDisponibles(arrancada).comenzar, false);
  });
});

describe("Zona UI: progreso y resultados", () => {
  it("5. muestra el progreso con calles, fincas, candidatas y errores", () => {
    const textos = textosProgreso(enCurso);
    assert.equal(textos.calles, "Calles revisadas: 17 / 427");
    assert.equal(textos.fincas, "Fincas encontradas: 8");
    assert.equal(textos.candidatas, "Candidatas sin división horizontal: 5");
    assert.equal(textos.errores, "Calles con errores: 1");
    assert.equal(textos.porcentaje, 3);
    assert.equal(textosProgreso(snapshot()).errores, null);
    const conYes = snapshot({ criteria: { ...enCurso.criteria, horizontalDivision: "YES" } });
    assert.match(textosProgreso(conYes).candidatas, /^Fincas con división horizontal: /);
    assert.equal(etiquetaCandidatas("NOT_APPLICABLE"), "Fincas no aplicables");
    assert.notEqual(etiquetaCandidatas("NOT_APPLICABLE"), "Candidatas sin división horizontal");
    // Ritmo: solo hechos medidos y tras varias calles; nunca un tiempo estimado.
    const estado = iniciarTramo(aplicarSnapshotZona(ESTADO_ZONA_INICIAL, snapshot()), 0);
    assert.equal(ritmoMedido(snapshot({ progress: { streetsProcessed: 3 } }), estado, 60_000), null);
    const ritmo = ritmoMedido(enCurso, estado, 60_000);
    assert.equal(ritmo, "Ritmo medido: 17 calles/min · 340 portales revisados. La duración depende de los portales de cada calle.");
    assert.doesNotMatch(ritmo ?? "", /quedan|restante|ETA/i);
  });

  it("6. los resultados llegan de forma progresiva con cada paso", async () => {
    const pasos = [
      snapshot({ status: "paused", progress: { streetsProcessed: 5, steps: 1, fincasFound: 1, candidates: 1 }, results: [finca("A", "1")] }),
      snapshot({ status: "paused", progress: { streetsProcessed: 12, steps: 2, fincasFound: 2, candidates: 2 }, results: [finca("A", "1"), finca("B", "5")] }),
      snapshot({
        status: "done",
        nextAction: "none",
        progress: { streetsProcessed: 427, streetsPending: 0, steps: 3, fincasFound: 3, candidates: 3 },
        coverage: { complete: true, completeCandidates: true },
        results: [finca("A", "1"), finca("B", "5"), finca("C", "7")],
      }),
    ];
    const recibidos: number[] = [];
    let llamadas = 0;
    const final = await ejecutarBucleZona({
      paso: async () => pasos[llamadas++] ?? pasos[pasos.length - 1]!,
      onSnapshot: (s) => recibidos.push(s.results.length),
      signal: new AbortController().signal,
    });
    assert.deepEqual(recibidos, [1, 2, 3]);
    assert.equal(llamadas, 3, "se detiene cuando el servidor dice done");
    assert.equal(final?.status, "done");
    assert.equal(debeContinuarPasos(pasos[0]!), true);
    assert.equal(debeContinuarPasos(pasos[2]!), false);
    assert.equal(debeContinuarPasos(snapshot({ status: "cancelled" })), false);
    assert.equal(debeContinuarPasos(snapshot({ status: "upstream_paused" })), false);
  });

  it("6b. si otro paso está en curso (409) espera y reintenta sin duplicar trabajo", async () => {
    let llamadas = 0;
    const esperas: number[] = [];
    const final = await ejecutarBucleZona({
      paso: async () => {
        llamadas += 1;
        if (llamadas === 1) throw new ErrorBusquedaUi(409, "ocupado");
        return snapshot({ status: "done", nextAction: "none" });
      },
      onSnapshot: () => {},
      signal: new AbortController().signal,
      esperar: async (ms) => {
        esperas.push(ms);
      },
    });
    assert.equal(final?.status, "done");
    assert.deepEqual(esperas, [1_000]);
    await assert.rejects(
      ejecutarBucleZona({
        paso: async () => {
          throw new ErrorBusquedaUi(502, "caído");
        },
        onSnapshot: () => {},
        signal: new AbortController().signal,
      }),
      (error: unknown) => error instanceof ErrorBusquedaUi && error.status === 502
    );
  });
});

describe("Zona UI: cancelación y reanudación", () => {
  it("7. cancelar detiene el bucle, conserva los resultados y ofrece Reanudar / Nueva búsqueda", async () => {
    const controller = new AbortController();
    const entregados: ZoneSnapshotUi[] = [];
    const parcial = snapshot({ status: "paused", progress: { streetsFound: 427, streetsProcessed: 214, streetsPending: 213, steps: 9, fincasFound: 6, candidates: 4 }, results: [finca("A", "1")] });
    const final = await ejecutarBucleZona({
      paso: async () => parcial,
      onSnapshot: (s) => {
        entregados.push(s);
        controller.abort();
      },
      signal: controller.signal,
    });
    assert.equal(entregados.length, 1, "tras abortar no se piden más pasos");
    assert.equal(final?.progress.streetsProcessed, 214);

    const cancelada = aplicarSnapshotZona(
      ESTADO_ZONA_INICIAL,
      snapshot({ ...parcial, status: "cancelled", nextAction: "resume" })
    );
    assert.equal(cancelada.fase, "cancelada");
    assert.equal(cancelada.snapshot?.results.length, 1, "los resultados se conservan");
    assert.equal(textoEstadoFinal(cancelada), "Búsqueda cancelada: 214 / 427 calles procesadas.");
    const acciones = accionesDisponibles(cancelada);
    assert.equal(acciones.reanudar, true);
    assert.equal(acciones.nuevaBusqueda, true);
    assert.equal(acciones.cancelar, false);
    assert.equal(coberturaExportacionZona(cancelada.snapshot).completeCandidates, false, "cancelada = incompleta");
  });

  it("8. reanudar continúa desde el mismo zoneSearchId sin volver al formulario", async () => {
    const cancelada = aplicarSnapshotZona(
      ESTADO_ZONA_INICIAL,
      snapshot({ status: "cancelled", nextAction: "resume", progress: { streetsProcessed: 214, streetsPending: 213, steps: 9 } })
    );
    const reanudada = aplicarSnapshotZona(
      iniciarTramo(cancelada, 5_000),
      snapshot({ status: "prepared", nextAction: "step", progress: { streetsProcessed: 214, streetsPending: 213, steps: 9 } }),
      { ejecutando: true }
    );
    assert.equal(reanudada.fase, "ejecutando");
    assert.equal(reanudada.zoneSearchId, "zona-1");
    assert.equal(reanudada.procesadasAlInicio, 214, "el ritmo se mide desde la reanudación");
    let procesadas = 214;
    const final = await ejecutarBucleZona({
      paso: async () => {
        procesadas = Math.min(427, procesadas + 100);
        return snapshot({
          status: procesadas === 427 ? "done" : "paused",
          progress: { streetsProcessed: procesadas, streetsPending: 427 - procesadas, steps: 10 },
        });
      },
      onSnapshot: () => {},
      signal: new AbortController().signal,
    });
    assert.equal(final?.status, "done");
    assert.equal(final?.progress.streetsProcessed, 427);
    // Un snapshot "prepared" con pasos previos y sin bucle activo se muestra como pausada/cancelada.
    assert.equal(aplicarSnapshotZona(cancelada, snapshot({ status: "prepared", progress: { steps: 9 } })).fase, "cancelada");
  });

  it("9. los errores parciales se muestran sin detener la búsqueda", () => {
    const estado = aplicarSnapshotZona(ESTADO_ZONA_INICIAL, enCurso, { ejecutando: true });
    assert.equal(estado.fase, "ejecutando");
    assert.equal(textosProgreso(enCurso).errores, "Calles con errores: 1");
    const muchos = Array.from({ length: 8 }, (_, i) => ({ street: `CL ${i}`, error: "Error" }));
    const lista = listaErrores(muchos);
    assert.equal(lista.lineas.length, 5);
    assert.equal(lista.resto, 3);
    assert.equal(lista.lineas[0], "CL 0: Error");
    const terminada = aplicarSnapshotZona(
      ESTADO_ZONA_INICIAL,
      snapshot({ status: "done", progress: { streetsProcessed: 427, streetsPending: 0, streetsWithErrors: 1, steps: 20 }, coverage: { complete: false, completeCandidates: false } })
    );
    assert.equal(terminada.fase, "completada");
    assert.match(textoEstadoFinal(terminada) ?? "", /1 calle con error/);
    assert.equal(accionesDisponibles(terminada).reintentarErrores, true);
    const caida = aplicarSnapshotZona(ESTADO_ZONA_INICIAL, snapshot({ status: "upstream_paused", progress: { streetsProcessed: 4, streetsWithErrors: 4, streetsPending: 423 } }));
    assert.equal(caida.fase, "pausada_por_catastro");
    assert.match(textoEstadoFinal(caida) ?? "", /Catastro no responde/);
    assert.equal(accionesDisponibles(caida).reanudar, true);
    const caducada = aplicarErrorZona(terminada, { status: 410, message: "caducada" });
    assert.equal(caducada.fase, "caducada");
    assert.equal(caducada.snapshot, terminada.snapshot, "los resultados siguen disponibles");
    assert.equal(accionesDisponibles(caducada).preparar, true);
    assert.match(textoSesionCaducada({ streetsFound: 14991, streetsProcessed: 0 }), /elige una calle/i);
    const enorme = aplicarSnapshotZona(
      ESTADO_ZONA_INICIAL,
      snapshot({ progress: { streetsFound: 14991, streetsPending: 14991 } })
    );
    assert.equal(accionesDisponibles(enorme).comenzar, false);
    const otro = aplicarErrorZona(terminada, { status: 502, message: "Catastro no está disponible." });
    assert.equal(otro.fase, "error");
    assert.equal(otro.error, "Catastro no está disponible.");
  });
});

describe("Zona UI: selección y exportación", () => {
  const criterios = { provincia: "VALENCIA", municipio: "GODELLETA", postalCode: "46388", horizontalDivision: "NO" };

  it("10. la selección sobrevive a los pasos de la misma zona y se vacía al cambiar de zona", () => {
    const clave = claveZonaUi(criterios);
    let seleccion = alternarSeleccion(SELECCION_VACIA, finca("A", "1"), clave);
    seleccion = alternarSeleccion(seleccion, finca("B", "5"), clave);
    assert.equal(seleccion.fincas.length, 2);
    // Llega otro snapshot con más resultados: misma clave → se mantiene.
    assert.equal(seleccionParaBusqueda(seleccion, clave).fincas.length, 2);
    assert.equal(estaSeleccionada(seleccion, "A"), true);
    // Otro CP → otra clave → selección vacía.
    assert.equal(seleccionParaBusqueda(seleccion, claveZonaUi({ ...criterios, postalCode: "28004" })).fincas.length, 0);
    assert.notEqual(claveZonaUi(criterios), claveZonaUi({ ...criterios, horizontalDivision: "ALL" }));
  });

  it("11. exporta con el CSV de la Fase 14 y nombre de archivo por municipio y CP", () => {
    const completa = snapshot({
      status: "done",
      progress: { streetsProcessed: 427, streetsPending: 0, steps: 30, fincasFound: 3, candidates: 2 },
      coverage: { complete: true, completeCandidates: true },
    });
    const seleccion = alternarSeleccion(SELECCION_VACIA, finca("2749704YJ0624N", "3"), claveZonaUi(criterios));
    const preparada = prepararExportacionCsv({
      seleccion,
      criterios: criteriosExportacionZona(completa),
      cobertura: coberturaExportacionZona(completa),
      fecha: new Date(2026, 8, 11),
    });
    assert.equal(preparada.ok, true);
    if (preparada.ok) {
      assert.equal(preparada.nombreArchivo, "fincas_sin_division_horizontal_Godelleta_CP46388_2026-09-11.csv");
      assert.equal(preparada.advertencia, null);
      assert.match(preparada.contenido, /2749704YJ0624N/);
      assert.match(preparada.contenido, /CL;GUAYANA-MOJONERA;3/);
    }
  });

  it("12. avisa de incompletitud si la zona no está completa o hay posible corte", () => {
    const seleccion = alternarSeleccion(SELECCION_VACIA, finca("A", "1"), claveZonaUi(criterios));
    const parcial = snapshot({ status: "paused", progress: { streetsProcessed: 100, streetsPending: 327, steps: 4 } });
    const exportParcial = prepararExportacionCsv({
      seleccion,
      criterios: criteriosExportacionZona(parcial),
      cobertura: coberturaExportacionZona(parcial),
    });
    assert.equal(exportParcial.ok && exportParcial.advertencia, AVISO_EXPORTACION_INCOMPLETA);

    const conCorte = snapshot({
      status: "done",
      progress: { streetsProcessed: 427, streetsPending: 0, steps: 30 },
      coverage: { complete: false, completeCandidates: false, possibleCut: true },
    });
    const exportCorte = prepararExportacionCsv({
      seleccion,
      criterios: criteriosExportacionZona(conCorte),
      cobertura: coberturaExportacionZona(conCorte),
    });
    assert.equal(exportCorte.ok && exportCorte.advertencia, AVISO_EXPORTACION_CORTE);

    const sinSeleccion = prepararExportacionCsv({
      seleccion: SELECCION_VACIA,
      criterios: criteriosExportacionZona(conCorte),
      cobertura: coberturaExportacionZona(conCorte),
    });
    assert.equal(sinSeleccion.ok, false);
    const estadoSinSnapshot: EstadoZonaUi = ESTADO_ZONA_INICIAL;
    assert.deepEqual(coberturaExportacionZona(estadoSinSnapshot.snapshot), { completeCandidates: false, possibleCut: false });
  });
});
