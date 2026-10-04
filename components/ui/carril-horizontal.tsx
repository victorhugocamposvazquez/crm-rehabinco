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
}: {
  children: ReactNode;
  className?: string;
  trackClassName?: string;
  label?: string;
  role?: string;
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
        className="overflow-x-auto overflow-y-hidden overscroll-x-contain overscroll-y-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
