"use client";

import { type FormEvent, type ReactNode, type Ref } from "react";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/sheet";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { horaAltaBorrador } from "@/lib/ui/alta-borrador";
import { cn } from "@/lib/utils";

export const altaControl =
  "mt-2 h-11 w-full rounded-[10px] border border-[var(--input)] bg-[var(--field)] px-3.5 text-[15px] text-foreground outline-none transition-[border,box-shadow] placeholder:text-[var(--text-3)] focus:border-foreground focus:ring-[3px] focus:ring-foreground/10 disabled:bg-[var(--surface-soft)]";

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
  footerHint = "Cerrar guarda el borrador en este dispositivo. Para seguir, pulsa Seguir editando en el listado.",
  primaryHint,
  dangerAction,
  footerLeading,
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
  primaryHint?: string;
  dangerAction?: { label: string; onClick: () => void; disabled?: boolean };
  footerLeading?: ReactNode;
  elevated?: boolean;
  borrador?: {
    activo: boolean;
    guardadoEn?: string | null;
    onEliminar: () => void;
  };
}) {
  const enviar = (evento?: FormEvent) => {
    evento?.preventDefault();
    if (saving) return;
    if (disablePrimary && !primaryHint) return;
    void onSubmit();
  };

  const cerrar = () => {
    if (borrador?.activo) {
      toast.message("Borrador guardado en este dispositivo", {
        description: "Para seguir con lo que llevas escrito, pulsa Seguir editando en el listado.",
      });
    }
    onOpenChange(false);
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
        autoComplete="on"
        onSubmit={enviar}
        onKeyDown={(evento) => {
          if ((evento.metaKey || evento.ctrlKey) && evento.key === "Enter") enviar();
        }}
      >
        <header className="shrink-0 border-b border-[var(--border-soft)] px-6 py-5 min-[820px]:px-8">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-[22px] font-medium leading-tight tracking-[-0.03em] text-foreground">{title}</h2>
              <p className="mt-1 max-w-[40rem] text-[13px] leading-5 text-[var(--text-2)]">{hint}</p>
            </div>
            <button
              type="button"
              onClick={cerrar}
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
              Borrador guardado{horaAltaBorrador(borrador.guardadoEn) ? ` a las ${horaAltaBorrador(borrador.guardadoEn)}` : ""}. Si cierras, vuelve desde el listado con Seguir editando.
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
          <div className="flex items-center gap-2.5">
            {footerLeading ? <div className="shrink-0">{footerLeading}</div> : null}
            <button
              type="submit"
              disabled={saving || (disablePrimary && !primaryHint)}
              className={cn(
                "h-11 flex-1 rounded-[10px] bg-accent text-[14px] font-medium text-accent-foreground disabled:opacity-45",
                disablePrimary && primaryHint && "opacity-80"
              )}
            >
              {saving ? "Guardando…" : primaryLabel}
            </button>
            <button
              type="button"
              onClick={cerrar}
              className="h-11 rounded-[10px] border border-[var(--input)] px-4 text-[14px] font-semibold"
            >
              Cerrar
            </button>
          </div>
          {dangerAction ? (
            <button
              type="button"
              disabled={dangerAction.disabled || saving}
              onClick={dangerAction.onClick}
              className="mt-3 text-[13px] font-semibold text-[#8A3030] underline-offset-2 hover:underline disabled:opacity-45"
            >
              {dangerAction.label}
            </button>
          ) : null}
          <p
            className={cn(
              "mt-2.5 text-[12.5px] leading-5",
              primaryHint ? "font-medium text-[var(--amber-ink)]" : "text-[12px] text-[var(--text-3)]"
            )}
          >
            {primaryHint ?? footerHint}
          </p>
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
  required,
  className,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  wide?: boolean;
  required?: boolean;
  className?: string;
}) {
  return (
    <section className={cn("min-w-0", wide && "min-[820px]:col-span-2", className)}>
      <div className="mb-3.5">
        <h3 className="text-[14px] font-semibold text-foreground">
          {title}
          {required ? <span className="ml-1.5 font-normal text-[var(--text-3)]">obligatorio</span> : null}
        </h3>
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
  aviso,
  inputRef,
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
  aviso?: boolean;
  inputRef?: Ref<HTMLInputElement>;
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
          Cliente existente
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
            ref={inputRef}
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
            placeholder="Busca y pulsa un nombre"
            aria-invalid={aviso || undefined}
            className={cn(altaControl, aviso && "border-[var(--amber)] focus:border-[var(--amber)] focus:ring-[var(--amber)]/25")}
          />
          {q.trim() ? (
            <div className="mt-2 overflow-hidden rounded-[12px] border border-[var(--border)]">
              {sugeridos.length > 0 ? (
                <p className="border-b border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-2 text-[12px] text-[var(--text-2)]">
                  {sugeridos.length === 1 ? "Pulsa el nombre para elegirlo. Enter también vale." : "Pulsa un nombre para elegirlo. Escribirlo no basta."}
                </p>
              ) : null}
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
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium">{persona.nombre}</span>
                    {persona.telefono ? <span className="mt-0.5 block font-mono text-[12px] text-[var(--text-2)]">{persona.telefono}</span> : null}
                  </span>
                  <span className="shrink-0 text-[12.5px] font-semibold text-accent">Elegir</span>
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
            <p className={cn("mt-2.5 text-[12.5px] leading-5", aviso ? "font-medium text-[var(--amber-ink)]" : "text-[var(--text-3)]")}>
              {aviso
                ? "Falta elegir a alguien: pulsa un resultado o Nuevo."
                : "La agenda no se lista entera: busca y pulsa un nombre, o Nuevo para la ficha completa."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
