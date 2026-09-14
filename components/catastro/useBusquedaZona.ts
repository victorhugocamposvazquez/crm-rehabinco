"use client";

import { useEffect, useRef, useState } from "react";
import { recordarResultadosPorId } from "@/lib/catastro/explorer/history-ui";
import { ErrorBusquedaUi } from "@/lib/catastro/search-ui";
import {
  ESTADO_ZONA_INICIAL,
  aplicarErrorZona,
  aplicarSnapshotZona,
  criteriosSiguienteBloque,
  debeContinuarPasos,
  esFalloTransitorioZona,
  ejecutarBucleZona,
  fetchZonaCancelar,
  fetchZonaEstado,
  fetchZonaPaso,
  fetchZonaPreparar,
  fetchZonaReanudar,
  idZonaActiva,
  iniciarTramo,
  plegarBloque,
  puedeSeguirTrasFalloZona,
  ZONE_STEP_CLIENT_BUDGET_MS,
  ZONE_STEP_FIRST_BUDGET_MS,
  type CriteriosZonaUi,
  type EstadoZonaUi,
} from "@/lib/catastro/zone-ui";

function recordarZona(id: string | null | undefined) {
  if (id) recordarResultadosPorId(id);
}

function esAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}

function errorDe(error: unknown): { status?: number; message: string } {
  if (error instanceof ErrorBusquedaUi) return { status: error.status, message: error.message };
  return { message: "No se ha podido continuar la búsqueda por zona. Inténtalo de nuevo." };
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Estado asíncrono de la búsqueda por zona: preparar → comenzar → pasos encadenados →
 * cancelar / reanudar. El `zoneSearchId` vive en memoria mientras dure la pestaña.
 */
export function useBusquedaZona() {
  const [estado, setEstado] = useState<EstadoZonaUi>(ESTADO_ZONA_INICIAL);
  const [cancelando, setCancelando] = useState(false);
  const [ahora, setAhora] = useState(() => Date.now());
  const abortRef = useRef<AbortController | null>(null);
  const zoneIdRef = useRef<string | null>(null);
  const criteriosRef = useRef<CriteriosZonaUi | null>(null);
  const reintento410 = useRef(false);
  const opRef = useRef(0);
  const estadoRef = useRef(estado);
  estadoRef.current = estado;

  const ejecutando = estado.fase === "ejecutando";

  useEffect(() => {
    if (!ejecutando) return;
    const timer = setInterval(() => setAhora(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [ejecutando]);

  useEffect(() => {
    if (!ejecutando) return;
    const id = zoneIdRef.current;
    if (!id) return;
    const timer = setInterval(() => {
      void fetchZonaEstado(id)
        .then((snapshot) => {
          if (!zoneIdRef.current || zoneIdRef.current !== snapshot.zoneSearchId) return;
          recordarZona(snapshot.zoneSearchId);
          setEstado((prev) =>
            aplicarSnapshotZona(prev, snapshot, { ejecutando: debeContinuarPasos(snapshot) })
          );
        })
        .catch(() => undefined);
    }, 8_000);
    return () => clearInterval(timer);
  }, [ejecutando]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const bucle = async (zoneSearchId: string, op: number) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setAhora(Date.now());
    setEstado((prev) => iniciarTramo(prev, Date.now()));
    try {
      let primerPaso = true;
      await ejecutarBucleZona({
        paso: (signal) => {
          const budgetMs = primerPaso ? ZONE_STEP_FIRST_BUDGET_MS : ZONE_STEP_CLIENT_BUDGET_MS;
          primerPaso = false;
          return fetchZonaPaso(zoneSearchId, signal, budgetMs);
        },
        onSnapshot: (snapshot) => {
          if (opRef.current !== op || controller.signal.aborted) return;
          zoneIdRef.current = snapshot.zoneSearchId;
          recordarZona(snapshot.zoneSearchId);
          setEstado((prev) =>
            aplicarSnapshotZona(prev, snapshot, { ejecutando: debeContinuarPasos(snapshot) })
          );
          setAhora(Date.now());
        },
        signal: controller.signal,
      });
    } catch (error) {
      if (opRef.current !== op || esAbortError(error) || controller.signal.aborted) return;
      const detalle = errorDe(error);
      const criterios = criteriosRef.current;
      if (detalle.status === 410 && criterios && !reintento410.current) {
        reintento410.current = true;
        await preparar(criterios, { conservarAcumulado: true, noCancelar: true });
        const nuevoId = zoneIdRef.current;
        if (nuevoId) {
          await bucle(nuevoId, opRef.current);
          return;
        }
      }
      if (opRef.current !== op) return;
      if (esFalloTransitorioZona(detalle.status) && puedeSeguirTrasFalloZona(estadoRef.current.snapshot)) {
        await esperar(2_000);
        if (opRef.current !== op) return;
        try {
          let snapshot = await fetchZonaEstado(zoneSearchId);
          if (opRef.current !== op) return;
          if (snapshot.nextAction === "resume") {
            snapshot = await fetchZonaReanudar(snapshot.zoneSearchId, false);
            if (opRef.current !== op) return;
          }
          zoneIdRef.current = snapshot.zoneSearchId;
          recordarZona(snapshot.zoneSearchId);
          setEstado((prev) =>
            aplicarSnapshotZona(prev, snapshot, { ejecutando: debeContinuarPasos(snapshot) })
          );
          if (puedeSeguirTrasFalloZona(snapshot)) await bucle(zoneSearchId, op);
          return;
        } catch {
          // El servidor puede seguir; no pintamos el error rojo de la pestaña.
          return;
        }
      }
      setEstado((prev) => aplicarErrorZona(prev, detalle));
    }
  };

  /** Si había una zona en marcha, se pide al servidor que deje de programar calles. */
  const soltarZonaActual = () => {
    abortRef.current?.abort();
    const anterior = zoneIdRef.current;
    if (anterior && (estadoRef.current.fase === "ejecutando" || estadoRef.current.fase === "preparada")) {
      void fetchZonaCancelar(anterior).catch(() => undefined);
    }
  };

  const preparar = async (
    criterios: CriteriosZonaUi,
    opciones: { conservarAcumulado?: boolean; noCancelar?: boolean } = {}
  ) => {
    const op = ++opRef.current;
    if (!opciones.noCancelar) soltarZonaActual();
    const controller = new AbortController();
    abortRef.current = controller;
    zoneIdRef.current = null;
    criteriosRef.current = criterios;
    if (!opciones.conservarAcumulado) reintento410.current = false;
    setCancelando(false);
    setEstado((prev) => ({
      ...(opciones.conservarAcumulado ? prev : ESTADO_ZONA_INICIAL),
      fase: "preparando",
      error: null,
      acumulado: opciones.conservarAcumulado ? prev.acumulado : null,
    }));
    const intentos = opciones.conservarAcumulado ? 3 : 1;
    let ultimoError: unknown;
    for (let intento = 0; intento < intentos; intento += 1) {
      try {
        const snapshot = await fetchZonaPreparar(criterios, controller.signal);
        if (opRef.current !== op || controller.signal.aborted) return;
        zoneIdRef.current = snapshot.zoneSearchId;
        recordarZona(snapshot.zoneSearchId);
        setEstado((prev) => aplicarSnapshotZona(prev, snapshot));
        return;
      } catch (error) {
        ultimoError = error;
        if (opRef.current !== op || esAbortError(error) || controller.signal.aborted) return;
        if (intento < intentos - 1) await esperar(700 * (intento + 1));
      }
    }
    if (opRef.current !== op || esAbortError(ultimoError)) return;
    setEstado((prev) => {
      if (opciones.conservarAcumulado && prev.snapshot) {
        return {
          ...aplicarErrorZona(prev, {
            ...errorDe(ultimoError),
            message:
              "No se ha podido preparar el siguiente bloque. Vuelve a pulsar el botón; lo ya encontrado se conserva.",
          }),
          fase: prev.snapshot.status === "done" ? "completada" : "error",
        };
      }
      return aplicarErrorZona({ ...prev, fase: "formulario" }, errorDe(ultimoError));
    });
  };

  const siguienteBloque = async (criterios: CriteriosZonaUi) => {
    const actual = estado.snapshot;
    if (!actual) return;
    const siguientes = criteriosSiguienteBloque(criterios, actual);
    if (!siguientes) return;
    setEstado((prev) => plegarBloque(prev));
    await preparar(siguientes, { conservarAcumulado: true, noCancelar: true });
  };

  const comenzar = () => {
    const id = idZonaActiva(estadoRef.current, zoneIdRef.current);
    if (!id) return;
    zoneIdRef.current = id;
    recordarZona(id);
    void bucle(id, ++opRef.current);
  };

  const cancelar = async () => {
    const id = idZonaActiva(estadoRef.current, zoneIdRef.current);
    if (!id) return;
    const op = ++opRef.current;
    abortRef.current?.abort();
    setCancelando(true);
    try {
      let snapshot = await fetchZonaCancelar(id);
      for (let intento = 0; snapshot.status === "running" && intento < 20; intento += 1) {
        if (opRef.current !== op) return;
        await esperar(1_000);
        snapshot = await fetchZonaEstado(id);
      }
      if (opRef.current !== op) return;
      zoneIdRef.current = snapshot.zoneSearchId;
      recordarZona(snapshot.zoneSearchId);
      setEstado((prev) => aplicarSnapshotZona(prev, snapshot));
    } catch (error) {
      if (opRef.current !== op) return;
      setEstado((prev) => aplicarErrorZona(prev, errorDe(error)));
    } finally {
      if (opRef.current === op) setCancelando(false);
    }
  };

  const reanudar = async (reintentarErrores = false) => {
    const zoneSearchId = idZonaActiva(estadoRef.current, zoneIdRef.current);
    if (!zoneSearchId) {
      setEstado((prev) =>
        aplicarErrorZona(prev, {
          message: "No hay una zona pausada en esta pestaña. Ábrela de nuevo desde el historial.",
        })
      );
      return;
    }
    const op = ++opRef.current;
    zoneIdRef.current = zoneSearchId;
    recordarZona(zoneSearchId);
    abortRef.current?.abort();
    setCancelando(false);
    try {
      const snapshot = await fetchZonaReanudar(zoneSearchId, reintentarErrores);
      if (opRef.current !== op) return;
      zoneIdRef.current = snapshot.zoneSearchId;
      recordarZona(snapshot.zoneSearchId);
      setEstado((prev) => aplicarSnapshotZona(prev, snapshot, { ejecutando: true }));
    } catch (error) {
      if (opRef.current !== op) return;
      setEstado((prev) => aplicarErrorZona(prev, errorDe(error)));
      return;
    }
    if (opRef.current !== op) return;
    await bucle(zoneIdRef.current ?? zoneSearchId, op);
  };

  const nueva = () => {
    opRef.current += 1;
    soltarZonaActual();
    zoneIdRef.current = null;
    setCancelando(false);
    setEstado(ESTADO_ZONA_INICIAL);
  };

  const continuar = async (zoneSearchId: string) => {
    if (!zoneSearchId) return;
    if (zoneIdRef.current === zoneSearchId && estadoRef.current.fase === "ejecutando") return;
    const op = ++opRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    zoneIdRef.current = zoneSearchId;
    recordarZona(zoneSearchId);
    setCancelando(false);
    try {
      const snapshot = await fetchZonaEstado(zoneSearchId, controller.signal);
      if (opRef.current !== op || controller.signal.aborted) return;
      zoneIdRef.current = snapshot.zoneSearchId;
      recordarZona(snapshot.zoneSearchId);
      criteriosRef.current = {
        provincia: snapshot.criteria.provincia,
        municipio: snapshot.criteria.municipio,
        postalCode: snapshot.criteria.postalCode,
        horizontalDivision: snapshot.criteria.horizontalDivision,
        streetOffset: snapshot.criteria.streetOffset,
      };
      setEstado((prev) => aplicarSnapshotZona(prev, snapshot));
      if (snapshot.nextAction === "resume" || snapshot.nextAction === "step") {
        if (snapshot.nextAction === "resume") {
          const reanudada = await fetchZonaReanudar(snapshot.zoneSearchId, false);
          if (opRef.current !== op) return;
          zoneIdRef.current = reanudada.zoneSearchId;
          recordarZona(reanudada.zoneSearchId);
          setEstado((prev) => aplicarSnapshotZona(prev, reanudada, { ejecutando: true }));
        }
        await bucle(zoneIdRef.current ?? snapshot.zoneSearchId, op);
      }
    } catch (error) {
      if (opRef.current !== op || esAbortError(error) || controller.signal.aborted) return;
      setEstado((prev) => aplicarErrorZona(prev, errorDe(error)));
    }
  };

  return { estado, ahora, cancelando, preparar, comenzar, cancelar, reanudar, siguienteBloque, nueva, continuar };
}
