"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  ERROR_HISTORICO,
  FILTROS_LISTADO_HISTORICO,
  RUTA_EXPLORER,
  TEXTO_CARGANDO_BUSQUEDAS,
  TEXTO_REINTENTAR,
  fetchHistoricoBusquedas,
  formatoNumeroEs,
  type FiltroListadoHistorico,
  type ResumenBusquedaUi,
} from "@/lib/catastro/explorer/history-ui";
import { EXPLORER_SEARCHES_PAGE_SIZE } from "@/lib/catastro/explorer";
import { AccionNuevaBusqueda } from "./AccionNuevaBusqueda";
import { CatastroSubnav } from "./CatastroSubnav";
import { TarjetaBusquedaReciente } from "./TarjetaBusquedaReciente";

export function HistoricoBusquedas() {
  const [items, setItems] = useState<ResumenBusquedaUi[] | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filtro, setFiltro] = useState<FiltroListadoHistorico>("ALL");
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    setItems(null);
    fetchHistoricoBusquedas(
      { limit: EXPLORER_SEARCHES_PAGE_SIZE, offset, mode: filtro },
      controller.signal
    )
      .then((data) => {
        setItems(data.searches);
        setTotal(data.total);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(ERROR_HISTORICO);
      });
    return () => controller.abort();
  }, [offset, filtro, intento]);

  return (
    <div>
      <CatastroSubnav />
      <PageHeader
        breadcrumb={[
          { label: "Catastro", href: RUTA_EXPLORER },
          { label: "Historial" },
        ]}
        title="Historial"
        description="Todas tus búsquedas guardadas, sin volver a consultar Catastro."
        actions={<AccionNuevaBusqueda />}
      />

      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Filtrar historial">
        {FILTROS_LISTADO_HISTORICO.map((item) => (
          <Button
            key={item.value}
            type="button"
            size="sm"
            variant={filtro === item.value ? "default" : "secondary"}
            onClick={() => {
              setFiltro(item.value);
              setOffset(0);
            }}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {error ? (
        <div className="mt-6">
          <p className="text-sm text-neutral-600">{error}</p>
          <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => setIntento((n) => n + 1)}>
            {TEXTO_REINTENTAR}
          </Button>
        </div>
      ) : items === null ? (
        <p className="mt-6 text-sm text-neutral-500" aria-live="polite">
          {TEXTO_CARGANDO_BUSQUEDAS}
        </p>
      ) : items.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">Todavía no hay búsquedas guardadas.</p>
      ) : (
        <>
          <p className="mt-4 text-sm text-neutral-600">
            {formatoNumeroEs(total)} {total === 1 ? "búsqueda" : "búsquedas"}
          </p>
          <ul className="mt-3 grid grid-cols-1 gap-3">
            {items.map((item) => (
              <li key={item.id}>
                <TarjetaBusquedaReciente
                  item={item}
                  onEliminada={(id) => {
                    setItems((prev) => {
                      const resto = prev?.filter((busqueda) => busqueda.id !== id) ?? [];
                      if (resto.length === 0 && offset > 0) {
                        setOffset(Math.max(0, offset - EXPLORER_SEARCHES_PAGE_SIZE));
                      }
                      return resto;
                    });
                    setTotal((prev) => Math.max(0, prev - 1));
                  }}
                />
              </li>
            ))}
          </ul>
          {total > EXPLORER_SEARCHES_PAGE_SIZE ? (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - EXPLORER_SEARCHES_PAGE_SIZE))}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={offset + items.length >= total}
                onClick={() => setOffset(offset + EXPLORER_SEARCHES_PAGE_SIZE)}
              >
                Siguiente
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
