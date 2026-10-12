"use client";

import { Search, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Control segmentado estilo valorador.html (.seg) */
export function SegControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div
      className="flex max-w-full gap-0.5 overflow-x-auto rounded-full border border-[var(--border)] bg-[var(--surface-soft)] p-1 [scrollbar-width:none]"
      role="tablist"
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          className={cn(
            "shrink-0 rounded-full border border-transparent px-3.5 py-1.5 text-[13px] font-medium whitespace-nowrap text-[var(--text-3)] transition-colors min-[520px]:px-4 min-[520px]:py-2",
            value === o.id && "border-[var(--border-strong)] bg-[var(--surface)] text-foreground",
          )}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function BandBorrador({
  etiqueta,
  onReanudar,
  onDescartar,
}: {
  etiqueta: string;
  onReanudar: () => void;
  onDescartar: () => void;
}) {
  return (
    <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3.5 py-2.5 text-[13px]">
      <span>
        Tienes una valoración a medias en <b>{etiqueta}</b>
      </span>
      <span className="flex flex-wrap items-center gap-3">
        <button type="button" className="underline underline-offset-2" onClick={onReanudar}>
          Reanudar
        </button>
        <button type="button" className="text-[var(--text-3)] underline underline-offset-2" onClick={onDescartar}>
          Descartar
        </button>
      </span>
    </div>
  );
}

export function CampoEntrada({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: "search" | "file";
  children: React.ReactNode;
}) {
  const Ico = icon === "file" ? FileText : Search;
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] text-[var(--text-3)]">{label}</label>
      <div className="flex h-12 items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3.5 focus-within:border-[var(--border-strong)]">
        {icon ? <Ico className="h-[18px] w-[18px] shrink-0 text-[var(--text-3)]" aria-hidden /> : null}
        {children}
      </div>
    </div>
  );
}

export function SugerenciaChip({
  titulo,
  subtitulo,
  onClick,
}: {
  titulo: string;
  subtitulo?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-left transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
      onClick={onClick}
    >
      <span className="text-[14px]">{titulo}</span>
      {subtitulo ? <span className="text-[12px] text-[var(--text-3)]">{subtitulo}</span> : null}
    </button>
  );
}

export function TagAvm({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-0.5 text-[12px] text-[var(--text-3)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function QNav({
  label = "Continuar",
  disabled,
  onContinuar,
  extra,
}: {
  label?: string;
  disabled?: boolean;
  onContinuar: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
      {extra ?? <span />}
      <Button type="button" disabled={disabled} onClick={onContinuar}>
        {label}
      </Button>
    </div>
  );
}

export function LinkSaltar({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="px-0.5 py-2 text-[13px] text-[var(--text-3)] hover:text-foreground" onClick={onClick}>
      No lo sé
    </button>
  );
}
