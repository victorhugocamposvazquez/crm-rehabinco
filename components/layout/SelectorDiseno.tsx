"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useDiseno } from "@/lib/ui/diseno";
import type { Diseno } from "@/lib/ui/diseno-config";

const OPCIONES: { valor: Diseno; label: string; nota: string }[] = [
  { valor: "clasico", label: "Clásico", nota: "Menú lateral" },
  { valor: "aire", label: "Aire", nota: "Nuevo, más espacioso" },
];

/** Cambia entre el diseño clásico y el nuevo diseño Aire (por navegador). */
export function SelectorDiseno({ onCambio }: { onCambio?: () => void }) {
  const [diseno, fijar] = useDiseno();
  const router = useRouter();
  return (
    <div className="mt-3 rounded-[12px] border border-border bg-[var(--surface-soft)] p-3.5" data-testid="selector-diseno">
      <h3 className="mb-2.5 text-[13px] font-semibold">Diseño</h3>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Diseño">
        {OPCIONES.map((op) => (
          <button
            key={op.valor}
            type="button"
            role="radio"
            aria-checked={diseno === op.valor}
            onClick={() => {
              fijar(op.valor);
              if (op.valor === "aire") router.push("/inicio");
              onCambio?.();
            }}
            className={cn(
              "rounded-[10px] border px-3 py-2 text-left",
              diseno === op.valor
                ? "border-[var(--accent)] bg-[var(--surface)]"
                : "border-border bg-[var(--surface)] hover:border-[var(--border-strong)]"
            )}
          >
            <span className="block text-[13.5px] font-medium">{op.label}</span>
            <span className="block text-[12px] text-[var(--text-3)]">{op.nota}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
