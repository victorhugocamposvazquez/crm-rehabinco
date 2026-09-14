"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ERROR_HISTORICO,
  FILTROS_LISTADO_HISTORICO,
  RUTA_EXPLORER,
  TEXTO_CARGANDO_BUSQUEDAS,
  TEXTO_REINTENTAR,
  UNIDAD_BUSQUEDAS,
  fetchHistoricoBusquedas,
  type FiltroListadoHistorico,
  type ResumenBusquedaUi,
} from "@/lib/catastro/explorer/history-ui";
import { EXPLORER_SEARCHES_PAGE_SIZE } from "@/lib/catastro/explorer";
import { CLASES_LISTA_BUSQUEDAS } from "@/lib/catastro/vista-movil";
import { AccionNuevaBusqueda } from "./AccionNuevaBusqueda";
import { BarraPaginacion } from "./BarraPaginacion";
import { TarjetaBusquedaReciente } from "./TarjetaBusquedaReciente";

export function HistoricoBusquedas() {
  const [items, setItems] = useState<ResumenBusquedaUi[] | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filtro, setFiltro] = useState<FiltroListadoHistorico>("ALL");
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [cambiandoPagina, setCambiandoPagina] = useState(false);
  const hayListado = useRef(false);
  const acumularRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    if (!hayListado.current) {
      setItems(null);
    } else {
      setCambiandoPagina(true);
    }
    fetchHistoricoBusquedas(
      { limit: EXPLORER_SEARCHES_PAGE_SIZE, offset, mode: filtro },
      controller.signal
    )
      .then((data) => {
        hayListado.current = true;
        const acumular = acumularRef.current;
        acumularRef.current = false;
        setItems((prev) => {
          if (acumular && prev) {
            const ids = new Set(prev.map((item) => item.id));
            return [...prev, ...data.searches.filter((item) => !ids.has(item.id))];
          }
          return data.searches;
        });
        setTotal(data.total);
        setCambiandoPagina(false);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        acumularRef.current = false;
        setCambiandoPagina(false);
        setError(ERROR_HISTORICO);
      });
    return () => controller.abort();
  }, [offset, filtro, intento]);

  const cargarMas = () => {
    if (!items || cambiandoPagina || items.length >= total) return;
    acumularRef.current = true;
    const siguiente = items.length;
    if (offset === siguiente) setIntento((n) => n + 1);
    else setOffset(siguiente);
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Catastro", href: RUTA_EXPLORER },
          { label: "Historial" },
        ]}
        title="Historial de rastreos"
        description="Cada rastreo guarda sus fincas y su criba. Reanuda los que quedaron a medias."
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
              hayListado.current = false;
              acumularRef.current = false;
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
        <div
          id="listado-historico-catastro"
          className={cn("scroll-mt-[6.4rem] sm:scroll-mt-[6.9rem]", cambiandoPagina && offset === 0 && "pointer-events-none opacity-60")}
        >
          <ul className={cn("mt-4", CLASES_LISTA_BUSQUEDAS)}>
            {items.map((item) => (
              <li key={item.id}>
                <TarjetaBusquedaReciente
                  item={item}
                  onEliminada={(id) => {
                    setItems((prev) => {
                      const resto = prev?.filter((busqueda) => busqueda.id !== id) ?? [];
                      if (resto.length === 0 && offset > 0) {
                        acumularRef.current = false;
                        hayListado.current = false;
                        setOffset(0);
                      }
                      return resto;
                    });
                    setTotal((prev) => Math.max(0, prev - 1));
                  }}
                />
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <BarraPaginacion
              viendo={items.length}
              total={total}
              unidad={UNIDAD_BUSQUEDAS}
              hayMas={items.length < total}
              cargando={cambiandoPagina}
              onMas={cargarMas}
            />
          </div>
        </div>
      )}
    </div>
  );
}
