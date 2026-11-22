import { cn } from "@/lib/utils";
import { ETIQUETA_ESTADO_NOTA, type EstadoNota } from "@/lib/notas-simples/modelo";

const ESTILO: Record<EstadoNota, string> = {
  borrador: "bg-[var(--accent-soft)] text-[var(--text-2)]",
  solicitada: "bg-[var(--blue-bg)] text-[var(--blue)]",
  en_tramite: "bg-[var(--violet-bg)] text-[var(--violet-ink)]",
  recibida: "bg-[var(--amber-bg)] text-[var(--amber-ink)]",
  leida: "bg-[var(--green-bg)] text-[var(--green)]",
  cancelada: "bg-[var(--accent-soft)] text-[var(--text-3)]",
  error: "bg-[var(--red-bg)] text-[var(--red)]",
};

export function EstadoNotaBadge({ estado, className }: { estado: EstadoNota; className?: string }) {
  return <span className={cn("inline-flex w-max items-center rounded-[6px] px-1.5 py-0.5 text-[13px] font-medium", ESTILO[estado], className)}>{ETIQUETA_ESTADO_NOTA[estado]}</span>;
}
