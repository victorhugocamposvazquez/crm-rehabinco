"use client";

import { useCallback, useEffect, useRef } from "react";

type Props = {
  fotos: string[];
  indice: number;
  onIndice: (i: number) => void;
  onCerrar: () => void;
  titulo?: string;
};

export function GaleriaLightbox({ fotos, indice, onIndice, onCerrar, titulo }: Props) {
  const touchX = useRef<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const n = fotos.length;
  const actual = ((indice % n) + n) % n;

  const ir = useCallback(
    (delta: number) => {
      if (n <= 1) return;
      onIndice((actual + delta + n) % n);
    },
    [actual, n, onIndice]
  );

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const root = dialogRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const closeBtn = root?.querySelector<HTMLElement>("button[aria-label='Cerrar galería']");
    closeBtn?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
      if (e.key === "ArrowLeft") ir(-1);
      if (e.key === "ArrowRight") ir(1);
      if (e.key === "Tab" && root) {
        const focusables = Array.from(
          root.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")
        ).filter((el) => !el.hasAttribute("disabled"));
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [ir, onCerrar]);

  if (!n || !fotos[actual]) return null;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[60] flex flex-col bg-[rgba(8,8,8,.94)]"
      role="dialog"
      aria-modal="true"
      aria-label={titulo ? `Fotos de ${titulo}` : "Galería de fotos"}
      onClick={onCerrar}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 text-[#fefefe]" onClick={(e) => e.stopPropagation()}>
        <p className="min-w-0 truncate text-[14px] text-[#b0b0b0]">{titulo ?? "Fotos"}</p>
        <p className="shrink-0 tabular-nums text-[14px] font-medium">
          {actual + 1} / {n}
        </p>
        <button
          type="button"
          aria-label="Cerrar galería"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[28px] leading-none text-[#fefefe] hover:bg-white/10"
          onClick={onCerrar}
        >
          ×
        </button>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4 sm:px-12"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          touchX.current = e.changedTouches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchX.current;
          touchX.current = null;
          const end = e.changedTouches[0]?.clientX;
          if (start == null || end == null) return;
          const d = end - start;
          if (Math.abs(d) < 48) return;
          ir(d < 0 ? 1 : -1);
        }}
      >
        {n > 1 ? (
          <>
            <button
              type="button"
              aria-label="Foto anterior"
              className="absolute left-2 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-[#fefefe] text-[#080808] sm:grid"
              onClick={() => ir(-1)}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Foto siguiente"
              className="absolute right-2 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-[#fefefe] text-[#080808] sm:grid"
              onClick={() => ir(1)}
            >
              ›
            </button>
          </>
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={fotos[actual]}
          src={fotos[actual]}
          alt=""
          className="max-h-full max-w-full rounded-[14px] object-contain"
          draggable={false}
        />
      </div>

      {n > 1 ? (
        <div
          className="mx-auto flex w-full max-w-[920px] shrink-0 gap-2 overflow-x-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1"
          onClick={(e) => e.stopPropagation()}
        >
          {fotos.map((foto, i) => (
            <button
              key={foto + i}
              type="button"
              aria-label={`Ir a foto ${i + 1}`}
              aria-current={i === actual}
              className={`h-14 w-20 shrink-0 overflow-hidden rounded-[10px] border-2 ${
                i === actual ? "border-[#fefefe]" : "border-transparent opacity-55 hover:opacity-90"
              }`}
              onClick={() => onIndice(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={foto} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
