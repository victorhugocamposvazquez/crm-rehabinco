"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

export function Sheet({ open, onOpenChange, children, className }: SheetProps) {
  React.useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40 transition-opacity duration-300"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 z-10 flex max-h-[85dvh] flex-col rounded-t-2xl border-t border-border bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)]",
          "animate-[sheetUp_0.3s_ease-out]",
          "pb-[env(safe-area-inset-bottom)]",
          className
        )}
      >
        <div className="mx-auto mt-3 h-1 w-12 shrink-0 rounded-full bg-neutral-200" aria-hidden />
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
