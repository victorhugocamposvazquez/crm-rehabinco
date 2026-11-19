"use client";

import { useRef, useState } from "react";
import { Creative } from "@/components/estudio/templates";
import { fitBox, FORMATS, TEMPLATES, type TemplateId } from "@/lib/estudio/config";
import type { InmuebleEstudio } from "@/lib/estudio/data";
import { buildSlideData, slideLabel, type Publication } from "@/lib/estudio/publicacion";

const tplName = (id: TemplateId) => TEMPLATES.find((item) => item.id === id)?.nombre ?? "Diseño";

export function VistaRevision({ inm, pub }: { inm: InmuebleEstudio; pub: Publication }) {
  const [indice, setIndice] = useState(0);
  const origen = useRef<{ x: number; y: number } | null>(null);
  const total = pub.slides.length;
  const actual = Math.min(indice, total - 1);
  const slide = pub.slides[actual];
  const [w, h] = fitBox(pub.format, 380, 520);
  const formato = FORMATS[pub.format];
  const ir = (siguiente: number) => setIndice(Math.max(0, Math.min(total - 1, siguiente)));

  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-col items-center">
      <div
        className="w-full touch-pan-y"
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
        <div className="mx-auto w-fit overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--pdf-desk)] p-3">
          <Creative template={slide.template} data={buildSlideData(inm, pub, slide)} width={w} height={h} />
        </div>
      </div>
      {total > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-1.5" role="tablist" aria-label="Pantallas">
          {pub.slides.map((item, i) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={i === actual}
              aria-label={`Pantalla ${i + 1}`}
              onClick={() => ir(i)}
              className={
                i === actual
                  ? "h-1.5 w-4 rounded-full bg-[var(--foreground)]"
                  : "h-1.5 w-1.5 rounded-full bg-[var(--border)]"
              }
            />
          ))}
        </div>
      ) : null}
      <p className="mt-2 text-center text-[13px] text-[var(--text-2)]">
        {actual + 1}/{total} · {slideLabel(inm, slide, tplName)} · {formato.label} {formato.ratio}
      </p>
    </div>
  );
}
