"use client";

import { useEffect, useRef, useState } from "react";
import { ErrorBusquedaUi } from "@/lib/catastro/search-ui";
import {
  ESTADO_ZONA_INICIAL,
  aplicarErrorZona,
  aplicarSnapshotZona,
  debeContinuarPasos,
  ejecutarBucleZona,
  fetchZonaCancelar,
  fetchZonaEstado,
  fetchZonaPaso,
  fetchZonaPreparar,
  fetchZonaReanudar,
  iniciarTramo,
  plegarBloque,
  ZONE_STEP_CLIENT_BUDGET_MS,
  ZONE_STEP_FIRST_BUDGET_MS,
  type CriteriosZonaUi,
  type EstadoZonaUi,
} from "@/lib/catastro/zone-ui";

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

  const ejecutando = estado.fase === "ejecutando";

  useEffect(() => {
    if (!ejecutando) return;
    const timer = setInterval(() => setAhora(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [ejecutando]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const bucle = async (zoneSearchId: string) => {
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
          if (controller.signal.aborted || zoneIdRef.current !== zoneSearchId) return;
          setEstado((prev) =>
            aplicarSnapshotZona(prev, snapshot, { ejecutando: debeContinuarPasos(snapshot) })
          );
          setAhora(Date.now());
        },
        signal: controller.signal,
      });
    } catch (error) {
      if (esAbortError(error) || controller.signal.aborted) return;
      const detalle = errorDe(error);
      const criterios = criteriosRef.current;
      if (detalle.status === 410 && criterios && !reintento410.current) {
        reintento410.current = true;
        await preparar(criterios, { conservarAcumulado: true });
        const nuevoId = zoneIdRef.current;
        if (nuevoId && !controller.signal.aborted) {
          await bucle(nuevoId);
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
    if (anterior && (estado.fase === "ejecutando" || estado.fase === "preparada")) {
      void fetchZonaCancelar(anterior).catch(() => undefined);
    }
  };

  const preparar = async (
    criterios: CriteriosZonaUi,
    opciones: { conservarAcumulado?: boolean } = {}
  ) => {
    soltarZonaActual();
    const controller = new AbortController();
    abortRef.current = controller;
    zoneIdRef.current = null;
    criteriosRef.current = criterios;
    if (!opciones.conservarAcumulado) reintento410.current = false;
    setCancelando(false);
    setEstado((prev) => ({
      ...ESTADO_ZONA_INICIAL,
      fase: "preparando",
      acumulado: opciones.conservarAcumulado ? prev.acumulado : null,
    }));
    try {
      const snapshot = await fetchZonaPreparar(criterios, controller.signal);
      if (controller.signal.aborted) return;
      zoneIdRef.current = snapshot.zoneSearchId;
      setEstado((prev) => aplicarSnapshotZona(prev, snapshot));
    } catch (error) {
      if (esAbortError(error) || controller.signal.aborted) return;
      setEstado((prev) => aplicarErrorZona({ ...prev, fase: "formulario" }, errorDe(error)));
    }
  };

  const siguienteBloque = async (criterios: CriteriosZonaUi) => {
    const actual = estado.snapshot;
    if (!actual) return;
    const offset = (actual.coverage.streetOffset ?? 0) + actual.progress.streetsFound;
    setEstado((prev) => plegarBloque(prev));
    await preparar({ ...criterios, streetOffset: offset }, { conservarAcumulado: true });
  };

  const comenzar = () => {
    const id = zoneIdRef.current;
    if (!id) return;
    void bucle(id);
  };

  const cancelar = async () => {
    const id = zoneIdRef.current;
    if (!id) return;
    abortRef.current?.abort();
    setCancelando(true);
    try {
      let snapshot = await fetchZonaCancelar(id);
      // El paso en vuelo termina solo al acabar la página en curso; esperamos a que lo haga.
      for (let intento = 0; snapshot.status === "running" && intento < 20; intento += 1) {
        await esperar(1_000);
        snapshot = await fetchZonaEstado(id);
      }
      if (zoneIdRef.current !== id) return;
      setEstado((prev) => aplicarSnapshotZona(prev, snapshot));
    } catch (error) {
      if (zoneIdRef.current !== id) return;
      setEstado((prev) => aplicarErrorZona(prev, errorDe(error)));
    } finally {
      if (zoneIdRef.current === id) setCancelando(false);
    }
  };

  const reanudar = async (reintentarErrores = false) => {
    const id = zoneIdRef.current;
    if (!id) return;
    try {
      const snapshot = await fetchZonaReanudar(id, reintentarErrores);
      if (zoneIdRef.current !== id) return;
      setEstado((prev) => aplicarSnapshotZona(prev, snapshot, { ejecutando: true }));
    } catch (error) {
      if (zoneIdRef.current !== id) return;
      setEstado((prev) => aplicarErrorZona(prev, errorDe(error)));
      return;
    }
    await bucle(id);
  };

  const nueva = () => {
    soltarZonaActual();
    zoneIdRef.current = null;
    setCancelando(false);
    setEstado(ESTADO_ZONA_INICIAL);
  };

  return { estado, ahora, cancelando, preparar, comenzar, cancelar, reanudar, siguienteBloque, nueva };
}
