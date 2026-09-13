"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import {
  claseBadgeDivision,
  etiquetaEstadoDivisionLista,
  resumenComercialFinca,
  textoMotivoUnknownUi,
  tituloDireccionFinca,
  type FincaBusquedaUi,
} from "@/lib/catastro/search-ui";
import { LEYENDA_ESTADOS_DIVISION } from "@/lib/catastro/search-ui";
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
};

export function FincaDetallePanel({ finca, href, vinculada, onProperty, onCerrar }: Props) {
  const status = finca.horizontalDivision?.status;
  const leyenda = LEYENDA_ESTADOS_DIVISION.find((item) => item.status === status);
  const inmuebles = finca.properties ?? [];

  const copiar = async () => {
    const ok = await copiarAlPortapapeles(finca.fincaReference);
    if (ok) toast.success("Referencia copiada");
    else toast.error("No se ha podido copiar.");
  };

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
          <button type="button" onClick={onCerrar} className="text-sm font-semibold text-[#5D6B67] md:hidden">
            Cerrar
          </button>
        ) : null}
      </div>

      <p className="mt-2 text-sm text-[#5D6B67]">{resumenComercialFinca(finca)}</p>
      {textoMotivoUnknownUi(finca.horizontalDivision) ? (
        <p className="mt-1 text-xs text-[#5D6B67]">{textoMotivoUnknownUi(finca.horizontalDivision)}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {onProperty ? (
          <Button type="button" size="sm" onClick={onProperty}>
            {vinculada ? "Ver propiedad" : "Crear propiedad"}
          </Button>
        ) : href ? (
          <Button asChild size="sm">
            <a href={href}>{vinculada ? "Ver finca" : "Ver finca"}</a>
          </Button>
        ) : null}
      </div>

      <div className="mt-4">
        <MapaCatastral
          fincaReference={finca.fincaReference}
          superficie={finca.superficieSolar != null ? `${finca.superficieSolar.toLocaleString("es-ES")} m²` : undefined}
        />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3">
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

      {inmuebles.length > 1 ? (
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7A76]">
            Inmuebles · {inmuebles.length}
          </p>
          <ul className="mt-2 divide-y divide-[#F2F0EB]">
            {inmuebles.slice(0, 12).map((item) => (
              <li key={item.reference} className="flex flex-wrap gap-2 py-1.5 text-[12.5px]">
                <span className="w-[66px] font-mono text-[#5D6B67]">{item.reference.slice(-6)}</span>
                <span>{item.planta ? `Planta ${item.planta}` : "—"}</span>
                <span>{item.puerta ?? ""}</span>
                <span className="tabular-nums">{item.superficie != null ? `${item.superficie} m²` : ""}</span>
                <span className="text-[#5D6B67]">{item.uso ?? ""}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-[#DAD6CE] px-3 py-3 text-xs text-[#5D6B67]">
          {inmuebles.length === 0
            ? "Catastro no detalla más unidades en esta finca."
            : "Finca de una sola unidad."}
        </p>
      )}
    </aside>
  );
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7A76]">{label}</dt>
      <dd className="mt-0.5 text-sm text-[#131C1A]">{value}</dd>
    </div>
  );
}
