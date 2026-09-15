"use client";

import { useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import { CitaAcciones } from "@/components/citas/CitaAcciones";
import { EnlaceMaps } from "@/components/citas/InmueblePreviewCita";
import { EventoCalendarioChip, GuiaHoraCalendario } from "@/components/citas/CalendarioSemana";
import { AvatarComercial } from "@/components/ui/avatar-comercial";
import { FichaLink } from "@/components/crm/FichaPeek";
import {
  CAL_HORA_FIN,
  CAL_HORA_INICIO,
  CAL_PX_HORA,
  ESTADO_CITA_LABEL,
  horaCita,
  minutosDesdeOffsetY,
  posicionEventoCalendario,
  TIPO_CITA_LABEL,
  type EstadoCita,
  type TipoCita,
} from "@/lib/citas/citas";
import { colorComercial } from "@/lib/ui/tokens";

export type CitaMovil = {
  id: string;
  comercial_id: string;
  tipo: string;
  titulo: string;
  empieza: string;
  termina: string;
  propiedad_id: string | null;
  estado: string;
  lugar?: string | null;
  profiles?: { nombre_completo?: string | null; color?: string | null } | null;
  propiedades?: { titulo?: string | null; direccion?: string | null; localidad?: string | null; referencia?: string | null } | null;
};

export function CalendarioMovil({
  semana,
  dia,
  hoy,
  citas,
  porDia,
  admin,
  onPickDia,
  onMover,
  onEstado,
  onCambiarHora,
  onCrearHueco,
  onEditar,
}: {
  semana: string[];
  dia: string;
  hoy: string;
  citas: CitaMovil[];
  porDia: Map<string, unknown[]>;
  admin: boolean;
  onPickDia: (dia: string) => void;
  onMover: (id: string, dia: string) => void;
  onEstado: (id: string, estado: "hecha" | "cancelada") => void;
  onCambiarHora: (id: string, hora: string) => void;
  onCrearHueco?: (minutos: number) => void;
  onEditar: (id: string) => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const dragIdRef = useRef<string | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overDia, setOverDia] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [snapMinutos, setSnapMinutos] = useState<number | null>(null);

  const diaBajoPunto = (x: number, y: number) => {
    const nodo = document.elementFromPoint(x, y);
    return nodo?.closest("[data-cal-dia]")?.getAttribute("data-cal-dia") ?? null;
  };

  const empezar = (id: string, e: React.PointerEvent<HTMLElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragIdRef.current = id;
    startRef.current = { x: e.clientX, y: e.clientY };
    movedRef.current = false;
    setDraggingId(id);
    setGhost({ x: e.clientX, y: e.clientY });
  };

  const seguir = (e: React.PointerEvent) => {
    if (!dragIdRef.current) return;
    const start = startRef.current;
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) movedRef.current = true;
    setGhost({ x: e.clientX, y: e.clientY });
    setOverDia(diaBajoPunto(e.clientX, e.clientY));
    const grid = gridRef.current;
    if (grid) {
      const rect = grid.getBoundingClientRect();
      if (e.clientY >= rect.top && e.clientY <= rect.bottom && e.clientX >= rect.left && e.clientX <= rect.right) {
        setSnapMinutos(minutosDesdeOffsetY(e.clientY - rect.top));
      } else {
        setSnapMinutos(null);
      }
    }
  };

  const soltarEnRejilla = (e: React.PointerEvent) => {
    const id = dragIdRef.current;
    if (!id) return;
    if (!movedRef.current) {
      onEditar(id);
      limpiar();
      return;
    }
    const destino = diaBajoPunto(e.clientX, e.clientY);
    const grid = gridRef.current;
    if (destino && destino !== dia) {
      onMover(id, destino);
    } else if (grid) {
      const y = e.clientY - grid.getBoundingClientRect().top;
      if (y >= 0 && y <= grid.getBoundingClientRect().height) {
        onCambiarHora(id, horaDesdeOffset(y));
      }
    }
    limpiar();
  };

  const soltarEnLista = (e: React.PointerEvent) => {
    const id = dragIdRef.current;
    if (!id) return;
    if (!movedRef.current) {
      limpiar();
      return;
    }
    const destino = diaBajoPunto(e.clientX, e.clientY);
    if (destino) onMover(id, destino);
    limpiar();
  };

  const limpiar = () => {
    dragIdRef.current = null;
    startRef.current = null;
    movedRef.current = false;
    setDraggingId(null);
    setOverDia(null);
    setGhost(null);
    setSnapMinutos(null);
  };

  const arrastrada = citas.find((item) => item.id === draggingId);

  return (
    <div className="min-[820px]:hidden">
      <div className="flex gap-1.5">
        {semana.map((d) => {
          const activo = d === dia;
          const esHoy = d === hoy;
          const hay = (porDia.get(d)?.length ?? 0) > 0;
          const over = overDia === d;
          return (
            <button
              key={d}
              type="button"
              data-cal-dia={d}
              onClick={() => onPickDia(d)}
              className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-[11px] border transition-[background,border,transform] duration-150"
              style={{
                borderColor: over || activo ? "#0B7461" : "#E6E3DD",
                background: over ? "#E8F3EF" : activo ? "#E8F3EF" : "#fff",
                color: esHoy && !activo ? "#0B7461" : undefined,
                transform: over ? "scale(1.04)" : undefined,
              }}
            >
              <span className="text-[10.5px] uppercase tracking-[.05em] text-[var(--label)]">
                {new Date(`${d}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short" }).replace(".", "")}
              </span>
              <span className="text-[16px] font-semibold">{new Date(`${d}T12:00:00`).getDate()}</span>
              <span className="h-[5px] w-[5px] rounded-full" style={{ background: hay ? "#0B7461" : "transparent" }} />
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-[12.5px] text-[var(--text-2)]">
        {draggingId
          ? overDia && overDia !== dia
            ? "Suelta para cambiar de día."
            : "Suelta en la rejilla para cambiar la hora."
          : "Pulsa un evento para editarlo. Arrástralo al día o por la rejilla."}
      </p>

      <div
        ref={gridRef}
        className="relative mt-3 overflow-hidden rounded-[14px] border border-border bg-white"
        style={{ height: (CAL_HORA_FIN - CAL_HORA_INICIO + 1) * CAL_PX_HORA }}
        onClick={(e) => {
          if (draggingId || (e.target as HTMLElement).closest("[data-cal-evento]")) return;
          const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
          onCrearHueco?.(minutosDesdeOffsetY(y));
        }}
      >
        {Array.from({ length: CAL_HORA_FIN - CAL_HORA_INICIO + 1 }, (_, i) => CAL_HORA_INICIO + i).map((h, i) => (
          <div key={h} className="absolute inset-x-0 border-t border-[var(--border-row)]" style={{ top: i * CAL_PX_HORA }}>
            <span className="absolute left-2 -translate-y-1/2 font-mono text-[11px] text-[var(--text-3)]">{h}:00</span>
          </div>
        ))}
        {snapMinutos != null ? <GuiaHoraCalendario minutos={snapMinutos} /> : null}
        {citas.map((cita) => {
          const { top, height } = posicionEventoCalendario(cita.empieza, cita.termina);
          const color = colorComercial(cita.comercial_id, cita.profiles?.color);
          const prevista = cita.estado === "prevista";
          return (
            <div
              key={cita.id}
              data-cal-evento
              onPointerDown={(e) => {
                if (!prevista) return;
                empezar(cita.id, e);
              }}
              onPointerMove={seguir}
              onPointerUp={soltarEnRejilla}
              onPointerCancel={limpiar}
              className={`cal-evento absolute right-2 left-12 overflow-hidden rounded-[7px] px-2 py-1 touch-none select-none ${
                draggingId === cita.id ? "cal-evento--dragging" : ""
              }`}
              style={{
                top,
                height,
                background: `${color}1A`,
                borderLeft: `3px solid ${color}`,
              }}
            >
              <EventoCalendarioChip cita={cita} />
            </div>
          );
        })}
      </div>

      {ghost && arrastrada ? (
        <div
          className="cal-ghost pointer-events-none fixed z-[80] w-48 overflow-hidden rounded-[8px] px-2 py-1.5"
          style={{
            left: ghost.x + 10,
            top: ghost.y - 18,
            background: `${colorComercial(arrastrada.comercial_id, arrastrada.profiles?.color)}F2`,
            color: "#fff",
          }}
        >
          <p className="truncate text-[11px] font-semibold">
            {horaCita(arrastrada.empieza)} · {TIPO_CITA_LABEL[(arrastrada.tipo as TipoCita) ?? "otro"] ?? arrastrada.tipo}
          </p>
          <p className="truncate text-[12px] font-medium">{arrastrada.titulo}</p>
        </div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-[14px] border border-border bg-white">
        <div className="border-b border-[var(--border-soft)] px-3.5 py-3 text-[14px] font-semibold capitalize">
          {new Date(`${dia}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
        </div>
        {citas.length === 0 ? (
          <p className="px-3.5 py-6 text-center text-[13px] text-[var(--text-2)]">Sin citas este día.</p>
        ) : (
          citas.map((cita) => {
            const prevista = cita.estado === "prevista";
            const mapsConsulta = cita.lugar?.trim() || cita.propiedades?.direccion;
            return (
              <div
                key={cita.id}
                className={`flex items-start gap-2 border-b border-[var(--border-row)] px-3 py-3 last:border-0 ${
                  prevista ? "" : "opacity-60"
                }`}
              >
                {prevista ? (
                  <button
                    type="button"
                    aria-label="Arrastrar a otro día"
                    onPointerDown={(e) => empezar(cita.id, e)}
                    onPointerMove={seguir}
                    onPointerUp={soltarEnLista}
                    onPointerCancel={limpiar}
                    className="mt-1 grid h-11 w-8 shrink-0 touch-none select-none place-items-center rounded-lg text-[var(--text-3)]"
                  >
                    <GripVertical size={16} />
                  </button>
                ) : (
                  <span className="w-8 shrink-0" />
                )}
                <AvatarComercial
                  id={cita.comercial_id}
                  nombre={cita.profiles?.nombre_completo}
                  color={cita.profiles?.color}
                  size={28}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-semibold">{cita.titulo}</p>
                  <p className="mt-0.5 text-[12px] text-[var(--text-2)]">
                    {admin && cita.profiles?.nombre_completo ? `${cita.profiles.nombre_completo} · ` : ""}
                    {TIPO_CITA_LABEL[(cita.tipo as TipoCita) ?? "otro"] ?? cita.tipo}
                    {" · "}
                    {ESTADO_CITA_LABEL[(cita.estado as EstadoCita) ?? "prevista"] ?? cita.estado}
                  </p>
                  {cita.propiedad_id ? (
                    <FichaLink tipo="propiedad" id={cita.propiedad_id} className="mt-1 inline-block text-[12px]">
                      {[cita.propiedades?.referencia, cita.propiedades?.titulo || cita.propiedades?.direccion]
                        .filter(Boolean)
                        .join(" · ") || "Ver inmueble"}
                    </FichaLink>
                  ) : null}
                  {mapsConsulta ? (
                    <p className="mt-1 text-[12px]">
                      <EnlaceMaps consulta={mapsConsulta} compact />
                    </p>
                  ) : null}
                  {prevista ? (
                    <label className="mt-2 flex items-center gap-2 text-[12.5px] text-[var(--text-2)]">
                      Hora
                      <input
                        type="time"
                        value={horaCita(cita.empieza)}
                        onChange={(e) => {
                          if (e.target.value) onCambiarHora(cita.id, e.target.value);
                        }}
                        className="h-10 rounded-[9px] border border-[var(--input)] bg-white px-2 text-[14px]"
                      />
                    </label>
                  ) : (
                    <p className="mt-1 font-mono text-[13px] text-[var(--text-2)]">{horaCita(cita.empieza)}</p>
                  )}
                  <div className="mt-2">
                    <CitaAcciones cita={cita} onEstado={onEstado} onEditar={onEditar} compact />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function horaDesdeOffset(offsetY: number): string {
  const minutos = minutosDesdeOffsetY(offsetY);
  const h = Math.max(0, Math.min(23, Math.floor(minutos / 60)));
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
