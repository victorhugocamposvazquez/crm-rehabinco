"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ETIQUETA_USO, type UsoEdificio } from "@/lib/catastro/mapa/inspire";
import { FILTROS_VACIOS, type FiltroDivision, type FiltrosMapa } from "@/lib/catastro/mapa/filtros";

const USOS = Object.keys(ETIQUETA_USO) as UsoEdificio[];

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={cn(
        "rounded-full border px-3 py-1 text-sm",
        activo ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]" : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--accent-soft)]"
      )}
    >
      {children}
    </button>
  );
}

function Rango({
  min,
  max,
  onMin,
  onMax,
  placeholderMin,
  placeholderMax,
}: {
  min: number | null;
  max: number | null;
  onMin: (v: number | null) => void;
  onMax: (v: number | null) => void;
  placeholderMin: string;
  placeholderMax: string;
}) {
  const num = (s: string) => (s.trim() === "" || !Number.isFinite(Number(s)) ? null : Number(s));
  const cls = "h-10 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--border-strong)]";
  return (
    <div className="grid grid-cols-2 gap-2">
      <input inputMode="numeric" className={cls} placeholder={placeholderMin} value={min ?? ""} onChange={(e) => onMin(num(e.target.value))} />
      <input inputMode="numeric" className={cls} placeholder={placeholderMax} value={max ?? ""} onChange={(e) => onMax(num(e.target.value))} />
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-[var(--border)] px-4 py-4">
      <h3 className="mb-3 text-base font-medium">{titulo}</h3>
      {children}
    </section>
  );
}

/** Panel lateral de filtros del mapa de edificios (se aplican al momento). */
export function PanelFiltrosEdificios({
  filtros,
  total,
  onCambio,
  onCerrar,
}: {
  filtros: FiltrosMapa;
  total: number;
  onCambio: (f: FiltrosMapa) => void;
  onCerrar: () => void;
}) {
  const set = (parcial: Partial<FiltrosMapa>) => onCambio({ ...filtros, ...parcial });
  const division: { v: FiltroDivision; t: string }[] = [
    { v: "con", t: "Con división horizontal" },
    { v: "sin", t: "Sin división horizontal" },
  ];
  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-[var(--surface)]" data-testid="panel-filtros-edificios">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <h2 className="text-base font-semibold">Todos los filtros</h2>
        <button type="button" onClick={onCerrar} aria-label="Cerrar filtros" className="grid h-8 w-8 place-items-center rounded-full hover:bg-[var(--accent-soft)]">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Seccion titulo="Uso principal del edificio">
          <div className="flex flex-wrap gap-2">
            {USOS.map((u) => (
              <Chip
                key={u}
                activo={filtros.usos.includes(u)}
                onClick={() => set({ usos: filtros.usos.includes(u) ? filtros.usos.filter((x) => x !== u) : [...filtros.usos, u] })}
              >
                {ETIQUETA_USO[u]}
              </Chip>
            ))}
          </div>
        </Seccion>
        <Seccion titulo="División horizontal">
          <div className="flex flex-wrap gap-2">
            {division.map((d) => (
              <Chip key={d.v} activo={filtros.division === d.v} onClick={() => set({ division: filtros.division === d.v ? "todas" : d.v })}>
                {d.t}
              </Chip>
            ))}
          </div>
        </Seccion>
        <Seccion titulo="Número de inmuebles">
          <input
            inputMode="numeric"
            className="h-10 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--border-strong)]"
            placeholder="Mínimo de inmuebles"
            value={filtros.inmueblesMin ?? ""}
            onChange={(e) => set({ inmueblesMin: e.target.value.trim() === "" ? null : Number(e.target.value) || null })}
          />
        </Seccion>
        <Seccion titulo="Año de construcción">
          <Rango
            min={filtros.anioMin}
            max={filtros.anioMax}
            onMin={(v) => set({ anioMin: v })}
            onMax={(v) => set({ anioMax: v })}
            placeholderMin="Desde"
            placeholderMax="Hasta"
          />
        </Seccion>
        <Seccion titulo="Superficie construida (m²)">
          <Rango
            min={filtros.supMin}
            max={filtros.supMax}
            onMin={(v) => set({ supMin: v })}
            onMax={(v) => set({ supMax: v })}
            placeholderMin="Mínima"
            placeholderMax="Máxima"
          />
        </Seccion>
        <Seccion titulo="Seguimiento">
          <Chip activo={filtros.ocultarTrabajados} onClick={() => set({ ocultarTrabajados: !filtros.ocultarTrabajados })}>
            Ocultar trabajados
          </Chip>
        </Seccion>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3">
        <button type="button" onClick={() => onCambio(FILTROS_VACIOS)} className="h-10 rounded-[6px] border border-[var(--border)] px-3 text-sm hover:bg-[var(--accent-soft)]">
          Limpiar filtros
        </button>
        <button type="button" onClick={onCerrar} className="h-10 rounded-[6px] bg-[var(--accent)] px-4 text-sm text-[var(--accent-foreground)] hover:bg-[var(--accent-dark)]">
          Ver {total.toLocaleString("es-ES")} edificios
        </button>
      </div>
    </div>
  );
}
