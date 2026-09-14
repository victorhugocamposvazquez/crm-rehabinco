"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Play } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ERROR_BUSQUEDA_404,
  ERROR_ELIMINAR,
  ESTADO_BUSQUEDA_UI,
  FILTROS_HISTORICOS,
  RUTA_EXPLORER,
  TEXTO_CARGANDO_BUSQUEDA,
  TEXTO_ELIMINAR_BUSQUEDA,
  TEXTO_REINTENTAR,
  eliminarBusquedaUi,
  coberturaHistorica,
  criteriosNombreHistorica,
  criteriosVisibles,
  fetchBusquedaPersistida,
  filtrarFincasHistoricas,
  formatoNumeroEs,
  claveHistorica,
  prepararExportacionHistorica,
  puedeReanudarHistorica,
  recuentoEstadosDesdeTotales,
  acumularFincasLista,
  revisionDesdePersistida,
  rutaFincaPersistida,
  TEXTO_REANUDAR_BUSQUEDA,
  urlReanudarBusqueda,
  textosCoberturaHistorica,
  type BusquedaRecuperadaUi,
  type FiltroHistorico,
} from "@/lib/catastro/explorer/history-ui";
import {
  FILTROS_VINCULO_PROPERTY,
  filtrarPorVinculoPropiedad,
  type CatastroPropertyLink,
  type FiltroVinculoProperty,
} from "@/lib/catastro/explorer";
import { EXPLORER_RESULTS_PAGE_SIZE } from "@/lib/catastro/explorer";
import { descargarArchivoLocal, estaSeleccionada } from "@/lib/catastro/selection-export";
import { AccionNuevaBusqueda } from "./AccionNuevaBusqueda";
import { BarraPaginacion } from "./BarraPaginacion";
import { ConfirmacionEliminarBusqueda } from "./ConfirmacionEliminarBusqueda";
import { ListaFincasCatastro } from "./ListaFincasCatastro";
import { useSeleccionFincas } from "./useSeleccionFincas";

export function BusquedaHistorica({ searchId }: { searchId: string }) {
  const router = useRouter();
  const [data, setData] = useState<BusquedaRecuperadaUi | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [filtro, setFiltro] = useState<FiltroHistorico>("ALL");
  const [filtroEstado, setFiltroEstado] = useState("ALL");
  const [filtroVinculo, setFiltroVinculo] = useState<FiltroVinculoProperty>("ALL");
  const [links, setLinks] = useState<CatastroPropertyLink[]>([]);
  const [intento, setIntento] = useState(0);
  const [confirmar, setConfirmar] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [cambiandoPagina, setCambiandoPagina] = useState(false);
  const [errorPagina, setErrorPagina] = useState<string | null>(null);
  const anclarListado = useRef(false);
  const acumularRef = useRef(false);
  const searchIdCargado = useRef<string | null>(null);
  const seleccionFincas = useSeleccionFincas();
  const { seleccion, revision } = seleccionFincas;
  const clave = claveHistorica(searchId);

  useEffect(() => {
    const controller = new AbortController();
    const mismaBusqueda = searchIdCargado.current === searchId;
    setError(null);
    setErrorPagina(null);
    if (!mismaBusqueda) {
      setData(null);
      setLinks([]);
      setCambiandoPagina(false);
    } else {
      setCambiandoPagina(true);
    }
    fetchBusquedaPersistida(
      searchId,
      {
        limit: EXPLORER_RESULTS_PAGE_SIZE,
        offset,
        status: filtroEstado,
      },
      controller.signal
    )
      .then((recuperada) => {
        const acumular = acumularRef.current;
        acumularRef.current = false;
        searchIdCargado.current = searchId;
        let fincas = recuperada.results.fincas;
        setData((prev) => {
          fincas =
            acumular && prev && prev.search.id === recuperada.search.id
              ? acumularFincasLista(prev.results.fincas, recuperada.results.fincas)
              : recuperada.results.fincas;
          return {
            ...recuperada,
            results: { ...recuperada.results, fincas },
          };
        });
        setLinks(recuperada.links ?? []);
        setCambiandoPagina(false);
        seleccionFincas.conservarPara(clave);
        seleccionFincas.hidratarRevision(
          clave,
          revisionDesdePersistida(
            clave,
            fincas,
            recuperada.reviews,
            recuperada.search.ownerId
          ).fincas
        );
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setCambiandoPagina(false);
        const mensaje = err instanceof Error ? err.message : ERROR_BUSQUEDA_404;
        if (searchIdCargado.current === searchId) setErrorPagina(mensaje);
        else setError(mensaje);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchId, offset, intento, filtroEstado]);

  useEffect(() => {
    if (!data || cambiandoPagina || !anclarListado.current) return;
    anclarListado.current = false;
    document.getElementById("listado-fincas-catastro")?.scrollIntoView({ block: "start", behavior: "auto" });
  }, [data, cambiandoPagina]);

  const cargarMas = () => {
    if (!data || cambiandoPagina) return;
    acumularRef.current = true;
    const siguiente = data.results.fincas.length;
    if (offset === siguiente) setIntento((n) => n + 1);
    else setOffset(siguiente);
  };

  const visibles = useMemo(() => {
    if (!data) return [];
    const base =
      filtro === "REVIEW"
        ? filtrarFincasHistoricas(data.results.fincas, "REVIEW", revision)
        : data.results.fincas;
    return filtrarPorVinculoPropiedad(base, links, filtroVinculo);
  }, [data, filtro, filtroVinculo, links, revision]);

  const exportarPagina = () => {
    if (!data) return;
    const preparada = prepararExportacionHistorica({
      fincas: visibles,
      seleccion,
      revision,
      criterios: criteriosNombreHistorica(data.search.criteria),
      cobertura: coberturaHistorica(data.summary.coverage ?? data.search.coverage),
    });
    if (!preparada.ok) {
      toast.error(preparada.motivo);
      return;
    }
    const ok = descargarArchivoLocal(preparada.nombreArchivo, preparada.contenido, preparada.mimeType);
    if (ok) toast.success("CSV exportado.");
    else toast.error("No se ha podido generar la descarga en este navegador.");
  };

  if (error) {
    return (
      <div>
        <PageHeader
          breadcrumb={[
            { label: "Catastro", href: RUTA_EXPLORER },
            { label: "Búsqueda" },
          ]}
          title="Búsqueda"
          actions={<AccionNuevaBusqueda />}
        />
        <p className="mt-8 text-sm text-neutral-600">{error}</p>
        {error !== ERROR_BUSQUEDA_404 ? (
          <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => setIntento((n) => n + 1)}>
            {TEXTO_REINTENTAR}
          </Button>
        ) : null}
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <p className="mt-8 text-sm text-neutral-500" aria-live="polite">
          {TEXTO_CARGANDO_BUSQUEDA}
        </p>
      </div>
    );
  }

  const cobertura = textosCoberturaHistorica(
    data.summary.coverage ?? data.search.coverage,
    data.summary.status
  );
  const criterios = criteriosVisibles(data.search.criteria);
  const cargadas = data.results.fincas.length;
  const totalListado = data.results.total;
  const barraPaginas = (
    <BarraPaginacion
      viendo={cargadas}
      total={totalListado}
      hayMas={cargadas < totalListado}
      cargando={cambiandoPagina}
      onMas={cargarMas}
    />
  );

  return (
    <div className={cn((seleccion.fincas.length > 0 || revision.fincas.length > 0) && "pb-32 md:pb-24")}>
      <PageHeader
        breadcrumb={[
          { label: "Catastro", href: RUTA_EXPLORER },
          { label: data.summary.titulo },
        ]}
        title={data.summary.titulo}
        description={`${formatoNumeroEs(data.summary.fincas)} ${data.summary.fincas === 1 ? "finca" : "fincas"} · ${formatoNumeroEs(data.summary.candidatas)} ${data.summary.candidatas === 1 ? "candidata" : "candidatas"} · ${ESTADO_BUSQUEDA_UI[data.summary.status]}${
          data.search.coverage.streetsFound
            ? ` · ${formatoNumeroEs(data.search.coverage.streetsProcessed ?? 0)} / ${formatoNumeroEs(data.search.coverage.streetsFound)} calles`
            : ""
        }`}
        actions={
          <div className="flex flex-wrap gap-2">
            {puedeReanudarHistorica({
              mode: data.search.criteria.mode,
              status: data.search.status,
              coverage: data.search.coverage,
            }) ? (
              <Button asChild size="sm">
                <a href={urlReanudarBusqueda(data.search.id, data.search.criteria)}>
                  <Play className="h-4 w-4" aria-hidden />
                  {TEXTO_REANUDAR_BUSQUEDA}
                </a>
              </Button>
            ) : null}
            <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmar(true)}>
              {TEXTO_ELIMINAR_BUSQUEDA}
            </Button>
            <AccionNuevaBusqueda size="sm" />
          </div>
        }
      />

      <p className="mt-3 text-sm text-neutral-600">{cobertura.estado}</p>
      {cobertura.corte ? <p className="mt-1 text-sm text-amber-800">{cobertura.corte}</p> : null}

      <dl className="mt-6 grid grid-cols-1 gap-3 rounded-2xl border border-border bg-white p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
        {criterios.map((item) => (
          <div key={item.label}>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              {item.label}
            </dt>
            <dd className="mt-0.5 text-sm text-foreground">{item.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtro local">
            {FILTROS_HISTORICOS.filter((item) => item.value === "REVIEW").map((item) => (
              <Button
                key={item.value}
                type="button"
                size="sm"
                variant={filtro === item.value ? "default" : "secondary"}
                onClick={() => setFiltro((prev) => (prev === "REVIEW" ? "ALL" : "REVIEW"))}
              >
                {item.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Vinculación a Property">
            {FILTROS_VINCULO_PROPERTY.map((item) => (
              <Button
                key={item.value}
                type="button"
                size="sm"
                variant={filtroVinculo === item.value ? "default" : "secondary"}
                onClick={() => setFiltroVinculo(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={exportarPagina}>
          <Download className="h-4 w-4" aria-hidden />
          Exportar CSV
        </Button>
      </div>

      <div className={cn("mt-4", cambiandoPagina && offset === 0 && "pointer-events-none opacity-60")}>
        {errorPagina ? (
          <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {errorPagina}
          </p>
        ) : null}
        <ListaFincasCatastro
          fincas={visibles}
          hrefDe={(finca) => rutaFincaPersistida(finca.fincaReference)}
          seleccionada={(ref) => estaSeleccionada(seleccion, ref)}
          vinculada={(ref) => links.some((item) => item.fincaReference === ref)}
          onToggleSeleccion={(finca) => seleccionFincas.alternar(finca, clave)}
          onMarcarPagina={(paginaLista, marcar) => seleccionFincas.marcarPagina(paginaLista, clave, marcar)}
          fincasSeleccionadas={seleccion.fincas.map((finca) => finca.fincaReference)}
          recuentoEstados={recuentoEstadosDesdeTotales(data.search.totals)}
          filtroEstado={filtroEstado}
          onFiltroEstado={(status) => {
            anclarListado.current = true;
            acumularRef.current = false;
            setFiltroEstado(status);
            setOffset(0);
          }}
          topeExterno
          pie={
            totalListado > 0 ? (
              <div className="border-t border-[#F2F0EB] px-3.5 py-3">{barraPaginas}</div>
            ) : null
          }
        />
      </div>

      {seleccionFincas.barra(() =>
        seleccionFincas.exportar(
          criteriosNombreHistorica(data.search.criteria),
          coberturaHistorica(data.summary.coverage ?? data.search.coverage)
        )
      )}
      {seleccionFincas.dialogo}
      <ConfirmacionEliminarBusqueda
        abierta={confirmar}
        cargando={borrando}
        onCancelar={() => {
          if (!borrando) setConfirmar(false);
        }}
        onConfirmar={async () => {
          setBorrando(true);
          try {
            await eliminarBusquedaUi(searchId);
            router.push(RUTA_EXPLORER);
          } catch {
            toast.error(ERROR_ELIMINAR);
            setBorrando(false);
          }
        }}
      />
    </div>
  );
}
