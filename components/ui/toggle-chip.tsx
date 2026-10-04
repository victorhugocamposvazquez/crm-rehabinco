"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ToggleChip({
  on,
  children,
  onClick,
}: {
  on: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-9 items-center rounded-full border px-3 text-[13px] font-medium",
        on ? "border-foreground bg-accent-soft text-foreground" : "border-[var(--border)] bg-[var(--field)] text-[var(--text-2)]"
      )}
    >
      {children}
    </button>
  );
}
