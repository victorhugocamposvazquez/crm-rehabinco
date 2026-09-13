"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Copy } from "lucide-react";
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
import { copiarAlPortapapeles } from "@/lib/catastro/selection-export";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MapaCatastral } from "./MapaCatastral";

type Props = {
  finca: FincaBusquedaUi;
  href?: string;
  vinculada?: boolean;
  onProperty?: () => void;
  onCerrar?: () => void;
  variante?: "panel" | "hoja";
};

export function FincaDetallePanel({
  finca,
  href,
  vinculada,
  onProperty,
  onCerrar,
  variante = "panel",
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

  const copiar = async () => {
    const ok = await copiarAlPortapapeles(finca.fincaReference);
    if (ok) toast.success("Referencia copiada");
    else toast.error("No se ha podido copiar.");
  };

  const accionPropiedad = onProperty ? (
    <Button type="button" size="sm" onClick={onProperty} className="bg-[#0B7461] hover:bg-[#08594B]">
      {vinculada ? "Ver propiedad" : "Crear propiedad"}
    </Button>
  ) : href ? (
    <Button asChild size="sm" className="bg-[#0B7461] hover:bg-[#08594B]">
      <a href={href}>{vinculada ? "Ver propiedad" : "Ver finca"}</a>
    </Button>
  ) : null;

  const cuerpo = (
    <>
      <p className="text-sm text-[#5D6B67]">{resumenComercialFinca(finca)}</p>
      {textoMotivoUnknownUi(finca.horizontalDivision) ? (
        <p className="mt-1 text-xs text-[#5D6B67]">{textoMotivoUnknownUi(finca.horizontalDivision)}</p>
      ) : null}

      <div className="mt-4">
        <MapaCatastral
          fincaReference={finca.fincaReference}
          superficie={finca.superficieSolar != null ? `${finca.superficieSolar.toLocaleString("es-ES")} m²` : undefined}
        />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-[#EFEDE7] bg-[#FDFDFC] p-3.5">
        {finca.superficieSolar != null ? (
          <Dato label="Superficie solar" value={`${finca.superficieSolar.toLocaleString("es-ES")} m²`} />
        ) : null}
        {finca.postalCode ? <Dato label="Código postal" value={finca.postalCode} /> : null}
        {finca.address.municipio ? <Dato label="Municipio" value={finca.address.municipio} /> : null}
        {finca.portals[0] ? <Dato label="Portal" value={finca.portals.join(", ")} /> : null}
        <div className="col-span-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7A76]">Clasificación de Catastro</dt>
          <dd className="mt-1 text-sm text-[#131C1A]">
            {leyenda?.filtro ?? etiquetaEstadoDivisionLista(status)}
            {leyenda ? <span className="mt-1 block text-xs leading-snug text-[#5D6B67]">{leyenda.texto}</span> : null}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => void copiar()}
          className="min-h-11 flex-1 rounded-[10px] border border-[#DAD6CE] bg-white text-[13px] font-medium text-[#131C1A]"
        >
          Copiar referencia
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-baseline gap-2">
        <h3 className="text-[15px] font-semibold text-[#131C1A]">Inmuebles</h3>
        <span className="text-[12.5px] text-[#5D6B67]">{inmuebles.length}</span>
      </div>
      {usos.length > 1 ? (
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Filtrar inmuebles por uso">
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
                  ? "border-[#0B7461] bg-[#E8F3EF] text-[#08594B]"
                  : "border-[#E6E3DD] bg-white text-[#5D6B67]"
              )}
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}

      {visibles.length > 1 ? (
        <ul className="mt-2 space-y-3">
          {agruparPorPlanta(visibles).map((grupo) => (
            <li key={grupo.planta}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7A76]">
                {grupo.planta === "—" ? "Sin planta" : `Planta ${grupo.planta}`}
              </p>
              <ul className="mt-1 divide-y divide-[#F2F0EB]">
                {grupo.items.map((item) => (
                  <li key={item.reference} className="flex flex-wrap items-center gap-2 py-2 text-[12.5px]">
                    <span className="w-[66px] shrink-0 font-mono text-[#5D6B67]">{item.reference.slice(-6)}</span>
                    <span>{item.puerta || "—"}</span>
                    <span className="tabular-nums">{item.superficie != null ? `${item.superficie} m²` : ""}</span>
                    <span className="text-[#5D6B67]">{item.uso ?? ""}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-[#DAD6CE] px-3 py-3 text-[13px] text-[#5D6B67]">
          {visibles.length === 0
            ? "Catastro no detalla más unidades en esta finca."
            : "Finca de una sola unidad."}
        </p>
      )}
    </>
  );

  if (variante === "hoja") {
    return <HojaFinca titulo={tituloDireccionFinca(finca)} referencia={finca.fincaReference} status={status} onCerrar={onCerrar} cerrarRef={cerrarRef} accion={accionPropiedad}>{cuerpo}</HojaFinca>;
  }

  return (
    <aside className="rounded-2xl border border-[#E6E3DD] bg-white p-4 shadow-[0_1px_2px_rgba(19,28,26,.04)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-[#131C1A]">{tituloDireccionFinca(finca)}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded bg-[#F4F3EF] px-1.5 py-0.5 font-mono text-[11.5px] text-[#5D6B67]">
              {finca.fincaReference}
            </span>
            <button type="button" onClick={() => void copiar()} className="text-[#5D6B67]" title="Copiar referencia">
              <Copy className="h-3.5 w-3.5" aria-hidden />
            </button>
            <span className={cn("rounded-md px-2.5 py-1 text-[11px] font-semibold", claseBadgeDivision(status))}>
              {etiquetaEstadoDivisionLista(status)}
            </span>
          </div>
        </div>
        {onCerrar ? (
          <button
            type="button"
            onClick={onCerrar}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[#E6E3DD] text-[#131C1A]"
            aria-label="Cerrar ficha"
          >
            <ChevronDown className="h-5 w-5" strokeWidth={2.2} aria-hidden />
          </button>
        ) : null}
      </div>
      <div className="mt-3">{accionPropiedad}</div>
      <div className="mt-4">{cuerpo}</div>
    </aside>
  );
}

function HojaFinca({
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

  const cerrarSiBaja = (finY: number) => {
    if (toqueInicio.current == null) return;
    if (finY - toqueInicio.current > 56) onCerrar?.();
    toqueInicio.current = null;
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center min-[780px]:items-center min-[780px]:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Cerrar ficha"
        onClick={onCerrar}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ficha-finca-titulo"
        className="relative z-10 flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_40px_rgba(19,28,26,.18)] min-[780px]:max-h-[86dvh] min-[780px]:max-w-2xl min-[780px]:rounded-2xl min-[780px]:shadow-[0_16px_48px_rgba(19,28,26,.22)]"
        onTouchStart={(evento) => {
          toqueInicio.current = evento.changedTouches[0]?.clientY ?? null;
        }}
        onTouchEnd={(evento) => cerrarSiBaja(evento.changedTouches[0]?.clientY ?? 0)}
      >
        <header className="border-b border-[#EFEDE7] px-3.5 pb-3 pt-2">
          <div className="flex justify-center pb-2 min-[780px]:hidden">
            <span className="h-1 w-12 rounded-full bg-[#DAD6CE]" aria-hidden />
          </div>
          <div className="flex items-center gap-2.5">
            <button
              ref={cerrarRef}
              type="button"
              onClick={onCerrar}
              className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-[10px] border border-[#E6E3DD] px-3 text-[13.5px] font-semibold text-[#131C1A]"
            >
              <ChevronDown className="h-5 w-5" strokeWidth={2.2} aria-hidden />
              Cerrar
            </button>
            <div className="min-w-0 flex-1">
              <h2 id="ficha-finca-titulo" className="truncate text-[15.5px] font-semibold tracking-tight text-[#131C1A]">
                {titulo}
              </h2>
              <p className="mt-0.5 font-mono text-[11.5px] text-[#5D6B67]">{referencia}</p>
            </div>
            <span className={cn("shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap", claseBadgeDivision(status))}>
              {etiquetaEstadoDivisionLista(status)}
            </span>
          </div>
        </header>
        <div
          className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3.5"
          onTouchStart={(evento) => evento.stopPropagation()}
        >
          {children}
        </div>
        {accion ? (
          <div className="border-t border-[#EFEDE7] bg-white px-3.5 py-2.5 shadow-[0_-6px_18px_rgba(19,28,26,.06)]">
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

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7A76]">{label}</dt>
      <dd className="mt-0.5 text-sm tabular-nums text-[#131C1A]">{value}</dd>
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
