"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

/** Índice de la miniatura bajo el puntero. En el hueco entre fotos, la más cercana. */
export function indiceBajoPuntero(lista: HTMLElement, x: number, y: number): number | null {
  const items = [...lista.querySelectorAll<HTMLElement>("[data-orden-idx]")];
  if (!items.length) return null;
  for (const item of items) {
    const r = item.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
      return Number(item.dataset.ordenIdx);
    }
  }
  let mejor: { idx: number; dist: number } | null = null;
  for (const item of items) {
    const r = item.getBoundingClientRect();
    const dx = r.left + r.width / 2 - x;
    const dy = r.top + r.height / 2 - y;
    const dist = dx * dx + dy * dy;
    const idx = Number(item.dataset.ordenIdx);
    if (!mejor || dist < mejor.dist) mejor = { idx, dist };
  }
  return mejor?.idx ?? null;
}

/**
 * Reordenar con dedo, trackpad o ratón. El iPad no emite el arrastre HTML
 * de las miniaturas, así que el orden sigue el puntero (listeners en window).
 */
export function useReordenarPuntero(onSoltar: (desde: number, hasta: number) => void) {
  const listaRef = useRef<HTMLUListElement>(null);
  const soltarRef = useRef(onSoltar);
  soltarRef.current = onSoltar;
  const arrastre = useRef(false);
  const hastaRef = useRef<number | null>(null);
  const listenersRef = useRef<{ move: (e: PointerEvent) => void; up: (e: PointerEvent) => void } | null>(null);
  const [desde, setDesde] = useState<number | null>(null);
  const [hasta, setHasta] = useState<number | null>(null);

  const limpiarListeners = () => {
    if (!listenersRef.current) return;
    window.removeEventListener("pointermove", listenersRef.current.move);
    window.removeEventListener("pointerup", listenersRef.current.up);
    window.removeEventListener("pointercancel", listenersRef.current.up);
    listenersRef.current = null;
  };

  useEffect(() => () => limpiarListeners(), []);

  const alBajar = (idx: number) => (evento: ReactPointerEvent<HTMLElement>) => {
    if (evento.button !== 0) return;
    if ((evento.target as HTMLElement).closest("button")) return;

    limpiarListeners();
    const pointerId = evento.pointerId;
    const origen = { x: evento.clientX, y: evento.clientY };
    let activo = false;
    hastaRef.current = null;

    const finalizar = (clientX: number, clientY: number, desdeIdx: number) => {
      if (activo) arrastre.current = true;
      if (activo) {
        const lista = listaRef.current;
        let destino = hastaRef.current;
        if (lista) {
          const bajo = indiceBajoPuntero(lista, clientX, clientY);
          if (bajo != null) destino = bajo;
        }
        if (destino != null && destino !== desdeIdx) soltarRef.current(desdeIdx, destino);
      }
      limpiarListeners();
      hastaRef.current = null;
      setDesde(null);
      setHasta(null);
    };

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const dx = ev.clientX - origen.x;
      const dy = ev.clientY - origen.y;
      if (!activo && dx * dx + dy * dy < 64) return;
      if (!activo) {
        activo = true;
        setDesde(idx);
      }
      const lista = listaRef.current;
      if (!lista) return;
      const i = indiceBajoPuntero(lista, ev.clientX, ev.clientY);
      if (i != null && i !== hastaRef.current) {
        hastaRef.current = i;
        setHasta(i);
      }
    };

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      finalizar(ev.clientX, ev.clientY, idx);
    };

    listenersRef.current = { move: onMove, up: onUp };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const fueArrastre = () => {
    if (!arrastre.current) return false;
    arrastre.current = false;
    return true;
  };

  return { listaRef, desde, hasta, alBajar, fueArrastre };
}
