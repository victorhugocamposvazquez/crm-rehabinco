"use client";

import { useEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import { CitaAcciones } from "@/components/citas/CitaAcciones";
import { EnlaceMaps } from "@/components/citas/InmueblePreviewCita";
import { EventoCalendarioChip, GuiaHoraCalendario } from "@/components/citas/CalendarioSemana";
import { AvatarComercial } from "@/components/ui/avatar-comercial";
import { Button } from "@/components/ui/button";
import { TimeInput } from "@/components/ui/time-input";
import { FichaLink } from "@/components/crm/FichaPeek";
import { cn } from "@/lib/utils";
import { nombreYApellido } from "@/lib/ui/tokens";
import {
  CAL_HORA_FIN,
  CAL_HORA_INICIO,
  CAL_PX_HORA,
  citaAtenuadaEnCalendario,
  horaCita,
  columnasEventosSolapados,
  estiloAnchoEventoSolapado,
  minutosDesdeOffsetY,
  posicionEventoCalendario,
  TIPO_CITA_LABEL,
  type TipoCita,
} from "@/lib/citas/citas";
import { varsEventoCalendario } from "@/lib/ui/calendar-event-style";
import { colorComercial } from "@/lib/ui/tokens";

const PULSACION_MS = 340;
const CANCELAR_SCROLL_PX = 14;
const INICIO_ARRASTRE_PX = 6;

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
  profiles?: { nombre_completo?: string | null; color?: string | null; email?: string | null } | null;
  propiedades?: { titulo?: string | null; direccion?: string | null; localidad?: string | null; referencia?: string | null } | null;
};

type ModoArrastre = "rejilla" | "lista";

export function CalendarioMovil({
  semana,
  dia,
  hoy,
  citas,
  porDia,
  userId,
  puedeGestionar,
  onPickDia,
  onMover,
  onEstado,
  onCambiarHora,
  onCrearHueco,
  onEditar,
  soloLista,
}: {
  semana: string[];
  dia: string;
  hoy: string;
  citas: CitaMovil[];
  porDia: Map<string, unknown[]>;
  userId?: string;
  puedeGestionar?: (comercialId: string) => boolean;
  soloLista?: boolean;
  onPickDia: (dia: string) => void;
  onMover: (id: string, dia: string) => void;
  onEstado: (id: string, estado: "prevista" | "hecha" | "cancelada") => void;
  onCambiarHora: (id: string, hora: string) => void;
  onCrearHueco?: (minutos: number) => void;
  onEditar: (id: string) => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interaccionRef = useRef<{
    id: string;
    pointerId: number;
    target: HTMLElement;
    x: number;
    y: number;
    modo: ModoArrastre;
    armado: boolean;
    movido: boolean;
  } | null>(null);
  const listenersRef = useRef<{ move: (e: PointerEvent) => void; up: (e: PointerEvent) => void } | null>(null);

  const [pressingId, setPressingId] = useState<string | null>(null);
  const [armedId, setArmedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overDia, setOverDia] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [snapMinutos, setSnapMinutos] = useState<number | null>(null);
  const columnas = columnasEventosSolapados(citas);

  const diaBajoPunto = (x: number, y: number) => {
    const nodo = document.elementFromPoint(x, y);
    return nodo?.closest("[data-cal-dia]")?.getAttribute("data-cal-dia") ?? null;
  };

  const quitarListeners = () => {
    if (!listenersRef.current) return;
    window.removeEventListener("pointermove", listenersRef.current.move);
    window.removeEventListener("pointerup", listenersRef.current.up);
    window.removeEventListener("pointercancel", listenersRef.current.up);
    listenersRef.current = null;
  };

  const limpiar = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    quitarListeners();
    interaccionRef.current = null;
    setPressingId(null);
    setArmedId(null);
    setDraggingId(null);
    setOverDia(null);
    setGhost(null);
    setSnapMinutos(null);
  };

  useEffect(() => () => limpiar(), []);

  const actualizarArrastre = (clientX: number, clientY: number) => {
    setGhost({ x: clientX, y: clientY });
    setOverDia(diaBajoPunto(clientX, clientY));
    const grid = gridRef.current;
    if (grid) {
      const rect = grid.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom && clientX >= rect.left && clientX <= rect.right) {
        setSnapMinutos(minutosDesdeOffsetY(clientY - rect.top));
      } else {
        setSnapMinutos(null);
      }
    }
  };

  const soltar = (e: PointerEvent) => {
    const inter = interaccionRef.current;
    if (!inter || e.pointerId !== inter.pointerId) return;

    try {
      inter.target.releasePointerCapture(e.pointerId);
    } catch {
      /* sin captura */
    }

    const { id, modo, armado, movido } = inter;

    if (modo === "rejilla") {
      if (!armado) {
        onEditar(id);
      } else if (!movido) {
        onEditar(id);
      } else {
        const destino = diaBajoPunto(e.clientX, e.clientY);
        const grid = gridRef.current;
        if (destino && destino !== dia) {
          onMover(id, destino);
        } else if (grid) {
          const rect = grid.getBoundingClientRect();
          const y = e.clientY - rect.top;
          if (y >= 0 && y <= rect.height) {
            onCambiarHora(id, horaDesdeOffset(y));
          }
        }
      }
    } else if (armado && movido) {
      const destino = diaBajoPunto(e.clientX, e.clientY);
      if (destino) onMover(id, destino);
    }

    limpiar();
  };

  const cancelarPulsacion = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    quitarListeners();
    interaccionRef.current = null;
    setPressingId(null);
    setArmedId(null);
    setDraggingId(null);
    setGhost(null);
    setSnapMinutos(null);
    setOverDia(null);
  };

  const iniciarPulsacion = (id: string, e: React.PointerEvent<HTMLElement>, modo: ModoArrastre) => {
    if (e.button !== 0) return;

    cancelarPulsacion();

    const target = e.currentTarget;
    interaccionRef.current = {
      id,
      pointerId: e.pointerId,
      target,
      x: e.clientX,
      y: e.clientY,
      modo,
      armado: false,
      movido: false,
    };
    setPressingId(id);

    const onMove = (ev: PointerEvent) => {
      const inter = interaccionRef.current;
      if (!inter || ev.pointerId !== inter.pointerId) return;

      const dist = Math.hypot(ev.clientX - inter.x, ev.clientY - inter.y);

      if (!inter.armado) {
        if (dist > CANCELAR_SCROLL_PX) {
          cancelarPulsacion();
          return;
        }
        return;
      }

      if (!inter.movido && dist > INICIO_ARRASTRE_PX) {
        inter.movido = true;
        setDraggingId(inter.id);
      }
      if (inter.movido) {
        actualizarArrastre(ev.clientX, ev.clientY);
      }
    };

    const onUp = (ev: PointerEvent) => {
      if (interaccionRef.current?.pointerId !== ev.pointerId) return;
      soltar(ev);
    };

    listenersRef.current = { move: onMove, up: onUp };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    timerRef.current = setTimeout(() => {
      const inter = interaccionRef.current;
      if (!inter || inter.id !== id) return;
      inter.armado = true;
      setArmedId(id);
      setPressingId(null);
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(8);
      }
    }, PULSACION_MS);
  };

  const arrastrada = citas.find((item) => item.id === (draggingId ?? armedId));

  const textoAyuda = (() => {
    if (draggingId) {
      return overDia && overDia !== dia ? "Suelta para cambiar de día." : "Suelta en la rejilla para cambiar la hora.";
    }
    if (armedId) return "Mantén y arrastra para mover la hora o el día.";
    if (pressingId) return "Sigue pulsando…";
    return "Un toque abre la edición. Mantén pulsado un momento para mover.";
  })();

  return (
    <div className={soloLista ? "" : "min-[820px]:hidden"}>
      {!soloLista ? (
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
              className={cn(
                "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-[11px] border transition-[background,border,transform] duration-150",
                over || activo ? "scale-[1.04] border-foreground bg-accent-soft" : "border-[var(--border)] bg-[var(--surface)]",
                esHoy && !activo && "text-foreground"
              )}
            >
              <span className="text-[10.5px] uppercase tracking-[.05em] text-[var(--label)]">
                {new Date(`${d}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short" }).replace(".", "")}
              </span>
              <span className="text-[16px] font-semibold">{new Date(`${d}T12:00:00`).getDate()}</span>
              <span className="h-[5px] w-[5px] rounded-full" style={{ background: hay ? "var(--foreground)" : "transparent" }} />
            </button>
          );
        })}
      </div>
      ) : null}

      {!soloLista ? (
      <>
      <p className="mt-3 text-[12.5px] text-[var(--text-2)] transition-opacity duration-200">{textoAyuda}</p>

      <div
        ref={gridRef}
        className="relative mt-3 overflow-hidden rounded-[14px] border border-border bg-white"
        style={{ height: (CAL_HORA_FIN - CAL_HORA_INICIO + 1) * CAL_PX_HORA }}
        onClick={(e) => {
          if (draggingId || armedId || pressingId || (e.target as HTMLElement).closest("[data-cal-evento]")) return;
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
          const layout = columnas.get(cita.id);
          const ancho = estiloAnchoEventoSolapado(layout?.column ?? 0, layout?.columnCount ?? 1, 48, 2);
          const color = colorComercial(cita.comercial_id, cita.profiles?.color);
          const prevista = cita.estado === "prevista";
          const editable = prevista && (puedeGestionar?.(cita.comercial_id) ?? true);
          const pressing = pressingId === cita.id;
          const armed = armedId === cita.id;
          const dragging = draggingId === cita.id;
          return (
            <div
              key={cita.id}
              data-cal-evento
              onPointerDown={(e) => {
                if (!editable) return;
                iniciarPulsacion(cita.id, e, "rejilla");
              }}
              className={cn(
                "cal-evento absolute overflow-hidden rounded-[7px] px-2 py-1 select-none",
                pressing && "cal-evento--pressing",
                armed && "cal-evento--armed",
                dragging && "cal-evento--dragging",
                armed && "touch-none"
              )}
              style={{
                ...varsEventoCalendario(color),
                top,
                height,
                left: ancho.left,
                width: ancho.width,
                zIndex: armed || dragging ? 40 : (layout?.column ?? 0) + 1,
              }}
            >
              <EventoCalendarioChip cita={cita} />
            </div>
          );
        })}
      </div>

      {ghost && arrastrada && draggingId ? (
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
      </>
      ) : null}

      <div className={`overflow-hidden rounded-[14px] border border-border bg-white ${soloLista ? "" : "mt-4"}`}>
        <div className="border-b border-[var(--border-soft)] px-3.5 py-3 text-[14px] font-semibold capitalize">
          {new Date(`${dia}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
        </div>
        {citas.length === 0 ? (
          <div className="px-3.5 py-6 text-center">
            <p className="text-[13px] text-[var(--text-2)]">Sin citas este día.</p>
            {onCrearHueco ? (
              <Button type="button" size="sm" className="mt-3" onClick={() => onCrearHueco(10 * 60)}>
                Crear en este día
              </Button>
            ) : null}
          </div>
        ) : (
          citas.map((cita) => {
            const prevista = cita.estado === "prevista";
            const editable = prevista && (puedeGestionar?.(cita.comercial_id) ?? true);
            const mapsConsulta = cita.lugar?.trim() || cita.propiedades?.direccion;
            const gripArmed = armedId === cita.id;
            const gripPressing = pressingId === cita.id;
            return (
              <div
                key={cita.id}
                className={`flex items-start gap-2 border-b border-[var(--border-row)] px-3 py-3 last:border-0 ${
                  citaAtenuadaEnCalendario(cita.estado) ? "opacity-55" : ""
                }`}
              >
                {editable ? (
                  <button
                    type="button"
                    aria-label="Mantén pulsado para arrastrar a otro día"
                    onPointerDown={(e) => iniciarPulsacion(cita.id, e, "lista")}
                    className={cn(
                      "mt-1 grid h-11 w-8 shrink-0 select-none place-items-center rounded-lg text-[var(--text-3)] transition-[transform,background,box-shadow] duration-200",
                      gripPressing && "scale-95 bg-[var(--surface-soft)]",
                      gripArmed && "scale-105 bg-accent-soft shadow-sm touch-none"
                    )}
                  >
                    <GripVertical size={16} />
                  </button>
                ) : (
                  <span className="w-8 shrink-0" />
                )}
                <AvatarComercial
                  id={cita.comercial_id}
                  nombre={cita.profiles?.nombre_completo}
                  email={cita.profiles?.email}
                  color={cita.profiles?.color}
                  size={28}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-semibold">{cita.titulo}</p>
                  <p className="mt-0.5 text-[12px] text-[var(--text-2)]">
                    {nombreYApellido(cita.profiles?.nombre_completo, cita.profiles?.email) && cita.comercial_id !== userId
                      ? `${nombreYApellido(cita.profiles?.nombre_completo, cita.profiles?.email)} · `
                      : ""}
                    {TIPO_CITA_LABEL[(cita.tipo as TipoCita) ?? "otro"] ?? cita.tipo}
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
                  {editable ? (
                    <label className="mt-2 flex items-center gap-2 text-[12.5px] text-[var(--text-2)]">
                      Hora
                      <TimeInput
                        value={horaCita(cita.empieza)}
                        onChange={(v) => {
                          if (v) onCambiarHora(cita.id, v);
                        }}
                        className="h-10 rounded-[9px] border border-[var(--input)] bg-white px-2 text-[14px]"
                      />
                    </label>
                  ) : (
                    <p className="mt-1 font-mono text-[13px] text-[var(--text-2)]">{horaCita(cita.empieza)}</p>
                  )}
                  {(puedeGestionar?.(cita.comercial_id) ?? true) &&
                  (cita.estado === "prevista" || cita.estado === "hecha" || cita.estado === "no_asistio") ? (
                    <div className="mt-2">
                      <CitaAcciones cita={cita} onEstado={onEstado} onEditar={onEditar} compact />
                    </div>
                  ) : null}
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
