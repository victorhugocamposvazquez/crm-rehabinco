"use client";

import { celdasMes, horaCita, type CeldaMes } from "@/lib/citas/citas";
import { colorComercial } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";
import type { CitaRejilla } from "@/components/citas/CalendarioSemana";

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MAX_EVENTOS = 3;

export function CalendarioMes({
  dia,
  hoy,
  porDia,
  puedeGestionar,
  onPickDia,
  onEditar,
  onCrearHueco,
}: {
  dia: string;
  hoy: string;
  porDia: Map<string, CitaRejilla[]>;
  puedeGestionar?: (comercialId: string) => boolean;
  onPickDia: (dia: string) => void;
  onEditar: (id: string) => void;
  onCrearHueco: (dia: string, minutos: number) => void;
}) {
  const celdas: CeldaMes[] = celdasMes(dia);

  return (
    <div className="mt-4 overflow-hidden rounded-[14px] border border-border bg-white">
      <div className="grid grid-cols-7 border-b border-[var(--border-soft)] bg-[var(--surface-soft)]">
        {DIAS_SEMANA.map((label) => (
          <div key={label} className="py-2 text-center text-[11px] font-medium uppercase tracking-[.05em] text-[var(--label)]">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {celdas.map(({ dia: d, fueraMes }) => {
          const lista = porDia.get(d) ?? [];
          const esHoy = d === hoy;
          const activo = d === dia.slice(0, 10);
          const visibles = lista.slice(0, MAX_EVENTOS);
          const resto = lista.length - visibles.length;
          return (
            <div
              key={d}
              role="button"
              tabIndex={0}
              onClick={() => onPickDia(d)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onPickDia(d);
                }
              }}
              className={cn(
                "flex min-h-[72px] flex-col border-b border-r border-[var(--border-row)] p-1 text-left transition-colors min-[820px]:min-h-[96px] min-[820px]:p-1.5",
                fueraMes && "bg-[var(--surface-soft)]/60",
                activo && "ring-2 ring-inset ring-accent/40",
                !activo && "hover:bg-[var(--surface-soft)]"
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className={cn(
                    "inline-flex h-6 min-w-6 items-center justify-center rounded-full text-[12px] font-semibold min-[820px]:h-7 min-[820px]:min-w-7 min-[820px]:text-[13px]",
                    esHoy && "bg-accent text-white",
                    fueraMes && !esHoy && "text-[var(--text-3)]",
                    !fueraMes && !esHoy && "text-foreground"
                  )}
                >
                  {new Date(`${d}T12:00:00`).getDate()}
                </span>
                {!fueraMes && lista.length === 0 ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCrearHueco(d, 10 * 60);
                    }}
                    className="hidden text-[11px] font-semibold text-accent min-[820px]:inline"
                  >
                    +
                  </button>
                ) : null}
              </div>
              <div className="mt-0.5 flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                {visibles.map((cita) => {
                  const color = colorComercial(cita.comercial_id, cita.profiles?.color);
                  return (
                    <button
                      key={cita.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPickDia(d);
                        if (puedeGestionar?.(cita.comercial_id) ?? true) onEditar(cita.id);
                      }}
                      className={cn(
                        "w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium min-[820px]:text-[11px]",
                        cita.estado !== "prevista" && "opacity-55"
                      )}
                      style={{ background: `${color}1A`, color, borderLeft: `2px solid ${color}` }}
                      title={`${horaCita(cita.empieza)} · ${cita.titulo}`}
                    >
                      <span className="font-semibold">{horaCita(cita.empieza)}</span> {cita.titulo}
                    </button>
                  );
                })}
                {resto > 0 ? (
                  <span className="truncate px-0.5 text-[10px] font-medium text-[var(--text-2)] min-[820px]:text-[11px]">
                    +{resto} más
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
