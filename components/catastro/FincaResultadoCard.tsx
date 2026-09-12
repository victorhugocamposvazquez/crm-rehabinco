"use client";

import { useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, ChevronDown, Copy, ExternalLink, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  codigosPostalesVisibles,
  etiquetaEstadoDivisionLista,
  resumenComercialFinca,
  textoMotivoUnknownUi,
  tituloDireccionFinca,
  type FincaBusquedaUi,
} from "@/lib/catastro/search-ui";
import {
  copiarAlPortapapeles,
  detalleFinca,
  direccionOficial,
} from "@/lib/catastro/selection-export";
import {
  REVISION_VACIA,
  puedeMarcarseRevision,
  textoRevisionUi,
  type RevisionFincas,
} from "@/lib/catastro/revision-comercial";
import { crearGoogleMapsUrl } from "@/lib/catastro/explorer/maps";

function Dato({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === "") return null;
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
    </div>
  );
}

function badgeDivision(status: string | undefined) {
  if (status === "NO") {
    return "border-teal-300 bg-teal-100 text-teal-900";
  }
  if (status === "YES") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  if (status === "NOT_APPLICABLE") {
    return "border-neutral-200 bg-neutral-50 text-neutral-600";
  }
  return "border-stone-200 bg-stone-100 text-stone-600";
}

type Props = {
  finca: FincaBusquedaUi;
  seleccionada?: boolean;
  enRevision?: boolean;
  revision?: RevisionFincas;
  href?: string;
  detallesIniciales?: boolean;
  mostrarMaps?: boolean;
  onToggleSeleccion?: (finca: FincaBusquedaUi) => void;
  onToggleRevision?: (finca: FincaBusquedaUi) => void;
  accionesExtra?: ReactNode;
};

export function FincaResultadoCard({
  finca,
  seleccionada = false,
  enRevision = false,
  revision = REVISION_VACIA,
  href,
  detallesIniciales = false,
  mostrarMaps = true,
  onToggleSeleccion,
  onToggleRevision,
  accionesExtra,
}: Props) {
  const [abierto, setAbierto] = useState(detallesIniciales);
  const idBase = useId();
  const idCheckbox = `${idBase}-seleccion`;
  const idDetalle = `${idBase}-detalle`;
  const status = finca.horizontalDivision?.status;
  const subtituloRevision = textoRevisionUi(enRevision, status);
  const motivoUnknown = subtituloRevision ? null : textoMotivoUnknownUi(finca.horizontalDivision);
  const revisable = Boolean(onToggleRevision) && puedeMarcarseRevision(finca);
  const cps = codigosPostalesVisibles(finca);
  const inmuebles = finca.properties ?? [];
  const portales = finca.portals.filter(Boolean);
  const titulo = tituloDireccionFinca(finca);
  const direccion = direccionOficial(finca);
  const mapsUrl = mostrarMaps ? crearGoogleMapsUrl(finca) : null;
  const seleccionable = Boolean(onToggleSeleccion);

  const copiar = async (texto: string, exito: string) => {
    const ok = await copiarAlPortapapeles(texto);
    if (ok) toast.success(exito);
    else toast.error("No se ha podido copiar. Cópialo manualmente.");
  };

  return (
    <Card
      animate={false}
      className={cn(
        "p-4 transition-colors sm:p-5",
        seleccionada && "border-accent border-l-4 bg-accent/[0.04]"
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {seleccionable ? (
            <div className="flex shrink-0 items-center pt-1">
              <input
                id={idCheckbox}
                type="checkbox"
                checked={seleccionada}
                onChange={() => onToggleSeleccion?.(finca)}
                className="h-5 w-5 cursor-pointer rounded border-border accent-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-describedby={`${idBase}-titulo`}
              />
            </div>
          ) : null}
          <div className="min-w-0">
            <h3 id={`${idBase}-titulo`} className="text-lg font-semibold tracking-tight text-foreground">
              {href ? (
                <Link href={href} className="hover:text-accent hover:underline">
                  {titulo}
                </Link>
              ) : (
                titulo
              )}
            </h3>
            <p className="mt-1 text-sm text-neutral-600">{resumenComercialFinca(finca)}</p>
            <p className="mt-1 text-xs text-neutral-500">
              Ref. {finca.fincaReference}
            </p>
            {seleccionable ? (
              <label
                htmlFor={idCheckbox}
                className={cn(
                  "mt-1.5 inline-flex cursor-pointer items-center gap-1 text-xs font-semibold",
                  seleccionada ? "text-accent" : "text-neutral-500"
                )}
              >
                {seleccionada ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
                {seleccionada ? "Seleccionada" : "Seleccionar"}
              </label>
            ) : null}
          </div>
        </div>
        <div className="flex w-fit shrink-0 flex-col items-start gap-1 sm:items-end">
          <span
            className={cn(
              "inline-flex w-fit rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide",
              badgeDivision(status)
            )}
          >
            {etiquetaEstadoDivisionLista(status)}
          </span>
          {subtituloRevision ? (
            <p className="max-w-[16rem] text-[11px] font-medium leading-snug text-stone-700">{subtituloRevision}</p>
          ) : null}
          {motivoUnknown ? (
            <p className="max-w-[16rem] text-[11px] leading-snug text-neutral-500">{motivoUnknown}</p>
          ) : null}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cps.length > 0 ? <Dato label="Código postal" value={cps.join(", ")} /> : null}
        {finca.superficieSolar != null ? (
          <Dato label="Parcela" value={`${finca.superficieSolar} m²`} />
        ) : null}
        {portales.length > 0 ? (
          <Dato
            label={portales.length === 1 ? "Portal" : "Portales"}
            value={portales.join(", ")}
          />
        ) : null}
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {href ? (
          <Button asChild size="sm">
            <Link href={href}>Ver finca</Link>
          </Button>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setAbierto((prev) => !prev)}
          aria-expanded={abierto}
          aria-controls={idDetalle}
        >
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", abierto && "rotate-180")}
            aria-hidden
          />
          {abierto ? "Ocultar detalles" : "Ver detalles"}
          {inmuebles.length > 0 ? (
            <span className="text-neutral-500">({inmuebles.length})</span>
          ) : null}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void copiar(finca.fincaReference, "Referencia copiada")}
          aria-label={`Copiar referencia ${finca.fincaReference}`}
        >
          <Copy className="h-4 w-4" aria-hidden />
          Copiar referencia
        </Button>
        {direccion ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void copiar(direccion, "Dirección copiada")}
            aria-label={`Copiar dirección ${direccion}`}
          >
            <MapPin className="h-4 w-4" aria-hidden />
            Copiar dirección
          </Button>
        ) : null}
        {mapsUrl ? (
          <Button asChild variant="ghost" size="sm">
            <a href={mapsUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" aria-hidden />
              Ver en Google Maps
            </a>
          </Button>
        ) : null}
        {revisable ? (
          <Button
            type="button"
            variant={enRevision ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onToggleRevision?.(finca)}
          >
            {enRevision ? "Quitar de revisión" : "Marcar para revisar"}
          </Button>
        ) : null}
        {accionesExtra}
      </div>

      {abierto ? (
        <DetalleFincaPanel
          id={idDetalle}
          finca={finca}
          revision={revision}
          enRevision={enRevision}
          revisable={revisable}
          onToggleRevision={onToggleRevision}
        />
      ) : null}
    </Card>
  );
}

function DetalleFincaPanel({
  id,
  finca,
  revision,
  enRevision,
  revisable,
  onToggleRevision,
}: {
  id: string;
  finca: FincaBusquedaUi;
  revision: RevisionFincas;
  enRevision: boolean;
  revisable: boolean;
  onToggleRevision?: (finca: FincaBusquedaUi) => void;
}) {
  const detalle = detalleFinca(finca, revision);
  return (
    <div id={id} className="mt-4 space-y-4">
      {revisable ? (
        <div>
          <Button
            type="button"
            variant={enRevision ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onToggleRevision?.(finca)}
          >
            {enRevision ? "Quitar de revisión" : "Marcar para revisar"}
          </Button>
        </div>
      ) : null}
      <dl className="grid grid-cols-1 gap-3 rounded-xl bg-neutral-50 px-4 py-3 sm:grid-cols-3">
        {detalle.general.map((item) => (
          <Dato key={item.label} label={item.label} value={item.value} />
        ))}
      </dl>

      {detalle.inmuebles.length > 0 ? (
        <div>
          <p className="text-sm font-medium text-foreground">
            Inmuebles
            <span className="ml-1.5 text-neutral-500">({detalle.inmuebles.length})</span>
          </p>
          <ul className="mt-2 space-y-3">
            {detalle.inmuebles.map((inmueble) => (
              <li key={inmueble.reference} className="rounded-xl border border-border px-3 py-3">
                <p className="font-mono text-xs tracking-wide text-neutral-700">
                  {inmueble.reference}
                </p>
                {inmueble.datos.length > 0 ? (
                  <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {inmueble.datos.map((item) => (
                      <Dato key={item.label} label={item.label} value={item.value} />
                    ))}
                  </dl>
                ) : (
                  <p className="mt-2 text-xs text-neutral-500">
                    Catastro no ha devuelto más datos de este inmueble.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-neutral-500">
          Catastro no ha devuelto inmuebles individuales para esta finca.
        </p>
      )}
    </div>
  );
}
