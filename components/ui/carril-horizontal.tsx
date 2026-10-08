"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Fila que se desplaza en horizontal y marca, con una flecha, que aún hay elementos a la derecha. */
export function CarrilHorizontal({
  children,
  className,
  trackClassName,
  label,
  role,
  scrollDePagina = false,
}: {
  children: ReactNode;
  className?: string;
  trackClassName?: string;
  label?: string;
  role?: string;
  /** El carril es alto (un tablero). El gesto vertical mueve la página. */
  scrollDePagina?: boolean;
}) {
  const pista = useRef<HTMLDivElement>(null);
  const contenido = useRef<HTMLDivElement>(null);
  const [mas, setMas] = useState(false);

  useEffect(() => {
    const caja = pista.current;
    const interior = contenido.current;
    if (!caja) return;
    const medir = () => {
      setMas(caja.scrollWidth - caja.clientWidth - caja.scrollLeft > 12);
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(caja);
    if (interior) obs.observe(interior);
    caja.addEventListener("scroll", medir, { passive: true });
    return () => {
      obs.disconnect();
      caja.removeEventListener("scroll", medir);
    };
  }, []);

  useEffect(() => {
    const caja = pista.current;
    if (!caja || !scrollDePagina) return;

    const pixeles = (delta: number, modo: number) => {
      if (modo === 1) return delta * 16;
      if (modo === 2) return delta * window.innerHeight;
      return delta;
    };

    const onWheel = (evento: WheelEvent) => {
      if (evento.shiftKey || Math.abs(evento.deltaY) <= Math.abs(evento.deltaX)) return;
      if (caja.scrollHeight > caja.clientHeight + 1) return;
      evento.preventDefault();
      window.scrollBy(0, pixeles(evento.deltaY, evento.deltaMode));
    };

    let inicio: { x: number; y: number; top: number } | null = null;
    let eje: "pendiente" | "x" | "y" = "pendiente";

    const onStart = (evento: TouchEvent) => {
      if (evento.touches.length !== 1) {
        inicio = null;
        return;
      }
      const toque = evento.touches[0];
      inicio = { x: toque.clientX, y: toque.clientY, top: window.scrollY };
      eje = "pendiente";
    };

    const onMove = (evento: TouchEvent) => {
      if (!inicio || evento.touches.length !== 1) return;
      const toque = evento.touches[0];
      const dx = toque.clientX - inicio.x;
      const dy = toque.clientY - inicio.y;
      if (eje === "pendiente") {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        eje = Math.abs(dy) > Math.abs(dx) ? "y" : "x";
      }
      if (eje !== "y" || caja.scrollHeight > caja.clientHeight + 1) return;
      if (evento.cancelable) evento.preventDefault();
      window.scrollTo(0, inicio.top - dy);
    };

    const onEnd = () => {
      inicio = null;
      eje = "pendiente";
    };

    caja.addEventListener("wheel", onWheel, { passive: false });
    caja.addEventListener("touchstart", onStart, { passive: true });
    caja.addEventListener("touchmove", onMove, { passive: false });
    caja.addEventListener("touchend", onEnd);
    caja.addEventListener("touchcancel", onEnd);
    return () => {
      caja.removeEventListener("wheel", onWheel);
      caja.removeEventListener("touchstart", onStart);
      caja.removeEventListener("touchmove", onMove);
      caja.removeEventListener("touchend", onEnd);
      caja.removeEventListener("touchcancel", onEnd);
    };
  }, [scrollDePagina]);

  const avanzar = () => {
    const caja = pista.current;
    if (!caja) return;
    const paso = Math.max(120, Math.round(caja.clientWidth * 0.7));
    caja.scrollBy({ left: paso, behavior: "smooth" });
  };

  return (
    <div className={cn("relative min-w-0 max-w-full", className)} data-carril>
      <div
        ref={pista}
        role={role}
        aria-label={label}
        className={cn(
          "overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          scrollDePagina ? "overscroll-y-auto" : "overscroll-y-none"
        )}
        style={
          mas
            ? {
                WebkitMaskImage: "linear-gradient(to right, #000 0, #000 calc(100% - 2.25rem), transparent 100%)",
                maskImage: "linear-gradient(to right, #000 0, #000 calc(100% - 2.25rem), transparent 100%)",
              }
            : undefined
        }
      >
        <div ref={contenido} className={cn("flex w-max min-w-full", trackClassName)}>
          {children}
        </div>
      </div>
      {mas ? (
        <button
          type="button"
          onClick={avanzar}
          aria-label="Ver más a la derecha"
          className="absolute inset-y-0 right-0 z-[1] flex w-9 items-center justify-end pr-0.5 text-[var(--text-2)] hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2.2} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
