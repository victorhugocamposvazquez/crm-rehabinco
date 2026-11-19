"use client";

import { Creative } from "@/components/estudio/templates";
import { fitBox, FORMATS, TEMPLATES, type TemplateId } from "@/lib/estudio/config";
import type { InmuebleEstudio } from "@/lib/estudio/data";
import { buildSlideData, slideLabel, type Publication } from "@/lib/estudio/publicacion";

const tplName = (id: TemplateId) => TEMPLATES.find((item) => item.id === id)?.nombre ?? "Diseño";

export function VistaRevision({ inm, pub }: { inm: InmuebleEstudio; pub: Publication }) {
  const [w, h] = fitBox(pub.format, 340, 460);
  const formato = FORMATS[pub.format];
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {pub.slides.map((slide, i) => (
        <figure key={slide.id} className="shrink-0">
          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--pdf-desk)] p-3">
            <Creative template={slide.template} data={buildSlideData(inm, pub, slide)} width={w} height={h} />
          </div>
          <figcaption className="mt-2 text-[13px] text-[var(--text-2)]">
            {i + 1}. {slideLabel(inm, slide, tplName)} · {formato.label} {formato.ratio}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
