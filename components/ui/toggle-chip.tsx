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
        "flex h-8 items-center rounded-full border px-2.5 text-[12.5px] font-medium",
        on ? "border-accent bg-accent-soft text-accent-dark" : "border-[var(--border)] bg-white text-[var(--text-2)]"
      )}
    >
      {children}
    </button>
  );
}
