"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

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
 * de las miniaturas, así que el orden sigue el puntero.
 */
export function useReordenarPuntero(onSoltar: (desde: number, hasta: number) => void) {
  const listaRef = useRef<HTMLUListElement>(null);
  const soltarRef = useRef(onSoltar);
  soltarRef.current = onSoltar;
  const gesto = useRef<{ desde: number; x: number; y: number; activo: boolean } | null>(null);
  const arrastre = useRef(false);
  const hastaRef = useRef<number | null>(null);
  const [desde, setDesde] = useState<number | null>(null);
  const [hasta, setHasta] = useState<number | null>(null);

  const alBajar = (idx: number) => (evento: ReactPointerEvent<HTMLElement>) => {
    if (evento.button !== 0) return;
    if ((evento.target as HTMLElement).closest("button")) return;
    gesto.current = { desde: idx, x: evento.clientX, y: evento.clientY, activo: false };
    evento.currentTarget.setPointerCapture(evento.pointerId);
  };

  const alMover = (evento: ReactPointerEvent<HTMLElement>) => {
    const actual = gesto.current;
    if (!actual) return;
    const dx = evento.clientX - actual.x;
    const dy = evento.clientY - actual.y;
    if (!actual.activo && dx * dx + dy * dy < 64) return;
    if (!actual.activo) setDesde(actual.desde);
    actual.activo = true;
    const lista = listaRef.current;
    if (!lista) return;
    const idx = indiceBajoPuntero(lista, evento.clientX, evento.clientY);
    if (idx != null && idx !== hastaRef.current) {
      hastaRef.current = idx;
      setHasta(idx);
    }
  };

  const alLevantar = (evento: ReactPointerEvent<HTMLElement>) => {
    const actual = gesto.current;
    gesto.current = null;
    if (actual?.activo) arrastre.current = true;
    if (actual?.activo && listaRef.current) {
      const idx = indiceBajoPuntero(listaRef.current, evento.clientX, evento.clientY);
      if (idx != null && idx !== actual.desde) soltarRef.current(actual.desde, idx);
    }
    hastaRef.current = null;
    setDesde(null);
    setHasta(null);
  };

  const fueArrastre = () => {
    if (!arrastre.current) return false;
    arrastre.current = false;
    return true;
  };

  return { listaRef, desde, hasta, alBajar, alMover, alLevantar, fueArrastre };
}
