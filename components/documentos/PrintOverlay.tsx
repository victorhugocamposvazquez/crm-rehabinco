"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { esDispositivoMovil } from "@/components/documentos/DialogoGuardarAlImprimir";
import { DOCUMENTO_PAGE_W, imprimirDocumentoHtml } from "@/lib/documentos-pdf";
import { esperarLayoutDocumento } from "@/lib/documentos-paginacion";

async function cargarHtmlEnIframe(iframe: HTMLIFrameElement, html: string): Promise<number> {
  const idoc = iframe.contentDocument;
  if (!idoc) throw new Error("No se pudo cargar la vista previa.");

  idoc.open();
  idoc.write(html);
  idoc.close();
  await esperarLayoutDocumento(idoc);

  return Math.max(idoc.body.scrollHeight, idoc.documentElement.scrollHeight, DOCUMENTO_PAGE_W);
}

export function PrintOverlay({ html, onClose }: { html: string; onClose: () => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const cajaRef = useRef<HTMLDivElement>(null);
  const [listo, setListo] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [alto, setAlto] = useState(DOCUMENTO_PAGE_W);
  const [scale, setScale] = useState(1);
  const [mounted, setMounted] = useState(false);
  const movil = esDispositivoMovil();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;

    let cancelado = false;
    setCargando(true);
    setListo(false);

    const iframe = iframeRef.current;
    if (!iframe) return;

    void cargarHtmlEnIframe(iframe, html)
      .then((h) => {
        if (cancelado) return;
        setAlto(h);
        setListo(true);
        setCargando(false);
      })
      .catch((err) => {
        if (cancelado) return;
        setCargando(false);
        toast.error(err instanceof Error ? err.message : "No se pudo cargar la vista previa.");
      });

    return () => {
      cancelado = true;
    };
  }, [html, mounted]);

  useEffect(() => {
    const caja = cajaRef.current;
    if (!mounted || !caja) return;

    const sync = () => {
      setScale(Math.min(1, Math.max(0.2, (caja.clientWidth - 8) / DOCUMENTO_PAGE_W)));
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(caja);
    return () => ro.disconnect();
  }, [mounted, listo]);

  const imprimir = useCallback(() => {
    if (movil) {
      void imprimirDocumentoHtml(html)
        .then(onClose)
        .catch((err) => toast.error(err instanceof Error ? err.message : "No se ha podido imprimir."));
      return;
    }

    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
  }, [html, movil, onClose]);

  useEffect(() => {
    if (!listo || movil) return;
    const timer = window.setTimeout(imprimir, 400);
    return () => window.clearTimeout(timer);
  }, [listo, movil, imprimir]);

  useEffect(() => {
    if (!listo || movil) return;
    const cerrar = () => onClose();
    const win = iframeRef.current?.contentWindow;
    win?.addEventListener("afterprint", cerrar);
    window.addEventListener("afterprint", cerrar);
    return () => {
      win?.removeEventListener("afterprint", cerrar);
      window.removeEventListener("afterprint", cerrar);
    };
  }, [listo, movil, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col bg-white" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div>
          <h2 className="text-[15px] font-semibold">Vista de impresión</h2>
          {movil ? (
            <p className="text-[12px] text-[var(--text-2)]">Pulsa Imprimir para abrir el diálogo del sistema.</p>
          ) : null}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar">
          <X className="h-5 w-5" strokeWidth={1.75} />
        </Button>
      </div>

      <div ref={cajaRef} className="relative min-h-0 flex-1 overflow-auto bg-[#d9d6cf] p-2">
        {cargando ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[#d9d6cf]/80">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-foreground" />
          </div>
        ) : null}
        <div style={{ height: alto * scale, width: "100%", visibility: listo ? "visible" : "hidden" }}>
          <iframe
            ref={iframeRef}
            title="Documento para imprimir"
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

      <div className="flex gap-2 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button type="button" className="flex-1 gap-2" onClick={imprimir} disabled={!listo || cargando}>
          <Printer className="h-4 w-4" strokeWidth={1.75} />
          Imprimir
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </div>,
    document.body
  );
}
