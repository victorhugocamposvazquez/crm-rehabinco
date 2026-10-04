"use client";

import { useEffect, useRef, useState } from "react";

const UMBRAL = 68;

export function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [listo, setListo] = useState(false);
  const inicio = useRef<{ x: number; y: number } | null>(null);
  const modo = useRef<"pendiente" | "tiron" | "no">("no");
  const pullRef = useRef(0);

  useEffect(() => {
    if (!window.matchMedia("(max-width: 819px)").matches) return;

    const ignora = (target: EventTarget | null) => {
      if (document.body.style.overflow === "hidden") return true;
      const el = target as HTMLElement | null;
      if (!el?.closest) return true;
      if (el.closest("input, textarea, select, [contenteditable='true'], [role='dialog']")) return true;
      let nodo: HTMLElement | null = el;
      while (nodo && nodo !== document.body) {
        const eje = getComputedStyle(nodo).overflowY;
        if ((eje === "auto" || eje === "scroll") && nodo.scrollTop > 0) return true;
        nodo = nodo.parentElement;
      }
      return window.scrollY > 2;
    };

    const start = (evento: TouchEvent) => {
      if (evento.touches.length !== 1 || ignora(evento.target)) {
        inicio.current = null;
        modo.current = "no";
        return;
      }
      inicio.current = { x: evento.touches[0].clientX, y: evento.touches[0].clientY };
      modo.current = "pendiente";
    };

    const move = (evento: TouchEvent) => {
      if (!inicio.current || modo.current === "no") return;
      const dx = evento.touches[0].clientX - inicio.current.x;
      const dy = evento.touches[0].clientY - inicio.current.y;
      if (modo.current === "pendiente") {
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
          modo.current = "no";
          return;
        }
        if (dy < 8) return;
        modo.current = "tiron";
      }
      if (modo.current !== "tiron") return;
      if (evento.cancelable) evento.preventDefault();
      const distancia = Math.min(dy * 0.55, 96);
      pullRef.current = distancia;
      setPull(distancia);
      setListo(distancia >= UMBRAL);
    };

    const end = () => {
      if (modo.current === "tiron" && pullRef.current >= UMBRAL) {
        window.location.reload();
        return;
      }
      inicio.current = null;
      modo.current = "no";
      pullRef.current = 0;
      setPull(0);
      setListo(false);
    };

    window.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", end);
    window.addEventListener("touchcancel", end);
    return () => {
      window.removeEventListener("touchstart", start);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", end);
      window.removeEventListener("touchcancel", end);
    };
  }, []);

  if (pull < 8) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-14 z-50 flex justify-center">
      <span className="caja-flotante mt-1 rounded-full px-3 py-1 text-[12px] font-medium text-[var(--text-2)]">
        {listo ? "Suelta para actualizar" : "Tira para actualizar"}
      </span>
    </div>
  );
}
