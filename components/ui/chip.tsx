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
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium",
        active
          ? "border-accent bg-accent-soft text-accent-dark"
          : "border-border bg-white text-[var(--text-2)] hover:border-accent hover:text-accent",
        className
      )}
    >
      {children}
      {count != null && <span className="opacity-60">{count}</span>}
    </button>
  );
}
