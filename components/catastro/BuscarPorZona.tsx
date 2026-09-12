"use client";

import { Play, RotateCcw, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { estaSeleccionada, type SeleccionFincas } from "@/lib/catastro/selection-export";
import { textoContadorFincas, type FincaBusquedaUi } from "@/lib/catastro/search-ui";
import { VacioResultados } from "./VacioResultados";
import {
  FILTROS_REVISION_COMERCIAL,
  estaEnRevision,
  filtrarPorRevisionComercial,
  textoRevision,
  type FiltroRevisionComercial,
  type RevisionFincas,
} from "@/lib/catastro/revision-comercial";
import {
  accionesDisponibles,
  listaErrores,
  ritmoMedido,
  textoCallesARevisar,
  textoEstadoFinal,
  textoPreparacion,
  textosProgreso,
  type EstadoZonaUi,
} from "@/lib/catastro/zone-ui";
import { rutaFincaPersistida } from "@/lib/catastro/explorer/history-ui";
import { FincaResultadoCard } from "./FincaResultadoCard";

type Props = {
  estado: EstadoZonaUi;
  ahora: number;
  cancelando: boolean;
  seleccion: SeleccionFincas;
  revision: RevisionFincas;
  filtroRevision: FiltroRevisionComercial;
  onFiltroRevision: (filtro: FiltroRevisionComercial) => void;
  onComenzar: () => void;
  onCancelar: () => void;
  onReanudar: () => void;
  onReintentarErrores: () => void;
  onNuevaBusqueda: () => void;
  onToggleSeleccion: (finca: FincaBusquedaUi) => void;
  onToggleRevision: (finca: FincaBusquedaUi) => void;
  onExportarRevision: () => void;
  onVerTodas: () => void;
};

/**
 * Panel de la búsqueda por código postal: preparación → confirmación → progreso → resultados.
 * Reutiliza `FincaResultadoCard`; no hay una tarjeta paralela.
 */
export function BuscarPorZona({
  estado,
  ahora,
  cancelando,
  seleccion,
  revision,
  filtroRevision,
  onFiltroRevision,
  onComenzar,
  onCancelar,
  onReanudar,
  onReintentarErrores,
  onNuevaBusqueda,
  onToggleSeleccion,
  onToggleRevision,
  onExportarRevision,
  onVerTodas,
}: Props) {
  const { snapshot } = estado;
  const acciones = accionesDisponibles(estado);

  if (estado.fase === "formulario" && !estado.error) return null;

  if (estado.fase === "preparando") {
    return (
      <div className="rounded-2xl border border-border bg-white px-5 py-8 text-center" role="status">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-accent" />
        <p className="mt-4 text-sm font-medium text-neutral-600">
          Preparando la búsqueda: consultando el callejero oficial del municipio…
        </p>
      </div>
    );
  }

  if (estado.fase === "formulario" || (estado.fase === "error" && !snapshot)) {
    return (
      <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
        {estado.error}
      </p>
    );
  }

  if (!snapshot) return null;

  if (estado.fase === "preparada") {
    return (
      <div className="space-y-4 rounded-2xl border border-border bg-white p-5 sm:p-6" role="status">
        <div>
          <p className="text-base font-semibold text-foreground">{textoPreparacion(snapshot.progress.streetsFound)}</p>
          <p className="mt-1 text-sm text-neutral-600">{textoCallesARevisar(snapshot.progress.streetsFound)}</p>
          <p className="mt-3 text-sm text-neutral-500">
            Esto puede tardar. Verás las fincas según se vayan revisando las calles. Puedes parar en cualquier momento.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onComenzar} disabled={!acciones.comenzar}>
            <Play className="h-4 w-4" aria-hidden />
            Empezar ahora
          </Button>
          <Button type="button" variant="secondary" onClick={onNuevaBusqueda}>
            Nueva búsqueda
          </Button>
        </div>
      </div>
    );
  }

  const textos = textosProgreso(snapshot);
  const ritmo = estado.fase === "ejecutando" ? ritmoMedido(snapshot, estado, ahora) : null;
  const estadoFinal = textoEstadoFinal(estado);
  const errores = listaErrores(snapshot.errors);
  const enMarcha = estado.fase === "ejecutando";
  const completa = snapshot.status === "done" && snapshot.coverage.completeCandidates;
  const visibles = filtrarPorRevisionComercial(snapshot.results, filtroRevision, revision);

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-2xl border border-border bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-base font-semibold text-foreground">
              {enMarcha ? (cancelando ? "Cancelando búsqueda…" : "Buscando por código postal…") : "Búsqueda por código postal"}
            </p>
            <p className="text-sm text-neutral-600">
              {snapshot.criteria.municipio} · CP {snapshot.criteria.postalCode}
            </p>
          </div>
          {estadoFinal ? (
            <p
              className={
                completa
                  ? "text-sm font-medium text-teal-800"
                  : "rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
              }
              role="status"
            >
              {estadoFinal}
            </p>
          ) : null}
        </div>

        <div
          role="progressbar"
          aria-label="Calles revisadas"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={textos.porcentaje}
          className="h-2 w-full overflow-hidden rounded-full bg-neutral-100"
        >
          <div
            className={enMarcha ? "h-full bg-accent transition-[width] duration-500" : "h-full bg-neutral-400 transition-[width] duration-500"}
            style={{ width: `${textos.porcentaje}%` }}
          />
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4" aria-live="polite">
          <Contador texto={textos.calles} />
          <Contador texto={textos.fincas} />
          <Contador texto={textos.candidatas} destacado />
          {textos.errores ? <Contador texto={textos.errores} alerta /> : null}
        </dl>

        {ritmo ? <p className="text-xs text-neutral-500">{ritmo}</p> : null}
        {estado.error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {estado.error}
          </p>
        ) : null}

        {errores.lineas.length > 0 ? (
          <details className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <summary className="cursor-pointer font-medium">
              {snapshot.errors.length === 1 ? "1 calle con error" : `${snapshot.errors.length} calles con errores`} (la búsqueda continúa)
            </summary>
            <ul className="mt-2 space-y-1">
              {errores.lineas.map((linea) => (
                <li key={linea}>{linea}</li>
              ))}
              {errores.resto > 0 ? <li>… y {errores.resto} más.</li> : null}
            </ul>
          </details>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {acciones.cancelar ? (
            <Button type="button" variant="secondary" onClick={onCancelar} disabled={cancelando}>
              <Square className="h-4 w-4" aria-hidden />
              {cancelando ? "Cancelando…" : "Cancelar búsqueda"}
            </Button>
          ) : null}
          {acciones.reanudar ? (
            <Button type="button" onClick={onReanudar}>
              <Play className="h-4 w-4" aria-hidden />
              Reanudar
            </Button>
          ) : null}
          {acciones.reintentarErrores ? (
            <Button type="button" variant="secondary" onClick={onReintentarErrores}>
              <RotateCcw className="h-4 w-4" aria-hidden />
              Reintentar calles con error
            </Button>
          ) : null}
          {acciones.nuevaBusqueda ? (
            <Button type="button" variant="secondary" onClick={onNuevaBusqueda}>
              Nueva búsqueda
            </Button>
          ) : null}
        </div>
      </div>

      <section aria-live="polite" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Resultados</h2>
            <p className="text-sm text-neutral-600">
              {textoContadorFincas(visibles.length)}
              {revision.fincas.length > 0 ? ` · ${textoRevision(revision.fincas.length)}` : null}
              {snapshot.status !== "done" ? " · resultados provisionales; se actualizan calle a calle." : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="flex h-11 rounded-lg border border-border bg-white px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={filtroRevision}
              onChange={(event) => onFiltroRevision(event.target.value as FiltroRevisionComercial)}
              aria-label="Filtrar por revisión"
            >
              {FILTROS_REVISION_COMERCIAL.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            {revision.fincas.length > 0 ? (
              <Button type="button" variant="secondary" size="sm" onClick={onExportarRevision}>
                Exportar para revisar
              </Button>
            ) : null}
          </div>
        </div>
        {visibles.length === 0 ? (
          snapshot.status === "done" ? (
            <VacioResultados filtro={snapshot.criteria.horizontalDivision} onVerTodas={onVerTodas} />
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-white px-5 py-10 text-center">
              <p className="text-neutral-600">
                Todavía no hay resultados. Irán apareciendo calle a calle.
              </p>
            </div>
          )
        ) : (
          <ul className="space-y-3" aria-label="Fincas encontradas">
            {visibles.map((finca) => (
              <li key={finca.fincaReference}>
                <FincaResultadoCard
                  finca={finca}
                  href={rutaFincaPersistida(finca.fincaReference)}
                  seleccionada={estaSeleccionada(seleccion, finca.fincaReference)}
                  enRevision={estaEnRevision(revision, finca.fincaReference)}
                  revision={revision}
                  onToggleSeleccion={onToggleSeleccion}
                  onToggleRevision={onToggleRevision}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Contador({ texto, destacado, alerta }: { texto: string; destacado?: boolean; alerta?: boolean }) {
  const [etiqueta, valor] = texto.split(/:\s(?=[^:]*$)/);
  return (
    <div
      className={
        alerta
          ? "rounded-xl border border-amber-200 bg-amber-50 px-3 py-2"
          : destacado
            ? "rounded-xl border border-accent/30 bg-accent/5 px-3 py-2"
            : "rounded-xl border border-border bg-neutral-50 px-3 py-2"
      }
    >
      <dt className="text-xs text-neutral-500">{etiqueta}</dt>
      <dd className="text-lg font-semibold text-foreground">{valor ?? ""}</dd>
    </div>
  );
}
