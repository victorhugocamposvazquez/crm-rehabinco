"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DOCUMENTO_PAGE_H, DOCUMENTO_PAGE_W } from "@/lib/documentos-pdf";

export function DocumentoSplit({
  form,
  preview,
}: {
  form: ReactNode;
  preview: ReactNode;
}) {
  return (
    <div className="grid items-start gap-5 min-[820px]:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="min-w-0 space-y-4 pb-28 min-[820px]:pb-0">{form}</div>
      <div className="min-w-0 min-[820px]:sticky min-[820px]:top-4">{preview}</div>
    </div>
  );
}

export function PdfFrame({
  html,
  pages,
  onDownload,
  downloading,
}: {
  html: string;
  pages: number;
  onDownload: () => void | Promise<void>;
  downloading?: boolean;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.52);

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const sync = () => setScale(Math.min(1, (el.clientWidth - 24) / DOCUMENTO_PAGE_W));
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <section className="overflow-hidden rounded-[14px] border border-border bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border-soft)] px-4 py-3">
        <div>
          <h2 className="text-[15px] font-semibold">Previsualización</h2>
          <p className="text-[12px] text-[var(--text-2)]">El PDF se actualiza al rellenar los campos.</p>
        </div>
        <Button type="button" size="sm" onClick={() => void onDownload()} disabled={downloading} className="gap-2">
          <Download className="h-4 w-4" strokeWidth={1.5} />
          {downloading ? "Generando…" : "Descargar PDF"}
        </Button>
      </div>
      <div ref={caja} className="overflow-auto bg-[#d9d6cf] p-3 min-[820px]:max-h-[calc(100dvh-9.5rem)]">
        <div style={{ height: DOCUMENTO_PAGE_H * pages * scale, width: "100%" }}>
          <iframe
            title="Previsualización del PDF"
            srcDoc={html}
            style={{
              width: DOCUMENTO_PAGE_W,
              height: DOCUMENTO_PAGE_H * pages,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              border: 0,
              background: "#fff",
            }}
          />
        </div>
      </div>
    </section>
  );
}
