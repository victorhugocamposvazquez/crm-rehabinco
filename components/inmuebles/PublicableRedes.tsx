"use client";

import { cn } from "@/lib/utils";

export function PublicableRedes({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (valor: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[10px] border px-3 text-[13.5px] font-semibold",
        checked
          ? "border-foreground bg-[var(--surface-soft)] text-foreground"
          : "border-border bg-[var(--surface)] text-foreground",
        disabled && "cursor-wait opacity-60"
      )}
      onClick={(event) => event.stopPropagation()}
    >
      <input
        type="checkbox"
        className="h-5 w-5 shrink-0 accent-[var(--foreground)]"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      No publicable
    </label>
  );
}
