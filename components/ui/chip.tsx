import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Chip({
  active,
  onClick,
  children,
  count,
  className,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  count?: number | string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[12.5px] font-medium",
        active
          ? "border-accent bg-accent-soft text-accent-dark"
          : "border-border bg-[var(--field)] text-[var(--text-2)] hover:border-foreground hover:text-foreground",
        className
      )}
    >
      {children}
      {count != null && <span className="opacity-60">{count}</span>}
    </button>
  );
}
