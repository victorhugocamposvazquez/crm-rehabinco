"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import {
  LEYENDA_ESTADOS_DIVISION,
  claseBadgeDivision,
  etiquetaEstadoDivisionLista,
  resumenComercialFinca,
  textoMotivoUnknownUi,
  tituloDireccionFinca,
  type FincaBusquedaUi,
} from "@/lib/catastro/search-ui";
import { copiarAlPortapapeles, direccionOficial } from "@/lib/catastro/selection-export";
import { crearUrlMapaCatastral } from "@/lib/catastro/explorer/catastro-map";
import { crearGoogleMapsUrl } from "@/lib/catastro/explorer/maps";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CarrilHorizontal } from "@/components/ui/carril-horizontal";
import { MapaCatastral } from "./MapaCatastral";
import { AsignarComercial } from "./AsignarComercial";
import { NotasFinca } from "./NotasFinca";
import type { AsignacionFinca, ComercialAsignable } from "@/lib/catastro-host/finca-assignment";

type Props = {
  finca: FincaBusquedaUi;
  href?: string;
  vinculada?: boolean;
  onProperty?: () => void;
  onCerrar?: () => void;
  comerciales?: ComercialAsignable[];
  asignacion?: AsignacionFinca | null;
  onAsignacion?: (asignacion: AsignacionFinca | null) => void;
};

export function FincaDetallePanel({
  finca,
  href,
  vinculada,
  onProperty,
  onCerrar,
  comerciales,
  asignacion,
  onAsignacion,
}: Props) {
  const status = finca.horizontalDivision?.status;
  const leyenda = LEYENDA_ESTADOS_DIVISION.find((item) => item.status === status);
  const inmuebles = finca.properties ?? [];
  const usos = useMemo(() => usosDeInmuebles(inmuebles), [inmuebles]);
  const [uso, setUso] = useState("Todos");
  const visibles = uso === "Todos" ? inmuebles : inmuebles.filter((item) => normalizarUso(item.uso) === uso);
  const cerrarRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setUso("Todos");
  }, [finca.fincaReference]);

  const direccion = direccionOficial(finca);
  const mapsUrl = crearGoogleMapsUrl(finca);
  const mapaCatastralUrl = crearUrlMapaCatastral(finca.fincaReference);

  const copiar = async (texto: string, exito: string) => {
    const ok = await copiarAlPortapapeles(texto);
    if (ok) toast.success(exito);
    else toast.error("No se ha podido copiar.");
  };

  const accionPropiedad = onProperty ? (
    <Button type="button" size="sm" onClick={onProperty} className="bg-[#111111] hover:bg-[#000000]">
      {vinculada ? "Ver propiedad" : "Crear propiedad"}
    </Button>
  ) : href ? (
    <Button asChild size="sm" className="bg-[#111111] hover:bg-[#000000]">
      <a href={href}>{vinculada ? "Ver propiedad" : "Ver finca"}</a>
    </Button>
  ) : null;

  const cuerpo = (
    <>
      <p className="text-sm text-[#5C5C5C]">{resumenComercialFinca(finca)}</p>
      {vinculada ? (
        <p className="mt-1 text-xs font-semibold text-sky-800">Esta referencia ya es una propiedad del CRM.</p>
      ) : asignacion ? (
        <p className="mt-1 text-xs font-semibold text-[#111111]">Asignada a {asignacion.nombre}.</p>
      ) : null}
      {textoMotivoUnknownUi(finca.horizontalDivision) ? (
        <p className="mt-1 text-xs text-[#5C5C5C]">{textoMotivoUnknownUi(finca.horizontalDivision)}</p>
      ) : null}

      <div className="mt-4">
        <MapaCatastral
          fincaReference={finca.fincaReference}
          superficie={finca.superficieSolar != null ? `${finca.superficieSolar.toLocaleString("es-ES")} m²` : undefined}
        />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-[#EFEFEF] bg-[#FAFAFA] p-3.5">
        {finca.superficieSolar != null ? (
          <Dato label="Superficie solar" value={`${finca.superficieSolar.toLocaleString("es-ES")} m²`} />
        ) : null}
        {finca.postalCode ? <Dato label="Código postal" value={finca.postalCode} /> : null}
        {finca.address.municipio ? <Dato label="Municipio" value={finca.address.municipio} /> : null}
        {finca.portals[0] ? <Dato label="Portal" value={finca.portals.join(", ")} /> : null}
        <div className="col-span-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#6B6B6B]">Clasificación de Catastro</dt>
          <dd className="mt-1 text-sm text-[#111111]">
            {leyenda?.filtro ?? etiquetaEstadoDivisionLista(status)}
            {leyenda ? <span className="mt-1 block text-xs leading-snug text-[#5C5C5C]">{leyenda.texto}</span> : null}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void copiar(finca.fincaReference, "Referencia copiada")}
          className={CLASE_ACCION}
        >
          Copiar referencia
        </button>
        {direccion ? (
          <button
            type="button"
            onClick={() => void copiar(direccion, "Dirección copiada")}
            className={CLASE_ACCION}
          >
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            Copiar dirección
          </button>
        ) : null}
        {mapaCatastralUrl ? (
          <a href={mapaCatastralUrl} target="_blank" rel="noreferrer" className={CLASE_ACCION}>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            Mapa catastral
          </a>
        ) : null}
        {mapsUrl ? (
          <a href={mapsUrl} target="_blank" rel="noreferrer" className={CLASE_ACCION}>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            Ver en Google Maps
          </a>
        ) : null}
      </div>

      <AsignarComercial
        fincaReference={finca.fincaReference}
        vinculada={Boolean(vinculada)}
        comerciales={comerciales}
        asignacion={asignacion}
        onCambio={onAsignacion}
      />

      <NotasFinca fincaReference={finca.fincaReference} />

      <div className="mt-5 flex flex-wrap items-baseline gap-2">
        <h3 className="text-[15px] font-semibold text-[#111111]">Inmuebles</h3>
        <span className="text-[12.5px] text-[#5C5C5C]">{inmuebles.length}</span>
      </div>
      {usos.length > 1 ? (
        <CarrilHorizontal className="mt-2" trackClassName="gap-1.5 pb-1" role="tablist" label="Filtrar inmuebles por uso">
          {["Todos", ...usos].map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={uso === item}
              onClick={() => setUso(item)}
              className={cn(
                "min-h-9 shrink-0 rounded-full border px-3 text-xs font-medium",
                uso === item
                  ? "border-[#111111] bg-[#F0F0F0] text-[#000000]"
                  : "border-[#E5E5E5] bg-white text-[#5C5C5C]"
              )}
            >
              {item}
            </button>
          ))}
        </CarrilHorizontal>
      ) : null}

      {visibles.length > 1 ? (
        <ul className="mt-2 space-y-3">
          {agruparPorPlanta(visibles).map((grupo) => (
            <li key={grupo.planta}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B6B6B]">
                {grupo.planta === "—" ? "Sin planta" : `Planta ${grupo.planta}`}
              </p>
              <ul className="mt-1 divide-y divide-[#F2F2F2]">
                {grupo.items.map((item) => (
                  <li key={item.reference} className="flex flex-wrap items-center gap-2 py-2 text-[12.5px]">
                    <span className="w-[66px] shrink-0 font-mono text-[#5C5C5C]">{item.reference.slice(-6)}</span>
                    <span>{item.puerta || "—"}</span>
                    <span className="tabular-nums">{item.superficie != null ? `${item.superficie} m²` : ""}</span>
                    <span className="text-[#5C5C5C]">{item.uso ?? ""}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-[#D4D4D4] px-3 py-3 text-[13px] text-[#5C5C5C]">
          {visibles.length === 0
            ? "Catastro no detalla más unidades en esta finca."
            : "Finca de una sola unidad."}
        </p>
      )}
    </>
  );

  return (
    <PanelLateralFinca
      titulo={tituloDireccionFinca(finca)}
      referencia={finca.fincaReference}
      status={status}
      onCerrar={onCerrar}
      cerrarRef={cerrarRef}
      accion={accionPropiedad}
    >
      {cuerpo}
    </PanelLateralFinca>
  );
}

function PanelLateralFinca({
  titulo,
  referencia,
  status,
  onCerrar,
  cerrarRef,
  accion,
  children,
}: {
  titulo: string;
  referencia: string;
  status: string | undefined;
  onCerrar?: () => void;
  cerrarRef: RefObject<HTMLButtonElement | null>;
  accion: ReactNode;
  children: React.ReactNode;
}) {
  const toqueInicio = useRef<number | null>(null);

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cerrarRef.current?.focus();
    const onKey = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") onCerrar?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [cerrarRef, onCerrar]);

  const cerrarSiDesliza = (finX: number) => {
    if (toqueInicio.current == null) return;
    if (finX - toqueInicio.current > 56) onCerrar?.();
    toqueInicio.current = null;
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[80]">
      <button
        type="button"
        className="absolute inset-0 bg-black/35"
        aria-label="Cerrar ficha"
        onClick={onCerrar}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ficha-finca-titulo"
        className="absolute inset-y-0 right-0 z-10 flex w-full max-w-none flex-col bg-[var(--surface)] pb-[env(safe-area-inset-bottom)] shadow-[-16px_0_40px_rgba(17, 17, 17,.16)] animate-[slideInFromRight_0.28s_ease-out] min-[780px]:w-[min(46rem,52vw)]"
        onTouchStart={(evento) => {
          toqueInicio.current = evento.changedTouches[0]?.clientX ?? null;
        }}
        onTouchEnd={(evento) => cerrarSiDesliza(evento.changedTouches[0]?.clientX ?? 0)}
      >
        <header
          className="px-5 pb-2 pt-[max(1.25rem,env(safe-area-inset-top))] min-[780px]:px-6 min-[780px]:pt-6"
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 id="ficha-finca-titulo" className="text-[22px] font-medium leading-tight tracking-[-0.03em] text-foreground">
                {titulo}
              </h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <p className="font-mono text-[12px] text-[var(--text-3)]">{referencia}</p>
                <span className={cn("rounded-md px-2.5 py-1 text-[11px] font-semibold", claseBadgeDivision(status))}>
                  {etiquetaEstadoDivisionLista(status)}
                </span>
              </div>
            </div>
            <button
              ref={cerrarRef}
              type="button"
              onClick={onCerrar}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-[var(--text-2)] hover:bg-[var(--surface-soft)]"
              aria-label="Cerrar ficha"
            >
              <X className="h-5 w-5" strokeWidth={2.2} aria-hidden />
            </button>
          </div>
        </header>
        <div
          className="min-h-0 flex-1 overflow-y-auto px-5 py-6 min-[780px]:px-6 min-[780px]:py-8"
          onTouchStart={(evento) => evento.stopPropagation()}
        >
          {children}
        </div>
        {accion ? (
          <div className="border-t border-[var(--border)] bg-[var(--surface)] px-5 py-4 min-[780px]:px-6">
            <div className="[&_button]:h-[50px] [&_button]:w-full [&_button]:text-[14.5px] [&_a]:flex [&_a]:h-[50px] [&_a]:w-full [&_a]:items-center [&_a]:justify-center [&_a]:text-[14.5px] min-[780px]:[&_a]:h-10 min-[780px]:[&_a]:w-auto min-[780px]:[&_button]:h-10 min-[780px]:[&_button]:w-auto">
              {accion}
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

const CLASE_ACCION =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] border border-[#D4D4D4] bg-white px-3 text-[13px] font-medium text-[#111111]";

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] text-[var(--text-3)]">{label}</dt>
      <dd className="mt-1.5 text-sm tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

function normalizarUso(uso: string | undefined): string {
  const valor = uso?.trim();
  return valor && valor.length > 0 ? valor : "Otros";
}

function usosDeInmuebles(inmuebles: NonNullable<FincaBusquedaUi["properties"]>): string[] {
  return [...new Set(inmuebles.map((item) => normalizarUso(item.uso)))].sort((a, b) => a.localeCompare(b, "es"));
}

function agruparPorPlanta(inmuebles: NonNullable<FincaBusquedaUi["properties"]>) {
  const grupos = new Map<string, NonNullable<FincaBusquedaUi["properties"]>>();
  for (const item of inmuebles) {
    const planta = item.planta?.trim() || "—";
    const lista = grupos.get(planta) ?? [];
    lista.push(item);
    grupos.set(planta, lista);
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "es", { numeric: true }))
    .map(([planta, items]) => ({ planta, items }));
}
