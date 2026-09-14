"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
  /** En móvil ocupa toda la pantalla. En desktop mantiene max-h parcial. */
  fullScreenOnMobile?: boolean;
  /** Mostrar botón X para cerrar en la esquina superior. */
  showCloseButton?: boolean;
  /** Estudio a pantalla completa, sheet inferior o panel lateral. */
  variant?: "sheet" | "studio" | "side";
  /** Solo aplica a `variant="side"`. */
  side?: "left" | "right";
  /** Encima de otro sheet (peek de ficha desde una tarea, etc.). */
  elevated?: boolean;
}

export function Sheet({
  open,
  onOpenChange,
  children,
  className,
  fullScreenOnMobile = false,
  showCloseButton = false,
  variant = "sheet",
  side = "right",
  elevated = false,
}: SheetProps) {
  const overflowRef = React.useRef<string>("");
  const toqueInicio = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!open) return;
    overflowRef.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    const onKey = (evento: KeyboardEvent) => {
      if (evento.key !== "Escape") return;
      if (elevated) evento.stopImmediatePropagation();
      onOpenChange(false);
    };
    window.addEventListener("keydown", onKey, elevated);
    return () => {
      document.body.style.overflow = overflowRef.current || "";
      document.body.style.touchAction = "";
      window.removeEventListener("keydown", onKey, elevated);
    };
  }, [open, onOpenChange, elevated]);

  if (!open) return null;

  const cerrar = (
    <button
      type="button"
      onClick={() => onOpenChange(false)}
      className="absolute right-4 top-[max(0.75rem,env(safe-area-inset-top))] z-10 flex h-10 w-10 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-foreground"
      aria-label="Cerrar"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </svg>
    </button>
  );

  const content = (
      <div className={cn("fixed inset-0", elevated ? "z-[10050]" : "z-[9999]")}>
      <button
        type="button"
        className="absolute inset-0 bg-black/40 transition-opacity duration-300"
        onClick={() => onOpenChange(false)}
        aria-label="Cerrar"
      />
      {variant === "studio" ? (
        <div className={cn("absolute inset-0 z-10 flex flex-col bg-[#f3f1ed] pb-[env(safe-area-inset-bottom)]", className)}>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden pt-[env(safe-area-inset-top)]">
            {children}
          </div>
        </div>
      ) : variant === "side" ? (
        <div
          role="dialog"
          aria-modal="true"
          className={cn(
            "absolute inset-y-0 z-10 flex w-full flex-col bg-white pb-[env(safe-area-inset-bottom)] min-[780px]:w-[min(28rem,92vw)]",
            side === "left"
              ? "left-0 shadow-[16px_0_40px_rgba(19,28,26,.16)] animate-[slideInFromLeft_0.28s_ease-out]"
              : "right-0 shadow-[-16px_0_40px_rgba(19,28,26,.16)] animate-[slideInFromRight_0.28s_ease-out]",
            className
          )}
          onTouchStart={(evento) => {
            toqueInicio.current = evento.changedTouches[0]?.clientX ?? null;
          }}
          onTouchEnd={(evento) => {
            const inicio = toqueInicio.current;
            const fin = evento.changedTouches[0]?.clientX ?? 0;
            toqueInicio.current = null;
            if (inicio == null) return;
            const delta = fin - inicio;
            if (side === "left" ? delta < -56 : delta > 56) onOpenChange(false);
          }}
        >
          {showCloseButton ? cerrar : null}
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </div>
      ) : (
      <div className="absolute bottom-0 left-0 right-0 z-10 flex justify-center">
        <div
          className={cn(
            "flex w-full flex-col overflow-hidden border-t border-border bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)]",
            "animate-[sheetUp_0.3s_ease-out]",
            "pb-[env(safe-area-inset-bottom)]",
            fullScreenOnMobile
              ? "h-[100dvh] max-h-[100dvh] rounded-none md:max-h-[96dvh] md:w-[70vw] md:max-w-[900px] md:rounded-t-2xl"
              : "max-h-[85dvh] rounded-t-2xl",
            className
          )}
        >
        <div className="relative flex shrink-0 items-center justify-center pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
          {showCloseButton ? cerrar : null}
          <div className={cn("h-1 w-12 shrink-0 rounded-full bg-neutral-200", showCloseButton && "invisible")} aria-hidden />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </div>
      </div>
      )}
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(content, document.body)
    : content;
}
