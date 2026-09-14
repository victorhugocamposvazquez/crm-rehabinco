"use client";

import { AvatarComercial } from "@/components/ui/avatar-comercial";
import { cn } from "@/lib/utils";

export type ComercialFiltro = { id: string; nombre: string; color: string | null };

export function FiltroComercial({
  comerciales,
  valor,
  onChange,
}: {
  comerciales: ComercialFiltro[];
  valor: string;
  onChange: (id: string) => void;
}) {
  if (comerciales.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {comerciales.map((item) => {
        const on = valor === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(on ? "" : item.id)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] font-medium",
              on ? "border-accent bg-accent-soft text-accent-dark" : "border-border bg-white text-[var(--text-2)]"
            )}
            style={{ opacity: valor && !on ? 0.45 : 1 }}
          >
            <AvatarComercial nombre={item.nombre} color={item.color} size={18} />
            {item.nombre.split(" ")[0]}
          </button>
        );
      })}
    </div>
  );
}
