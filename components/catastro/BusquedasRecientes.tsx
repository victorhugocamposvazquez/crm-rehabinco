"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ERROR_RECIENTES,
  RUTA_HISTORICO,
  TEXTO_CARGANDO_BUSQUEDAS,
  TEXTO_REINTENTAR,
  TEXTO_VER_TODO,
  fetchBusquedasRecientes,
  type ResumenBusquedaUi,
} from "@/lib/catastro/explorer/history-ui";
import { TarjetaBusquedaReciente } from "./TarjetaBusquedaReciente";

export function BusquedasRecientes({
  refreshKey = 0,
  compact = false,
}: {
  refreshKey?: number;
  compact?: boolean;
}) {
  const [items, setItems] = useState<ResumenBusquedaUi[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  const cargar = useCallback(
    (signal?: AbortSignal) => {
      setError(null);
      fetchBusquedasRecientes(20, signal)
        .then((busquedas) => {
          setItems(busquedas);
          setError(null);
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setItems(null);
          setError(ERROR_RECIENTES);
        });
    },
    []
  );

  useEffect(() => {
    const controller = new AbortController();
    cargar(controller.signal);
    return () => controller.abort();
  }, [cargar, refreshKey, intento]);

  if (error) {
    return (
      <section className={compact ? "mt-6" : "mt-2"}>
        <p className="text-sm text-neutral-600">{error}</p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={() => setIntento((n) => n + 1)}
        >
          {TEXTO_REINTENTAR}
        </Button>
      </section>
    );
  }

  if (items === null) {
    return (
      <p className="mt-6 text-sm text-neutral-500" aria-live="polite">
        {TEXTO_CARGANDO_BUSQUEDAS}
      </p>
    );
  }

  if (items.length === 0) {
    return compact ? null : (
      <p className="mt-6 text-sm text-neutral-500">Todavía no hay búsquedas guardadas.</p>
    );
  }

  return (
    <section className={compact ? "mt-6" : "mt-2"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Búsquedas recientes</h2>
        <Button asChild variant="ghost" size="sm">
          <Link href={RUTA_HISTORICO}>{TEXTO_VER_TODO}</Link>
        </Button>
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-3">
        {items.map((item) => (
          <li key={item.id}>
            <TarjetaBusquedaReciente
              item={item}
              onEliminada={(id) => setItems((prev) => prev?.filter((busqueda) => busqueda.id !== id) ?? null)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
