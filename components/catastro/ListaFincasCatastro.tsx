"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  TEXTO_ATAJOS_LISTA,
  filtrarListaFincas,
  recuentoEstadosDivision,
  type FincaBusquedaUi,
} from "@/lib/catastro/search-ui";
import { cn } from "@/lib/utils";
import { FincaDetallePanel } from "./FincaDetallePanel";
import { FincaResultadoRow } from "./FincaResultadoRow";
import { LeyendaEstadosDivision } from "./LeyendaEstadosDivision";

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
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState("ALL");
  const [sel, setSel] = useState<string | null>(fincas[0]?.fincaReference ?? null);
  const recuento = recuentoEstadosDivision(fincas);
  const visibles = useMemo(() => filtrarListaFincas(fincas, { q, status: filtro }), [fincas, q, filtro]);

  useEffect(() => {
    if (sel && visibles.some((finca) => finca.fincaReference === sel)) return;
    setSel(visibles[0]?.fincaReference ?? null);
  }, [visibles, sel]);

  useEffect(() => {
    const onKey = (evento: KeyboardEvent) => {
      const destino = evento.target;
      if (destino instanceof HTMLInputElement || destino instanceof HTMLSelectElement || destino instanceof HTMLTextAreaElement) {
        return;
      }
      if (evento.key !== "j" && evento.key !== "k" && evento.key !== "Enter") return;
      if (visibles.length === 0) return;
      const indice = visibles.findIndex((finca) => finca.fincaReference === sel);
      if (evento.key === "j") {
        const siguiente = visibles[Math.min(visibles.length - 1, Math.max(0, indice) + 1)];
        if (siguiente) setSel(siguiente.fincaReference);
      }
      if (evento.key === "k") {
        const anterior = visibles[Math.max(0, (indice < 0 ? 0 : indice) - 1)];
        if (anterior) setSel(anterior.fincaReference);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visibles, sel]);

  const ficha = visibles.find((finca) => finca.fincaReference === sel) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5D6B67]" aria-hidden />
          <input
            value={q}
            onChange={(evento) => setQ(evento.target.value)}
            placeholder="Filtrar por calle o referencia"
            className="h-11 w-full rounded-[10px] border border-[#DAD6CE] bg-white py-2 pl-10 pr-3 text-[13.5px] text-[#131C1A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7461]"
          />
        </label>
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Filtrar por estado">
          {FILTROS_LISTA.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={filtro === item.value}
              onClick={() => setFiltro(item.value)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[12.5px] font-semibold",
                filtro === item.value
                  ? "border-[#0B7461] bg-[#E8F3EF] text-[#08594B]"
                  : "border-[#E6E3DD] bg-white text-[#5D6B67]"
              )}
            >
              {item.label}
              <span className="ml-1 tabular-nums text-[#6B7A76]">{recuento[item.value] ?? 0}</span>
            </button>
          ))}
          <LeyendaEstadosDivision compacta />
        </div>
      </div>
      <p className="text-xs text-[#5D6B67]">
        {LEYENDA_FILTRO_HINT} · {TEXTO_ATAJOS_LISTA}
      </p>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-[1_1_620px] overflow-hidden rounded-2xl border border-[#E6E3DD] bg-white">
          {visibles.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-[#5D6B67]">No hay fincas con ese filtro.</p>
          ) : (
            <ul aria-label="Fincas encontradas">
              {visibles.map((finca) => (
                <li key={finca.fincaReference}>
                  <FincaResultadoRow
                    finca={finca}
                    selected={sel === finca.fincaReference}
                    checked={Boolean(seleccionada?.(finca.fincaReference))}
                    vinculada={Boolean(vinculada?.(finca.fincaReference))}
                    onSelect={() => setSel(finca.fincaReference)}
                    onToggle={onToggleSeleccion ? () => onToggleSeleccion(finca) : undefined}
                    onProperty={
                      onProperty
                        ? () => onProperty(finca)
                        : hrefDe?.(finca)
                          ? () => router.push(hrefDe(finca) ?? "")
                          : undefined
                    }
                  />
                </li>
              ))}
            </ul>
          )}
          {pie}
        </div>
        {ficha ? (
          <div className="hidden min-w-[320px] flex-[1_1_380px] xl:sticky xl:top-28 xl:block">
            <FincaDetallePanel
              finca={ficha}
              href={hrefDe?.(ficha)}
              vinculada={Boolean(vinculada?.(ficha.fincaReference))}
              onProperty={
                onProperty
                  ? () => onProperty(ficha)
                  : hrefDe?.(ficha)
                    ? () => router.push(hrefDe(ficha) ?? "")
                    : undefined
              }
            />
          </div>
        ) : null}
      </div>

      {ficha ? (
        <div className="xl:hidden">
          <FincaDetallePanel
            finca={ficha}
            href={hrefDe?.(ficha)}
            vinculada={Boolean(vinculada?.(ficha.fincaReference))}
            onProperty={
              onProperty
                ? () => onProperty(ficha)
                : hrefDe?.(ficha)
                  ? () => router.push(hrefDe(ficha) ?? "")
                  : undefined
            }
            onCerrar={() => setSel(null)}
          />
        </div>
      ) : null}
    </div>
  );
}

const LEYENDA_FILTRO_HINT = "La clasificación la da Catastro, no se marca a mano";
