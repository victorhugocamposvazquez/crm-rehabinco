"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Creative } from "@/components/estudio/templates";
import { fitBox, FORMATS, TEMPLATES, type TemplateId } from "@/lib/estudio/config";
import type { InmuebleEstudio } from "@/lib/estudio/data";
import { buildSlideData, slideLabel, type Publication } from "@/lib/estudio/publicacion";

const tplName = (id: TemplateId) => TEMPLATES.find((item) => item.id === id)?.nombre ?? "Diseño";

export function VistaRevision({ inm, pub }: { inm: InmuebleEstudio; pub: Publication }) {
  const marco = useRef<HTMLDivElement>(null);
  const origen = useRef<{ x: number; y: number } | null>(null);
  const [indice, setIndice] = useState(0);
  const [tam, setTam] = useState<[number, number]>([280, 350]);
  const total = pub.slides.length;
  const actual = Math.min(indice, total - 1);
  const slide = pub.slides[actual];
  const formato = FORMATS[pub.format];
  const ir = (siguiente: number) => setIndice(Math.max(0, Math.min(total - 1, siguiente)));

  useLayoutEffect(() => {
    const el = marco.current;
    if (!el) return;
    const medir = () => {
      const ancho = el.clientWidth;
      const alto = el.clientHeight;
      if (ancho < 40 || alto < 40) return;
      setTam(fitBox(pub.format, ancho, alto));
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [pub.format]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={marco}
        className="flex min-h-0 flex-1 items-center justify-center"
        onPointerDown={(evento) => {
          origen.current = { x: evento.clientX, y: evento.clientY };
          evento.currentTarget.setPointerCapture(evento.pointerId);
        }}
        onPointerUp={(evento) => {
          if (!origen.current) return;
          const dx = evento.clientX - origen.current.x;
          const dy = evento.clientY - origen.current.y;
          origen.current = null;
          if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
          ir(dx < 0 ? actual + 1 : actual - 1);
        }}
        onPointerCancel={() => {
          origen.current = null;
        }}
      >
        <div className="overflow-hidden rounded-[20px] shadow-[0_10px_30px_rgba(0,0,0,.12)]">
          <Creative template={slide.template} data={buildSlideData(inm, pub, slide)} width={tam[0]} height={tam[1]} />
        </div>
      </div>
      {total > 1 ? (
        <div className="flex shrink-0 items-center justify-center" role="tablist" aria-label="Pantallas">
          {pub.slides.map((item, i) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={i === actual}
              aria-label={`Pantalla ${i + 1}`}
              onClick={() => ir(i)}
              className="grid h-11 w-8 place-items-center"
            >
              <span
                className={
                  i === actual
                    ? "h-2 w-5 rounded-full bg-[var(--foreground)]"
                    : "h-2 w-2 rounded-full bg-[var(--text-3)]"
                }
              />
            </button>
          ))}
        </div>
      ) : (
        <div className="h-2 shrink-0" />
      )}
      <p className="shrink-0 pb-1 text-center text-[13px] text-[var(--text-2)]">
        {actual + 1} de {total} · {slideLabel(inm, slide, tplName)} · {formato.label}
      </p>
    </div>
  );
}
