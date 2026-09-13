"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  TEXTO_ATAJOS_LISTA,
  filtrarListaFincas,
  recuentoEstadosDivision,
  type FincaBusquedaUi,
} from "@/lib/catastro/search-ui";
import { accionTecladoLista } from "@/lib/catastro/vista-movil";
import { cn } from "@/lib/utils";
import { FincaDetallePanel } from "./FincaDetallePanel";
import { FincaResultadoRow } from "./FincaResultadoRow";
import { LeyendaEstadosDivision } from "./LeyendaEstadosDivision";
import { useVistaMovilCatastro } from "./useVistaMovilCatastro";

const FILTROS_LISTA = [
  { value: "ALL", label: "Todas" },
  { value: "NO", label: "Candidata" },
  { value: "YES", label: "Con pisos" },
  { value: "NOT_APPLICABLE", label: "No aplica" },
  { value: "UNKNOWN", label: "Sin clasificar" },
] as const;

type Props = {
  fincas: FincaBusquedaUi[];
  hrefDe?: (finca: FincaBusquedaUi) => string | undefined;
  seleccionada?: (ref: string) => boolean;
  vinculada?: (ref: string) => boolean;
  onToggleSeleccion?: (finca: FincaBusquedaUi) => void;
  onProperty?: (finca: FincaBusquedaUi) => void;
  pie?: ReactNode;
};

export function ListaFincasCatastro({
  fincas,
  hrefDe,
  seleccionada,
  vinculada,
  onToggleSeleccion,
  onProperty,
  pie,
}: Props) {
  const router = useRouter();
  const movil = useVistaMovilCatastro();
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState("ALL");
  const [sel, setSel] = useState<string | null>(fincas[0]?.fincaReference ?? null);
  const [hoja, setHoja] = useState(false);
  const recuento = recuentoEstadosDivision(fincas);
  const visibles = useMemo(() => filtrarListaFincas(fincas, { q, status: filtro }), [fincas, q, filtro]);

  useEffect(() => {
    if (sel && visibles.some((finca) => finca.fincaReference === sel)) return;
    setSel(movil ? null : (visibles[0]?.fincaReference ?? null));
    if (movil) setHoja(false);
  }, [visibles, sel, movil]);

  useEffect(() => {
    if (!movil) setHoja(false);
  }, [movil]);

  const cerrarFicha = useCallback(() => {
    setHoja(false);
    if (!movil) setSel(null);
  }, [movil]);

  useEffect(() => {
    const onKey = (evento: KeyboardEvent) => {
      const destino = evento.target;
      if (destino instanceof HTMLInputElement || destino instanceof HTMLSelectElement || destino instanceof HTMLTextAreaElement) {
        return;
      }
      const accion = accionTecladoLista(evento.key);
      if (!accion || visibles.length === 0) return;
      if (accion === "siguiente" || accion === "anterior") evento.preventDefault();
      if (accion === "cerrar") {
        cerrarFicha();
        return;
      }
      const indice = visibles.findIndex((finca) => finca.fincaReference === sel);
      if (accion === "siguiente") {
        const siguiente = visibles[Math.min(visibles.length - 1, Math.max(0, indice) + 1)];
        if (siguiente) setSel(siguiente.fincaReference);
      }
      if (accion === "anterior") {
        const anterior = visibles[Math.max(0, (indice < 0 ? 0 : indice) - 1)];
        if (anterior) setSel(anterior.fincaReference);
      }
      if (accion === "abrir") {
        const actual = visibles[Math.max(0, indice)];
        if (actual) {
          setSel(actual.fincaReference);
          setHoja(true);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visibles, sel, cerrarFicha]);

  const abrir = (finca: FincaBusquedaUi) => {
    if (hoja && sel === finca.fincaReference) {
      setHoja(false);
      return;
    }
    setSel(finca.fincaReference);
    setHoja(true);
  };

  const irPropiedad = (finca: FincaBusquedaUi) => {
    if (onProperty) onProperty(finca);
    else if (hrefDe?.(finca)) router.push(hrefDe(finca) ?? "");
  };

  const ficha = visibles.find((finca) => finca.fincaReference === sel) ?? null;

  return (
    <div className="space-y-4">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5D6B67]" aria-hidden />
        <input
          value={q}
          onChange={(evento) => setQ(evento.target.value)}
          placeholder="Filtrar por calle o referencia"
          className="h-11 w-full rounded-[10px] border border-[#DAD6CE] bg-white py-2 pl-10 pr-3 text-[14px] text-[#131C1A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7461] min-[780px]:text-[13.5px]"
        />
      </label>

      <LeyendaEstadosDivision compacta />

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 min-[780px]:flex-wrap min-[780px]:overflow-visible" role="tablist" aria-label="Filtrar por estado">
        {FILTROS_LISTA.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={filtro === item.value}
            onClick={() => setFiltro(item.value)}
            className={cn(
              "shrink-0 rounded-full border px-3 text-[12.5px] font-semibold min-h-[38px]",
              filtro === item.value
                ? "border-[#0B7461] bg-[#E8F3EF] text-[#08594B]"
                : "border-[#E6E3DD] bg-white text-[#5D6B67]"
            )}
          >
            {item.label}
            <span className="ml-1 tabular-nums text-[#6B7A76]">{recuento[item.value] ?? 0}</span>
          </button>
        ))}
      </div>

      <p className="text-xs text-[#5D6B67]">
        {LEYENDA_FILTRO_HINT} · {TEXTO_ATAJOS_LISTA}
      </p>

      <div className="flex flex-col gap-4 min-[780px]:flex-row min-[780px]:items-start">
        <div
          className={cn(
            "min-w-0 flex-[1_1_620px]",
            "max-[779px]:flex max-[779px]:flex-col max-[779px]:gap-2.5",
            "min-[780px]:overflow-hidden min-[780px]:rounded-2xl min-[780px]:border min-[780px]:border-[#E6E3DD] min-[780px]:bg-white"
          )}
        >
          {visibles.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-[#5D6B67]">No hay fincas con ese filtro.</p>
          ) : (
            <ul aria-label="Fincas encontradas" className="max-[779px]:space-y-2.5">
              {visibles.map((finca) => (
                <li key={finca.fincaReference}>
                  <FincaResultadoRow
                    finca={finca}
                    selected={!movil && sel === finca.fincaReference}
                    checked={Boolean(seleccionada?.(finca.fincaReference))}
                    vinculada={Boolean(vinculada?.(finca.fincaReference))}
                    onSelect={() => abrir(finca)}
                    onToggle={onToggleSeleccion ? () => onToggleSeleccion(finca) : undefined}
                    onProperty={onProperty || hrefDe?.(finca) ? () => irPropiedad(finca) : undefined}
                  />
                </li>
              ))}
            </ul>
          )}
          {pie}
        </div>
        {ficha && !movil ? (
          <div className="hidden min-w-[320px] flex-[1_1_380px] min-[780px]:sticky min-[780px]:top-28 min-[780px]:block">
            <FincaDetallePanel
              finca={ficha}
              href={hrefDe?.(ficha)}
              vinculada={Boolean(vinculada?.(ficha.fincaReference))}
              onProperty={onProperty || hrefDe?.(ficha) ? () => irPropiedad(ficha) : undefined}
              onCerrar={cerrarFicha}
            />
          </div>
        ) : null}
      </div>

      {ficha && movil && hoja ? (
        <FincaDetallePanel
          variante="hoja"
          finca={ficha}
          href={hrefDe?.(ficha)}
          vinculada={Boolean(vinculada?.(ficha.fincaReference))}
          onProperty={onProperty || hrefDe?.(ficha) ? () => irPropiedad(ficha) : undefined}
          onCerrar={cerrarFicha}
        />
      ) : null}
    </div>
  );
}

const LEYENDA_FILTRO_HINT = "La clasificación la da Catastro, no se marca a mano";
