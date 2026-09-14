"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { AvatarComercial } from "@/components/ui/avatar-comercial";
import { COLUMNAS_TAREA, type ColumnaTarea } from "@/lib/tareas/tareas";
import { cn } from "@/lib/utils";

export type TareaTarjeta = {
  id: string;
  titulo: string;
  col: ColumnaTarea;
  venceLabel: string;
  hora?: string | null;
  vencida?: boolean;
  hecha: boolean;
  link?: string | null;
  comercial: { nombre: string; color: string | null };
};

export function TareasBoard({
  tareas,
  onMover,
  onToggle,
  onAbrir,
}: {
  tareas: TareaTarjeta[];
  onMover: (id: string, col: ColumnaTarea) => void;
  onToggle: (id: string) => void;
  onAbrir: (id: string) => void;
}) {
  const [over, setOver] = useState<ColumnaTarea | null>(null);
  return (
    <div className="flex items-start gap-3 overflow-x-auto pb-2.5">
      {COLUMNAS_TAREA.map((col) => {
        const items = tareas.filter((t) => t.col === col.id);
        const hot = over === col.id;
        return (
          <div
            key={col.id}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(col.id);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain");
              if (id) onMover(id, col.id);
              setOver(null);
            }}
            className="min-h-[260px] w-[82vw] shrink-0 rounded-[14px] p-2.5 min-[820px]:w-[290px]"
            style={{
              background: hot ? "#E8F3EF" : "#F4F3EF",
              border: `1px solid ${hot ? "#0B7461" : "transparent"}`,
            }}
          >
            <div className="mb-2.5 flex items-center gap-2 px-1 text-[13px]">
              <span className="h-2 w-2 rounded-full" style={{ background: col.dot }} />
              <strong className="font-semibold">{col.label}</strong>
              <span className="text-[12px] text-[var(--text-3)]">{items.length}</span>
              <span className="flex-1" />
              {col.hint ? <span className="text-[11.5px] text-[var(--text-3)]">{col.hint}</span> : null}
            </div>
            {items.map((t) => (
              <div
                key={t.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                onClick={() => onAbrir(t.id)}
                className={cn("mb-2 cursor-grab rounded-[11px] border border-border bg-white px-3 py-2.5", t.hecha && "opacity-55")}
              >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    aria-label="Hecha"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggle(t.id);
                    }}
                    className="mt-0.5 h-[17px] w-[17px] shrink-0 rounded-[5px] border-[1.5px]"
                    style={{
                      borderColor: t.hecha ? "#0B7461" : "#CFCBC2",
                      background: t.hecha ? "#0B7461" : "#fff",
                    }}
                  />
                  <div className={cn("flex-1 text-[13.5px] font-medium leading-snug", t.hecha && "line-through")}>{t.titulo}</div>
                </div>
                {t.link ? (
                  <div className="ml-[25px] mt-2 w-fit rounded-md bg-accent-soft px-1.5 py-0.5 text-[11.5px] text-accent">{t.link}</div>
                ) : null}
                <div className="ml-[25px] mt-2 flex items-center gap-2">
                  <span
                    className="rounded-md px-1.5 py-0.5 font-mono text-[11.5px] font-medium tabular-nums"
                    style={{
                      color: t.hecha ? "#8A938F" : t.vencida ? "#A33B2A" : t.venceLabel === "Hoy" ? "#7A5A10" : "#5D6B67",
                      background: t.hecha ? "#F4F3EF" : t.vencida ? "#FBEAE5" : t.venceLabel === "Hoy" ? "#FBF0D8" : "#F4F3EF",
                    }}
                  >
                    {t.venceLabel}
                  </span>
                  {t.hora ? (
                    <span className="inline-flex items-center gap-1 text-[11.5px] text-[var(--text-2)]">
                      <CalendarDays size={12} />
                      {t.hora.slice(0, 5)}
                    </span>
                  ) : null}
                  <span className="flex-1" />
                  <AvatarComercial nombre={t.comercial.nombre} color={t.comercial.color} size={22} />
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div className="rounded-[10px] border border-dashed border-[var(--input)] px-2.5 py-4 text-center text-[12.5px] text-[var(--text-3)]">
                Suelta aquí
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
