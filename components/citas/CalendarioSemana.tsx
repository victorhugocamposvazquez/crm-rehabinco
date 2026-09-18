"use client";

import { useRef, useState } from "react";
import { AvatarComercial } from "@/components/ui/avatar-comercial";
import {
  CAL_HORA_FIN,
  CAL_HORA_INICIO,
  CAL_PX_HORA,
  horaCita,
  horaDesdeMinutos,
  minutosDesdeOffsetY,
  posicionEventoCalendario,
  TIPO_CITA_LABEL,
  type TipoCita,
} from "@/lib/citas/citas";
import { colorComercial } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";

export type CitaRejilla = {
  id: string;
  comercial_id: string;
  tipo: string;
  titulo: string;
  empieza: string;
  termina: string;
  estado: string;
  lugar?: string | null;
  profiles?: { nombre_completo?: string | null; color?: string | null } | null;
};

export function GuiaHoraCalendario({ minutos }: { minutos: number }) {
  const top = (minutos / 60 - CAL_HORA_INICIO) * CAL_PX_HORA;
  if (top < 0 || top > (CAL_HORA_FIN - CAL_HORA_INICIO + 1) * CAL_PX_HORA) return null;
  return <div className="cal-snap" data-hora={horaDesdeMinutos(minutos)} style={{ top }} />;
}

export function EventoCalendarioChip({
  cita,
  compact,
}: {
  cita: CitaRejilla;
  compact?: boolean;
}) {
  const color = colorComercial(cita.comercial_id, cita.profiles?.color);
  return (
    <>
      <div className="flex items-center gap-1">
        <AvatarComercial
          id={cita.comercial_id}
          nombre={cita.profiles?.nombre_completo}
          color={cita.profiles?.color}
          size={compact ? 16 : 18}
        />
        <p className="min-w-0 truncate text-[11px] font-semibold" style={{ color }}>
          {horaCita(cita.empieza)} · {TIPO_CITA_LABEL[(cita.tipo as TipoCita) ?? "otro"] ?? cita.tipo}
        </p>
      </div>
      <p className="truncate text-[12px] font-medium">{cita.titulo}</p>
    </>
  );
}

export function CalendarioSemana({
  semana,
  hoy,
  porDia,
  puedeGestionar,
  onPickDia,
  onMover,
  onEditar,
  onCrearHueco,
}: {
  semana: string[];
  hoy: string;
  porDia: Map<string, CitaRejilla[]>;
  puedeGestionar?: (comercialId: string) => boolean;
  onPickDia: (dia: string) => void;
  onMover: (id: string, dia: string, opts?: { offsetY?: number | null }) => void;
  onEditar: (id: string) => void;
  onCrearHueco: (dia: string, minutos: number) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [over, setOver] = useState<{ dia: string; minutos: number } | null>(null);
  const arrastroRef = useRef(false);
  const altura = (CAL_HORA_FIN - CAL_HORA_INICIO + 1) * CAL_PX_HORA;

  const marcarSobre = (dia: string, e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    setOver({ dia, minutos: minutosDesdeOffsetY(y) });
  };

  return (
    <div className="mt-4 hidden overflow-hidden rounded-[14px] border border-border bg-white min-[820px]:block">
      <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))] border-b border-[var(--border-soft)]">
        <div />
        {semana.map((d) => {
          const esHoy = d === hoy;
          const sobre = over?.dia === d;
          return (
            <button
              key={d}
              type="button"
              onClick={() => onPickDia(d)}
              onDragOver={(e) => {
                e.preventDefault();
                setOver((prev) => ({ dia: d, minutos: prev?.dia === d ? prev.minutos : CAL_HORA_INICIO * 60 }));
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/cita");
                if (id) onMover(id, d);
                setDraggingId(null);
                setOver(null);
              }}
              className={cn(
                "h-[52px] border-l border-[var(--border-soft)] text-center transition-colors duration-150",
                sobre && "bg-accent-soft"
              )}
            >
              <p className="text-[11px] uppercase text-[var(--label)]">
                {new Date(`${d}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short" })}
              </p>
              <span className={`inline-grid h-7 w-7 place-items-center rounded-full text-[13px] font-semibold ${esHoy ? "bg-accent text-white" : ""}`}>
                {new Date(`${d}T12:00:00`).getDate()}
              </span>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))]">
        <div className="relative" style={{ height: altura }}>
          {Array.from({ length: CAL_HORA_FIN - CAL_HORA_INICIO + 1 }, (_, i) => CAL_HORA_INICIO + i).map((h, i) => (
            <div key={h} className="absolute right-1 font-mono text-[11px] text-[var(--text-3)]" style={{ top: i * CAL_PX_HORA }}>
              {h}:00
            </div>
          ))}
        </div>
        {semana.map((d) => {
          const lista = porDia.get(d) ?? [];
          const esHoy = d === hoy;
          const sobre = over?.dia === d;
          return (
            <div
              key={d}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("[data-cal-evento]")) return;
                const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
                onCrearHueco(d, minutosDesdeOffsetY(y));
              }}
              onDragOver={(e) => marcarSobre(d, e)}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setOver((prev) => (prev?.dia === d ? null : prev));
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/cita");
                if (id) {
                  const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
                  onMover(id, d, { offsetY: y });
                }
                setDraggingId(null);
                setOver(null);
              }}
              className={cn(
                "relative cursor-pointer border-l border-[var(--border-soft)] transition-colors duration-150",
                sobre && "cal-col--over"
              )}
              style={{ height: altura, background: sobre ? undefined : esHoy ? "#FBFBF9" : "#fff" }}
            >
              {Array.from({ length: CAL_HORA_FIN - CAL_HORA_INICIO + 1 }).map((_, i) => (
                <div key={i} className="absolute inset-x-0 border-t border-[var(--border-row)]" style={{ top: i * CAL_PX_HORA }} />
              ))}
              {sobre ? <GuiaHoraCalendario minutos={over.minutos} /> : null}
              {lista.map((cita) => {
                const { top, height } = posicionEventoCalendario(cita.empieza, cita.termina);
                const color = colorComercial(cita.comercial_id, cita.profiles?.color);
                const prevista = cita.estado === "prevista";
                const editable = prevista && (puedeGestionar?.(cita.comercial_id) ?? true);
                const arrastrando = draggingId === cita.id;
                return (
                  <button
                    key={cita.id}
                    type="button"
                    data-cal-evento
                    draggable={editable}
                    onDragStart={(e) => {
                      arrastroRef.current = true;
                      e.dataTransfer.setData("text/cita", cita.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDraggingId(cita.id);
                      const ghost = e.currentTarget.cloneNode(true) as HTMLElement;
                      ghost.classList.add("cal-ghost");
                      ghost.style.position = "absolute";
                      ghost.style.top = "-1000px";
                      ghost.style.width = `${e.currentTarget.offsetWidth}px`;
                      ghost.style.height = `${e.currentTarget.offsetHeight}px`;
                      document.body.appendChild(ghost);
                      e.dataTransfer.setDragImage(ghost, 16, 12);
                      requestAnimationFrame(() => ghost.remove());
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setOver(null);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (arrastroRef.current) {
                        arrastroRef.current = false;
                        return;
                      }
                      onPickDia(d);
                      if (editable) onEditar(cita.id);
                    }}
                    className={cn(
                      "cal-evento absolute inset-x-1 overflow-hidden rounded-[7px] px-1.5 py-0.5 text-left",
                      editable && "cursor-grab active:cursor-grabbing",
                      !editable && prevista && "cursor-default",
                      arrastrando && "cal-evento--dragging"
                    )}
                    style={{
                      top,
                      height,
                      background: `${color}1A`,
                      borderLeft: `3px solid ${color}`,
                    }}
                  >
                    <EventoCalendarioChip cita={cita} compact />
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
