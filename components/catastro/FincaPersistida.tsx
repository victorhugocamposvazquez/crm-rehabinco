"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  ERROR_FINCA_404,
  RUTA_EXPLORER,
  TEXTO_CARGANDO_FINCA,
  TEXTO_REINTENTAR,
  fetchFincaPersistida,
  persistirRevisionUi,
  type FincaPersistidaUi,
} from "@/lib/catastro/explorer/history-ui";
import { tituloDireccionFinca } from "@/lib/catastro/search-ui";
import {
  REVISION_VACIA,
  estaEnRevision,
  marcarRevision,
  quitarRevision,
  type RevisionFincas,
} from "@/lib/catastro/revision-comercial";
import { AccionNuevaBusqueda } from "./AccionNuevaBusqueda";
import { CatastroPropertyVinculo } from "./CatastroPropertyVinculo";
import { CatastroSubnav } from "./CatastroSubnav";
import { FincaResultadoCard } from "./FincaResultadoCard";
import type { CatastroPropertyLink } from "@/lib/catastro/explorer";

export function FincaPersistida({ fincaReference }: { fincaReference: string }) {
  const [data, setData] = useState<FincaPersistidaUi | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState<RevisionFincas>(REVISION_VACIA);
  const [intento, setIntento] = useState(0);
  const [links, setLinks] = useState<CatastroPropertyLink[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    setData(null);
    setLinks([]);
    fetchFincaPersistida(fincaReference, controller.signal)
      .then((recuperada) => {
        setData(recuperada);
        const clave = `finca:${recuperada.finca.fincaReference}`;
        setRevision(
          recuperada.review?.status === "REVIEW"
            ? { claveBusqueda: clave, fincas: [recuperada.finca] }
            : { claveBusqueda: clave, fincas: [] }
        );
        setLinks(recuperada.links ?? []);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : ERROR_FINCA_404);
      });
    return () => controller.abort();
  }, [fincaReference, intento]);

  if (error) {
    return (
      <div>
        <CatastroSubnav />
        <PageHeader
          breadcrumb={[
            { label: "Catastro Explorer", href: RUTA_EXPLORER },
            { label: "Finca" },
          ]}
          title="Finca"
          actions={<AccionNuevaBusqueda />}
        />
        <p className="mt-8 text-sm text-neutral-600">{error}</p>
        {error !== ERROR_FINCA_404 ? (
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
          {TEXTO_CARGANDO_FINCA}
        </p>
      </div>
    );
  }

  const titulo = tituloDireccionFinca(data.finca);
  const clave = revision.claveBusqueda ?? `finca:${data.finca.fincaReference}`;
  const enRevision = estaEnRevision(revision, data.finca.fincaReference);

  return (
    <div>
      <CatastroSubnav />
      <PageHeader
        breadcrumb={[
          { label: "Catastro Explorer", href: RUTA_EXPLORER },
          { label: titulo },
        ]}
        title={titulo}
        description={data.finca.fincaReference}
        actions={<AccionNuevaBusqueda />}
      />
      <div className="mt-4">
        <CatastroPropertyVinculo
          fincaReference={data.finca.fincaReference}
          links={links}
          onLinksChange={setLinks}
        />
      </div>
      <div className="mt-6">
        <FincaResultadoCard
          finca={data.finca}
          detallesIniciales
          mostrarMaps
          enRevision={enRevision}
          revision={revision}
          onToggleRevision={(finca) => {
            const siguiente = enRevision ? "NONE" : "REVIEW";
            setRevision((prev) =>
              siguiente === "REVIEW" ? marcarRevision(prev, finca, clave) : quitarRevision(prev, finca.fincaReference, clave)
            );
            void persistirRevisionUi(finca.fincaReference, siguiente).catch(() => undefined);
          }}
        />
      </div>
    </div>
  );
}
