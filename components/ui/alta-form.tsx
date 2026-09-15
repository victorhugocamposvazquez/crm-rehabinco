"use client";

import { type FormEvent, type ReactNode } from "react";
import { Sheet } from "@/components/ui/sheet";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { horaAltaBorrador } from "@/lib/ui/alta-borrador";
import { cn } from "@/lib/utils";

export const altaControl =
  "mt-2 h-11 w-full rounded-[10px] border border-[var(--input)] bg-white px-3.5 text-[15px] outline-none transition-[border,box-shadow] placeholder:text-[var(--text-3)] focus:border-accent focus:ring-[3px] focus:ring-accent/15 disabled:bg-[var(--surface-soft)]";

export function AltaShell({
  open,
  onOpenChange,
  title,
  hint,
  children,
  primaryLabel,
  saving,
  disablePrimary,
  onSubmit,
  footerHint = "Cerrar guarda un borrador en este navegador. Crear lo pasa al listado.",
  borrador,
  elevated = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  hint: string;
  children: ReactNode;
  primaryLabel: string;
  saving: boolean;
  disablePrimary?: boolean;
  onSubmit: () => void | Promise<void>;
  footerHint?: string;
  elevated?: boolean;
  borrador?: {
    activo: boolean;
    guardadoEn?: string | null;
    onEliminar: () => void;
  };
}) {
  const enviar = (evento?: FormEvent) => {
    evento?.preventDefault();
    if (saving || disablePrimary) return;
    void onSubmit();
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      variant="side"
      side="right"
      elevated={elevated}
      className="min-[820px]:w-[min(56rem,92vw)]"
    >
      <form
        className="flex h-full min-h-0 flex-col"
        onSubmit={enviar}
        onKeyDown={(evento) => {
          if ((evento.metaKey || evento.ctrlKey) && evento.key === "Enter") enviar();
        }}
      >
        <header className="shrink-0 border-b border-[var(--border-soft)] px-6 py-5 min-[820px]:px-8">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-[17px] font-semibold tracking-tight text-foreground">{title}</h2>
              <p className="mt-1 max-w-[40rem] text-[13px] leading-5 text-[var(--text-2)]">{hint}</p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] text-[20px] leading-none text-[var(--text-2)] hover:bg-[var(--surface-soft)]"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
        </header>
        {borrador?.activo ? (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-[var(--amber-bg)] px-6 py-2.5 min-[820px]:px-8">
            <p className="text-[12.5px] text-[var(--amber-ink)]">
              Borrador en este dispositivo{horaAltaBorrador(borrador.guardadoEn) ? ` · ${horaAltaBorrador(borrador.guardadoEn)}` : ""}. Cerrar no lo borra.
            </p>
            <button
              type="button"
              onClick={() => {
                if (!window.confirm("¿Eliminar este borrador? No se puede deshacer.")) return;
                borrador?.onEliminar();
              }}
              className="text-[12.5px] font-semibold text-[var(--amber-ink)] underline-offset-2 hover:underline"
            >
              Eliminar borrador
            </button>
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6 min-[820px]:px-8 min-[820px]:py-7">
          <div className="flex flex-col gap-8 min-[820px]:grid min-[820px]:grid-cols-2 min-[820px]:items-start min-[820px]:gap-x-10 min-[820px]:gap-y-8">
            {children}
          </div>
        </div>
        <footer className="shrink-0 border-t border-[var(--border-soft)] px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] min-[820px]:px-8">
          <div className="flex gap-2.5">
            <button
              type="submit"
              disabled={saving || disablePrimary}
              className="h-11 flex-1 rounded-[10px] bg-accent text-[14px] font-semibold text-white disabled:opacity-45"
            >
              {saving ? "Guardando…" : primaryLabel}
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-11 rounded-[10px] border border-[var(--input)] px-4 text-[14px] font-semibold"
            >
              Cerrar
            </button>
          </div>
          <p className="mt-2.5 text-[12px] text-[var(--text-3)]">{footerHint}</p>
        </footer>
      </form>
    </Sheet>
  );
}

export function AltaSection({
  title,
  hint,
  children,
  wide,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <section className={cn("min-w-0", wide && "min-[820px]:col-span-2")}>
      <div className="mb-3.5">
        <h3 className="text-[14px] font-semibold text-foreground">{title}</h3>
        {hint ? <p className="mt-1 text-[12.5px] leading-5 text-[var(--text-2)]">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function AltaField({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-[12.5px] font-semibold text-[var(--text-2)]">
        {label}
        {optional ? <span className="ml-1.5 font-normal text-[var(--text-3)]">opcional</span> : null}
      </span>
      {children}
    </label>
  );
}

export type PersonaOpcion = { id: string; nombre: string; telefono: string | null };

export function AltaPersona({
  fijo,
  fijoNombre,
  permitirNinguno,
  seleccionado,
  onSeleccionar,
  onLimpiar,
  q,
  setQ,
  sugeridos,
  onAltaNueva,
  autoFocus,
}: {
  fijo?: boolean;
  fijoNombre?: string;
  permitirNinguno?: boolean;
  seleccionado?: PersonaOpcion;
  onSeleccionar: (persona: PersonaOpcion) => void;
  onLimpiar: () => void;
  q: string;
  setQ: (valor: string) => void;
  sugeridos: PersonaOpcion[];
  onAltaNueva: (nombreSugerido?: string) => void;
  autoFocus?: boolean;
}) {
  if (fijo) {
    return (
      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3.5 text-[15px] font-semibold">
        {fijoNombre || seleccionado?.nombre || "Cliente"}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <ToggleChip
          on={!seleccionado}
          onClick={() => {
            onLimpiar();
            setQ("");
          }}
        >
          De la agenda
        </ToggleChip>
        <ToggleChip
          on={false}
          onClick={() => onAltaNueva()}
        >
          Nuevo
        </ToggleChip>
        {permitirNinguno ? (
          <button
            type="button"
            onClick={() => {
              onLimpiar();
              setQ("");
            }}
            className="h-9 px-1 text-[13px] font-medium text-[var(--text-2)] hover:text-foreground"
          >
            Sin asignar
          </button>
        ) : null}
      </div>

      {seleccionado ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-[12px] border border-accent bg-accent-soft px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold">{seleccionado.nombre}</div>
            {seleccionado.telefono ? <div className="mt-0.5 font-mono text-[12.5px] text-[var(--text-2)]">{seleccionado.telefono}</div> : null}
          </div>
          <button type="button" onClick={onLimpiar} className="shrink-0 text-[13px] font-semibold text-accent">
            Cambiar
          </button>
        </div>
      ) : (
        <div className="mt-4">
          <input
            autoFocus={autoFocus}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(evento) => {
              if (evento.key !== "Enter") return;
              evento.preventDefault();
              if (sugeridos.length === 1) {
                onSeleccionar(sugeridos[0]);
                setQ("");
              }
            }}
            placeholder="Escribe un nombre o teléfono"
            className={altaControl}
          />
          {q.trim() ? (
            <div className="mt-2 overflow-hidden rounded-[12px] border border-[var(--border)]">
              {sugeridos.map((persona) => (
                <button
                  key={persona.id}
                  type="button"
                  onClick={() => {
                    onSeleccionar(persona);
                    setQ("");
                  }}
                  className="flex w-full items-center justify-between gap-3 border-b border-[var(--border-soft)] px-4 py-3 text-left last:border-0 hover:bg-[var(--surface-soft)]"
                >
                  <span className="truncate text-[14px] font-medium">{persona.nombre}</span>
                  <span className="shrink-0 font-mono text-[12px] text-[var(--text-2)]">{persona.telefono || ""}</span>
                </button>
              ))}
              {sugeridos.length === 0 ? (
                <div className="px-4 py-3 text-[13px] text-[var(--text-2)]">
                  Sin coincidencias.{" "}
                  <button
                    type="button"
                    className="font-semibold text-accent"
                    onClick={() => onAltaNueva(q.trim())}
                  >
                    Crear «{q.trim()}»
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-2.5 text-[12.5px] leading-5 text-[var(--text-3)]">La agenda no se lista entera: busca y elige, o pulsa Nuevo para la ficha completa.</p>
          )}
        </div>
      )}
    </div>
  );
}
