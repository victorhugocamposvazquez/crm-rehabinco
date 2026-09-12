"use client";

import { useState, type ReactNode } from "react";
import { Download, X } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  SELECCION_VACIA,
  alternarSeleccion,
  descargarArchivoLocal,
  prepararExportacionCsv,
  prepararExportacionRevisionCsv,
  seleccionParaBusqueda,
  textoSeleccion,
  type CoberturaExportacion,
  type CriteriosNombreArchivo,
  type ExportacionPreparada,
  type SeleccionFincas,
} from "@/lib/catastro/selection-export";
import {
  REVISION_VACIA,
  alternarRevision,
  revisionParaBusqueda,
  textoBarraSeleccionYRevision,
  type RevisionFincas,
} from "@/lib/catastro/revision-comercial";
import type { FincaBusquedaUi } from "@/lib/catastro/search-ui";

type ExportacionLista = Extract<ExportacionPreparada, { ok: true }>;

/**
 * Selección de fincas y exportación CSV (Fase 14), compartidas por la búsqueda por calle
 * y por la búsqueda por zona. La clave de búsqueda decide cuándo se vacía la selección.
 */
export function useSeleccionFincas() {
  const [seleccion, setSeleccion] = useState<SeleccionFincas>(SELECCION_VACIA);
  const [revision, setRevision] = useState<RevisionFincas>(REVISION_VACIA);
  const [pendiente, setPendiente] = useState<ExportacionLista | null>(null);

  const alternar = (finca: FincaBusquedaUi, claveBusqueda: string) => {
    setSeleccion((prev) => alternarSeleccion(prev, finca, claveBusqueda));
  };

  const alternarMarcaRevision = (finca: FincaBusquedaUi, claveBusqueda: string) => {
    setRevision((prev) => alternarRevision(prev, finca, claveBusqueda));
  };

  const hidratarRevision = (claveBusqueda: string, fincas: FincaBusquedaUi[]) => {
    setRevision({ claveBusqueda, fincas });
  };

  const limpiar = () => {
    setSeleccion(SELECCION_VACIA);
    setRevision(REVISION_VACIA);
    setPendiente(null);
  };

  /** Repetir la misma búsqueda conserva selección y revisión; otra distinta las vacía. */
  const conservarPara = (claveBusqueda: string) => {
    setSeleccion((prev) => seleccionParaBusqueda(prev, claveBusqueda));
    setRevision((prev) => revisionParaBusqueda(prev, claveBusqueda));
    setPendiente(null);
  };

  const descargar = (preparada: ExportacionLista) => {
    const ok = descargarArchivoLocal(preparada.nombreArchivo, preparada.contenido, preparada.mimeType);
    if (ok) {
      toast.success(`CSV exportado: ${textoSeleccion(preparada.totalFincas)}.`);
    } else {
      toast.error("No se ha podido generar la descarga en este navegador.");
    }
    setPendiente(null);
  };

  const exportar = (criterios: CriteriosNombreArchivo | null, cobertura: CoberturaExportacion) => {
    if (!criterios) {
      toast.error("No hay una búsqueda activa para exportar.");
      return;
    }
    const preparada = prepararExportacionCsv({ seleccion, revision, criterios, cobertura });
    if (!preparada.ok) {
      toast.error(preparada.motivo);
      return;
    }
    if (preparada.advertencia) {
      setPendiente(preparada);
      return;
    }
    descargar(preparada);
  };

  const exportarRevision = (criterios: CriteriosNombreArchivo | null, cobertura: CoberturaExportacion) => {
    if (!criterios) {
      toast.error("No hay una búsqueda activa para exportar.");
      return;
    }
    const preparada = prepararExportacionRevisionCsv({ revision, criterios, cobertura });
    if (!preparada.ok) {
      toast.error(preparada.motivo);
      return;
    }
    if (preparada.advertencia) {
      setPendiente(preparada);
      return;
    }
    descargar(preparada);
  };

  const barra = (onExportar: () => void, onExportarRevision?: () => void): ReactNode =>
    seleccion.fincas.length > 0 || revision.fincas.length > 0 ? (
      <BarraSeleccion
        total={seleccion.fincas.length}
        enRevision={revision.fincas.length}
        onExportar={onExportar}
        onExportarRevision={revision.fincas.length > 0 ? onExportarRevision : undefined}
        onLimpiar={limpiar}
      />
    ) : null;

  const dialogo: ReactNode = (
    <AlertDialog
      open={pendiente !== null}
      onOpenChange={(abierto) => {
        if (!abierto) setPendiente(null);
      }}
      title="La exportación puede estar incompleta"
      description={
        pendiente ? (
          <div className="space-y-2">
            <p className="text-amber-900">{pendiente.advertencia}</p>
            <p>
              Se exportarán {textoSeleccion(pendiente.totalFincas)} en{" "}
              <span className="font-mono text-xs">{pendiente.nombreArchivo}</span>.
            </p>
          </div>
        ) : null
      }
      confirmLabel="Exportar CSV"
      cancelLabel="Volver"
      onConfirm={() => {
        if (pendiente) descargar(pendiente);
      }}
    />
  );

  return {
    seleccion,
    revision,
    alternar,
    alternarRevision: alternarMarcaRevision,
    hidratarRevision,
    limpiar,
    conservarPara,
    exportar,
    exportarRevision,
    barra,
    dialogo,
  };
}

function BarraSeleccion({
  total,
  enRevision,
  onExportar,
  onExportarRevision,
  onLimpiar,
}: {
  total: number;
  enRevision: number;
  onExportar: () => void;
  onExportarRevision?: () => void;
  onLimpiar: () => void;
}) {
  const haySeleccion = total > 0;
  return (
    <div
      role="region"
      aria-label="Fincas seleccionadas"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 px-3 md:bottom-4 md:px-6"
    >
      <div className="pointer-events-auto mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-border bg-white/95 px-4 py-3 shadow-[0_10px_30px_rgba(28,25,23,0.16)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-foreground" aria-live="polite">
          {textoBarraSeleccionYRevision(total, enRevision)}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {haySeleccion ? (
            <Button type="button" size="sm" onClick={onExportar}>
              <Download className="h-4 w-4" aria-hidden />
              Exportar CSV
            </Button>
          ) : null}
          {onExportarRevision ? (
            <Button type="button" size="sm" variant={haySeleccion ? "secondary" : "default"} onClick={onExportarRevision}>
              <Download className="h-4 w-4" aria-hidden />
              Exportar para revisar
            </Button>
          ) : null}
          <Button type="button" variant="secondary" size="sm" onClick={onLimpiar}>
            <X className="h-4 w-4" aria-hidden />
            {haySeleccion ? "Limpiar selección" : "Limpiar revisión"}
          </Button>
        </div>
      </div>
    </div>
  );
}
