"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
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
  persistirRevisionUi,
  prepararExportacionHistorica,
  revisionDesdePersistida,
  rutaFincaPersistida,
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
import { CatastroPropertyVinculo } from "./CatastroPropertyVinculo";
import { EXPLORER_RESULTS_PAGE_SIZE } from "@/lib/catastro/explorer";
import { estaEnRevision } from "@/lib/catastro/revision-comercial";
import { descargarArchivoLocal, estaSeleccionada } from "@/lib/catastro/selection-export";
import { CatastroSubnav } from "./CatastroSubnav";
import { AccionNuevaBusqueda } from "./AccionNuevaBusqueda";
import { ConfirmacionEliminarBusqueda } from "./ConfirmacionEliminarBusqueda";
import { FincaResultadoCard } from "./FincaResultadoCard";
import { useSeleccionFincas } from "./useSeleccionFincas";

export function BusquedaHistorica({ searchId }: { searchId: string }) {
  const router = useRouter();
  const [data, setData] = useState<BusquedaRecuperadaUi | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [filtro, setFiltro] = useState<FiltroHistorico>("ALL");
  const [filtroVinculo, setFiltroVinculo] = useState<FiltroVinculoProperty>("ALL");
  const [links, setLinks] = useState<CatastroPropertyLink[]>([]);
  const [intento, setIntento] = useState(0);
  const [confirmar, setConfirmar] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const seleccionFincas = useSeleccionFincas();
  const { seleccion, revision } = seleccionFincas;
  const clave = claveHistorica(searchId);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    setData(null);
    setLinks([]);
    fetchBusquedaPersistida(searchId, { limit: EXPLORER_RESULTS_PAGE_SIZE, offset }, controller.signal)
      .then((recuperada) => {
        setData(recuperada);
        setLinks(recuperada.links ?? []);
        seleccionFincas.conservarPara(clave);
        seleccionFincas.hidratarRevision(
          clave,
          revisionDesdePersistida(
            clave,
            recuperada.results.fincas,
            recuperada.reviews,
            recuperada.search.ownerId
          ).fincas
        );
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : ERROR_BUSQUEDA_404);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchId, offset, intento]);

  const visibles = useMemo(() => {
    if (!data) return [];
    return filtrarPorVinculoPropiedad(
      filtrarFincasHistoricas(data.results.fincas, filtro, revision),
      links,
      filtroVinculo
    );
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
        <CatastroSubnav />
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
        <CatastroSubnav />
        <p className="mt-8 text-sm text-neutral-500" aria-live="polite">
          {TEXTO_CARGANDO_BUSQUEDA}
        </p>
      </div>
    );
  }

  const cobertura = textosCoberturaHistorica(data.summary.coverage ?? data.search.coverage);
  const criterios = criteriosVisibles(data.search.criteria);
  const hayAnterior = data.results.offset > 0;
  const haySiguiente = data.results.offset + data.results.fincas.length < data.results.total;

  return (
    <div className={cn((seleccion.fincas.length > 0 || revision.fincas.length > 0) && "pb-32 md:pb-24")}>
      <CatastroSubnav />
      <PageHeader
        breadcrumb={[
          { label: "Catastro", href: RUTA_EXPLORER },
          { label: data.summary.titulo },
        ]}
        title={data.summary.titulo}
        description={`${formatoNumeroEs(data.summary.fincas)} ${data.summary.fincas === 1 ? "finca" : "fincas"} · ${formatoNumeroEs(data.summary.candidatas)} ${data.summary.candidatas === 1 ? "candidata" : "candidatas"} · ${ESTADO_BUSQUEDA_UI[data.summary.status]}`}
        actions={
          <div className="flex flex-wrap gap-2">
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
            {FILTROS_HISTORICOS.map((item) => (
              <Button
                key={item.value}
                type="button"
                size="sm"
                variant={filtro === item.value ? "default" : "secondary"}
                onClick={() => setFiltro(item.value)}
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

      <p className="mt-4 text-sm text-neutral-600">
        {visibles.length === 1 ? "1 finca en esta página" : `${visibles.length} fincas en esta página`}
        {data.results.total > 0 ? ` · ${formatoNumeroEs(data.results.total)} guardadas` : null}
      </p>

      <div className="mt-4 space-y-3">
        {visibles.map((finca) => (
          <FincaResultadoCard
            key={finca.fincaReference}
            finca={finca}
            href={rutaFincaPersistida(finca.fincaReference)}
            seleccionada={estaSeleccionada(seleccion, finca.fincaReference)}
            enRevision={estaEnRevision(revision, finca.fincaReference)}
            revision={revision}
            onToggleSeleccion={() => seleccionFincas.alternar(finca, clave)}
            onToggleRevision={() => {
              const siguiente = estaEnRevision(revision, finca.fincaReference) ? "NONE" : "REVIEW";
              seleccionFincas.alternarRevision(finca, clave);
              void persistirRevisionUi(finca.fincaReference, siguiente).catch(() => undefined);
            }}
            accionesExtra={
              <CatastroPropertyVinculo
                compact
                fincaReference={finca.fincaReference}
                links={links.filter((item) => item.fincaReference === finca.fincaReference)}
                onLinksChange={(siguientes) => {
                  setLinks((prev) => [
                    ...prev.filter((item) => item.fincaReference !== finca.fincaReference),
                    ...siguientes,
                  ]);
                }}
              />
            }
          />
        ))}
      </div>

      {data.results.total > data.results.limit ? (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!hayAnterior}
            onClick={() => setOffset(Math.max(0, data.results.offset - data.results.limit))}
          >
            Anterior
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!haySiguiente}
            onClick={() => setOffset(data.results.offset + data.results.limit)}
          >
            Siguiente
          </Button>
        </div>
      ) : null}

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
