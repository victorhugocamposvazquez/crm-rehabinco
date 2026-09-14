"use client";

import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type KanbanColumna<C extends string> = {
  id: C;
  label: string;
  dot: string;
};

export function Kanban<C extends string, T extends { id: string }>({
  columns,
  items,
  colOf,
  onMove,
  onSelect,
  selectedId,
  renderCard,
}: {
  columns: KanbanColumna<C>[];
  items: T[];
  colOf: (item: T) => C;
  onMove: (id: string, col: C) => void;
  onSelect?: (item: T) => void;
  selectedId?: string | null;
  renderCard: (item: T) => ReactNode;
}) {
  const [over, setOver] = useState<C | null>(null);
  const draggingRef = useRef(false);

  return (
    <div className="flex items-start gap-3 overflow-x-auto pb-2.5">
      {columns.map((col) => {
        const filas = items.filter((item) => colOf(item) === col.id);
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
              if (id) onMove(id, col.id);
              setOver(null);
            }}
            className="min-h-[260px] w-[82vw] shrink-0 rounded-[14px] p-2.5 min-[820px]:w-[260px]"
            style={{
              background: hot ? "#E8F3EF" : "#F4F3EF",
              border: `1px solid ${hot ? "#0B7461" : "transparent"}`,
            }}
          >
            <div className="mb-2.5 flex items-center gap-2 px-1 text-[13px]">
              <span className="h-2 w-2 rounded-full" style={{ background: col.dot }} />
              <strong className="font-semibold">{col.label}</strong>
              <span className="text-[12px] text-[var(--text-3)]">{filas.length}</span>
            </div>
            {filas.map((item) => {
              const selected = selectedId === item.id;
              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => {
                    draggingRef.current = true;
                    e.dataTransfer.setData("text/plain", item.id);
                  }}
                  onDragEnd={() => {
                    window.setTimeout(() => {
                      draggingRef.current = false;
                    }, 0);
                  }}
                  onClick={() => {
                    if (draggingRef.current) {
                      draggingRef.current = false;
                      return;
                    }
                    onSelect?.(item);
                  }}
                  className={cn("mb-2 cursor-grab", selected && "[&>*]:border-accent")}
                >
                  {renderCard(item)}
                </div>
              );
            })}
            {filas.length === 0 ? (
              <div className="rounded-[10px] border border-dashed border-[var(--input)] px-2.5 py-4 text-center text-[12.5px] text-[var(--text-3)]">
                Suelta aquí
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function KanbanCard({
  href,
  onClick,
  title,
  meta,
  tag,
  children,
  className,
}: {
  href?: string;
  onClick?: () => void;
  title: string;
  meta?: string;
  tag?: string;
  children?: ReactNode;
  className?: string;
}) {
  const inner = (
    <>
      <p className="text-[13.5px] font-medium leading-snug">{title}</p>
      {meta ? <p className="mt-1 truncate font-mono text-[11.5px] text-[var(--text-3)]">{meta}</p> : null}
      {tag ? <p className="mt-1.5 text-[12px] text-accent">{tag}</p> : null}
      {children}
    </>
  );
  const cls = cn("block rounded-[11px] border border-border bg-white px-3 py-2.5 hover:border-accent", className);
  if (onClick) {
    return (
      <button
        type="button"
        draggable={false}
        className={cn(cls, "w-full text-left")}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        {inner}
      </button>
    );
  }
  if (href) {
    return (
      <a href={href} draggable={false} className={cls} onClick={(e) => e.stopPropagation()}>
        {inner}
      </a>
    );
  }
  return <div className={cls}>{inner}</div>;
}
