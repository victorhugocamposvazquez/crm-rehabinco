"use client";

import { AvatarComercial } from "@/components/ui/avatar-comercial";
import { cn } from "@/lib/utils";
import { colorComercial } from "@/lib/ui/tokens";

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
    <div className="flex flex-wrap items-end gap-1">
      {comerciales.map((item) => {
        const on = valor === item.id;
        const color = colorComercial(item.id, item.color);
        return (
          <button
            key={item.id}
            type="button"
            title={item.nombre}
            onClick={() => onChange(on ? "" : item.id)}
            className={cn(
              "flex min-w-[3.25rem] flex-col items-center gap-1 rounded-[12px] px-1.5 py-1.5 transition-[opacity,background] duration-150",
              on ? "bg-accent-soft" : valor ? "opacity-40 hover:opacity-70" : "hover:bg-[var(--surface-soft)]"
            )}
          >
            <AvatarComercial
              id={item.id}
              nombre={item.nombre}
              color={item.color}
              size={32}
              className={on ? "ring-2 ring-accent ring-offset-2" : "shadow-[0_0_0_2px_#fff,0_0_0_3px_rgba(19,28,26,0.08)]"}
            />
            <span className="max-w-[4.75rem] truncate text-[11px] font-semibold" style={{ color }}>
              {item.nombre.split(" ")[0]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
