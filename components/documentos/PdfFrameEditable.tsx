"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Printer, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DOCUMENTO_PAGE_H, DOCUMENTO_PAGE_W } from "@/lib/documentos-pdf";
import {
  esperarLayoutDocumento,
  extraerClausulasDesdeDocumento,
  repaginarContratoArrasEnDocumento,
} from "@/lib/contrato-arras-preview";
import type { ClausulasPersonalizadasArras } from "@/lib/contrato-arras";

export function PdfFrameEditable({
  html,
  onClausulasChange,
  onRestablecerClausulas,
  tienePersonalizadas,
  onDownload,
  downloading,
  onPrint,
}: {
  html: string;
  onClausulasChange: (clausulas: ClausulasPersonalizadasArras) => void;
  onRestablecerClausulas?: () => void;
  tienePersonalizadas?: boolean;
  onDownload: () => void | Promise<void>;
  downloading?: boolean;
  onPrint?: () => void;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const editandoRef = useRef(false);
  const htmlCargadoRef = useRef("");
  const [scale, setScale] = useState(0.52);
  const [alto, setAlto] = useState(DOCUMENTO_PAGE_H * 2);

  const medirAlto = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) return;
    const h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
    if (h > 0) setAlto(h);
  }, []);

  const enlazarEdicion = useCallback(
    (doc: Document) => {
      doc.querySelectorAll<HTMLElement>("[data-clausula]").forEach((el) => {
        el.addEventListener("focus", () => {
          editandoRef.current = true;
        });
        el.addEventListener("blur", () => {
          editandoRef.current = false;
          const clausulas = extraerClausulasDesdeDocumento(doc);
          onClausulasChange(clausulas);
          void (async () => {
            await esperarLayoutDocumento(doc);
            repaginarContratoArrasEnDocumento(doc, { fraccionar: true });
            medirAlto();
          })();
        });
      });
    },
    [medirAlto, onClausulasChange]
  );

  const cargarHtml = useCallback(
    async (docHtml: string) => {
      const iframe = iframeRef.current;
      if (!iframe) return;
      htmlCargadoRef.current = docHtml;
      iframe.srcdoc = docHtml;
    },
    []
  );

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const sync = () => setScale(Math.min(1, (el.clientWidth - 24) / DOCUMENTO_PAGE_W));
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (editandoRef.current) return;
    if (html === htmlCargadoRef.current) return;
    void cargarHtml(html);
  }, [html, cargarHtml]);

  const onLoad = () => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    void (async () => {
      await esperarLayoutDocumento(doc);
      repaginarContratoArrasEnDocumento(doc, { fraccionar: true });
      enlazarEdicion(doc);
      medirAlto();
    })();
  };

  return (
    <section className="overflow-hidden rounded-[14px] border border-border bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border-soft)] px-4 py-3">
        <div>
          <h2 className="text-[15px] font-semibold">Previsualización</h2>
          <p className="text-[12px] text-[var(--text-2)]">
            Haz clic en cualquier párrafo para editarlo. El documento se recompone al vuelo.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {tienePersonalizadas && onRestablecerClausulas ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onRestablecerClausulas}
              className="gap-1.5 text-[var(--text-2)]"
              title="Volver a generar todas las cláusulas desde el formulario"
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
              Restablecer
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="secondary" onClick={() => void onDownload()} disabled={downloading} className="gap-2">
            <Download className="h-4 w-4" strokeWidth={1.5} />
            {downloading ? "Generando…" : "PDF"}
          </Button>
          {onPrint && (
            <Button type="button" size="sm" onClick={onPrint} className="gap-2">
              <Printer className="h-4 w-4" strokeWidth={1.5} />
              Imprimir
            </Button>
          )}
        </div>
      </div>
      <div ref={caja} className="overflow-auto bg-[#d9d6cf] p-3 min-[820px]:max-h-[calc(100dvh-9.5rem)]">
        <div style={{ height: alto * scale, width: "100%" }}>
          <iframe
            ref={iframeRef}
            title="Previsualización del contrato"
            onLoad={onLoad}
            style={{
              width: DOCUMENTO_PAGE_W,
              height: alto,
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
