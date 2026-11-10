"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const DIAS = ["L", "M", "X", "J", "V", "S", "D"] as const;
const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

function isoDe(anio: number, mes: number, dia: number) {
  return `${anio}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function partesIso(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return { anio: y, mes: m - 1, dia: d };
}

function etiquetaFecha(iso: string) {
  const p = partesIso(iso);
  if (!p) return "";
  const d = new Date(p.anio, p.mes, p.dia);
  const texto = d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  return texto.replace(".", "");
}

function celdas(anio: number, mes: number) {
  const inicio = (new Date(anio, mes, 1).getDay() + 6) % 7;
  const total = new Date(anio, mes + 1, 0).getDate();
  const out: Array<{ dia: number; iso: string } | null> = Array.from({ length: inicio }, () => null);
  for (let dia = 1; dia <= total; dia++) out.push({ dia, iso: isoDe(anio, mes, dia) });
  return out;
}

function useCapa(open: boolean, alto = 360) {
  const ancla = useRef<HTMLButtonElement>(null);
  const capa = useRef<HTMLDivElement>(null);
  const [caja, setCaja] = useState({ top: 0, left: 0, width: 280 });

  const colocar = () => {
    const r = ancla.current?.getBoundingClientRect();
    const altoCapa = capa.current?.offsetHeight || alto;
    if (!r) return;
    const width = Math.max(r.width, 280);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    const cabeAbajo = r.bottom + 8 + altoCapa < window.innerHeight - 8;
    const top = cabeAbajo ? r.bottom + 8 : Math.max(8, r.top - 8 - altoCapa);
    setCaja({ top, left, width });
  };

  useLayoutEffect(() => {
    if (!open) return;
    colocar();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const fuera = (e: MouseEvent) => {
      const n = e.target as Node;
      if (ancla.current?.contains(n) || capa.current?.contains(n)) return;
      ancla.current?.dispatchEvent(new Event("cerrar-capa", { bubbles: false }));
    };
    const alScroll = (e: Event) => {
      const nodo = e.target as Node | null;
      if (nodo && capa.current?.contains(nodo)) return;
      colocar();
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      ancla.current?.dispatchEvent(new Event("cerrar-capa", { bubbles: false }));
    };
    window.addEventListener("mousedown", fuera);
    window.addEventListener("keydown", tecla, true);
    window.addEventListener("resize", colocar);
    window.addEventListener("scroll", alScroll, true);
    return () => {
      window.removeEventListener("mousedown", fuera);
      window.removeEventListener("keydown", tecla, true);
      window.removeEventListener("resize", colocar);
      window.removeEventListener("scroll", alScroll, true);
    };
  }, [open]);

  return { ancla, capa, caja, colocar };
}

function Capa({
  open,
  ancla,
  capa,
  caja,
  children,
}: {
  open: boolean;
  ancla: React.RefObject<HTMLButtonElement | null>;
  capa: React.RefObject<HTMLDivElement | null>;
  caja: { top: number; left: number; width: number };
  children: ReactNode;
}) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={capa}
      style={{ top: caja.top, left: caja.left, minWidth: caja.width, zIndex: 12000 }}
      className="fixed rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[0_16px_40px_rgba(0,0,0,0.18)]"
    >
      {children}
    </div>,
    document.body
  );
}

function Campo({
  id,
  className,
  abierto,
  onClick,
  ancla,
  icono,
  children,
  onCerrar,
}: {
  id?: string;
  className?: string;
  abierto: boolean;
  onClick: () => void;
  ancla: React.RefObject<HTMLButtonElement | null>;
  icono: ReactNode;
  children: ReactNode;
  onCerrar: () => void;
}) {
  useEffect(() => {
    const el = ancla.current;
    if (!el) return;
    const cerrar = () => onCerrar();
    el.addEventListener("cerrar-capa", cerrar);
    return () => el.removeEventListener("cerrar-capa", cerrar);
  }, [ancla, onCerrar]);

  return (
    <button
      id={id}
      ref={ancla}
      type="button"
      aria-expanded={abierto}
      onClick={onClick}
      className={cn(
        "flex h-11 w-full items-center justify-between gap-2 rounded-[10px] border border-[var(--input)] bg-[var(--field)] px-3.5 text-left text-[15px] text-foreground outline-none transition-[border,box-shadow] focus-visible:border-foreground focus-visible:ring-[3px] focus-visible:ring-foreground/10",
        className
      )}
    >
      <span className="min-w-0 truncate">{children}</span>
      <span className="shrink-0 text-[var(--text-3)]">{icono}</span>
    </button>
  );
}

export function FechaInput({
  id,
  value,
  onChange,
  className,
  placeholder = "Elegir fecha",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const hoy = new Date();
  const actual = partesIso(value);
  const [open, setOpen] = useState(false);
  const [vista, setVista] = useState(() => ({
    anio: actual?.anio ?? hoy.getFullYear(),
    mes: actual?.mes ?? hoy.getMonth(),
  }));
  const { ancla, capa, caja } = useCapa(open, 380);
  const hoyIso = isoDe(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  const abrir = () => {
    const p = partesIso(value);
    if (p) setVista({ anio: p.anio, mes: p.mes });
    setOpen((v) => !v);
  };

  const mover = (delta: number) => {
    setVista((v) => {
      const d = new Date(v.anio, v.mes + delta, 1);
      return { anio: d.getFullYear(), mes: d.getMonth() };
    });
  };

  return (
    <>
      <Campo
        id={id}
        className={className}
        abierto={open}
        onClick={abrir}
        ancla={ancla}
        onCerrar={() => setOpen(false)}
        icono={<Calendar className="h-4 w-4" strokeWidth={1.75} />}
      >
        {value ? etiquetaFecha(value) : <span className="text-[var(--text-3)]">{placeholder}</span>}
      </Campo>
      <Capa open={open} ancla={ancla} capa={capa} caja={caja}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <button type="button" onClick={() => mover(-1)} className="grid h-8 w-8 place-items-center rounded-[8px] text-[var(--text-2)] hover:bg-[var(--surface-soft)]" aria-label="Mes anterior">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-[13.5px] font-semibold capitalize">
            {MESES[vista.mes]} {vista.anio}
          </p>
          <button type="button" onClick={() => mover(1)} className="grid h-8 w-8 place-items-center rounded-[8px] text-[var(--text-2)] hover:bg-[var(--surface-soft)]" aria-label="Mes siguiente">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] font-medium text-[var(--text-3)]">
          {DIAS.map((d) => (
            <span key={d} className="py-1">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {celdas(vista.anio, vista.mes).map((celda, i) =>
            celda ? (
              <button
                key={celda.iso}
                type="button"
                onClick={() => {
                  onChange(celda.iso);
                  setOpen(false);
                }}
                className={cn(
                  "grid h-9 place-items-center rounded-[9px] text-[13px] tabular-nums hover:bg-[var(--surface-soft)]",
                  celda.iso === value && "bg-accent font-semibold text-accent-foreground hover:bg-accent",
                  celda.iso === hoyIso && celda.iso !== value && "ring-1 ring-inset ring-[var(--border)]"
                )}
              >
                {celda.dia}
              </button>
            ) : (
              <span key={`v-${i}`} />
            )
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            onChange(hoyIso);
            setVista({ anio: hoy.getFullYear(), mes: hoy.getMonth() });
            setOpen(false);
          }}
          className="mt-2 h-8 w-full rounded-[8px] text-[12.5px] font-semibold text-accent hover:bg-accent-soft"
        >
          Hoy
        </button>
      </Capa>
    </>
  );
}

function columna(valores: string[], activo: string, onPick: (v: string) => void) {
  return (
    <div className="h-52 overflow-y-auto overscroll-contain rounded-[10px] bg-[var(--surface-soft)] p-1">
      {valores.map((v) => (
        <button
          key={v}
          type="button"
          data-activo={v === activo ? "1" : undefined}
          onClick={() => onPick(v)}
          className={cn(
            "grid h-9 w-full place-items-center rounded-[8px] text-[14px] tabular-nums text-[var(--text-2)]",
            v === activo && "bg-accent font-semibold text-accent-foreground"
          )}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

export function HoraInput({
  id,
  value,
  onChange,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const { ancla, capa, caja } = useCapa(open, 280);
  const horas = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const minutos = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
  const trozos = (value || "00:00").split(":");
  const candidato = trozos[0] ?? "00";
  const hora = horas.includes(candidato) ? candidato : "00";
  const minutoRaw = (trozos[1] ?? "00").slice(0, 2);
  const minuto = minutos.includes(minutoRaw) ? minutoRaw : "00";

  useEffect(() => {
    if (!open) return;
    const idFrame = requestAnimationFrame(() => {
      capa.current?.querySelectorAll<HTMLElement>("[data-activo='1']").forEach((el) => {
        const padre = el.parentElement;
        if (!padre) return;
        padre.scrollTop = el.offsetTop - padre.clientHeight / 2 + el.clientHeight / 2;
      });
    });
    return () => cancelAnimationFrame(idFrame);
  }, [open, capa]);

  const poner = (h: string, m: string) => onChange(`${h}:${m}`);

  return (
    <>
      <Campo
        id={id}
        className={cn("tabular-nums", className)}
        abierto={open}
        onClick={() => setOpen((v) => !v)}
        ancla={ancla}
        onCerrar={() => setOpen(false)}
        icono={<Clock className="h-4 w-4" strokeWidth={1.75} />}
      >
        {value ? (
          <span>
            {hora}
            <span className="px-1 text-[var(--text-3)]">:</span>
            {minuto}
          </span>
        ) : (
          <span className="text-[var(--text-3)]">Elegir hora</span>
        )}
      </Campo>
      <Capa open={open} ancla={ancla} capa={capa} caja={{ ...caja, width: Math.max(caja.width, 220) }}>
        <div className="mb-2 grid grid-cols-2 gap-2 text-center text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-3)]">
          <span>Hora</span>
          <span>Minutos</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {columna(horas, hora, (h) => poner(h, minuto))}
          {columna(minutos, minuto, (m) => poner(hora, m))}
        </div>
      </Capa>
    </>
  );
}
