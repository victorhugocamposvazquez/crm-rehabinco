"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";

function esDispositivoMovil(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

export function PrintOverlay({ html, onClose }: { html: string; onClose: () => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [listo, setListo] = useState(false);
  const movil = esDispositivoMovil();

  useEffect(() => {
    setListo(false);
    const iframe = iframeRef.current;
    if (!iframe) return;

    const marcarListo = () => setListo(true);
    iframe.addEventListener("load", marcarListo, { once: true });
    iframe.srcdoc = html;
    const fallback = window.setTimeout(marcarListo, 400);

    return () => window.clearTimeout(fallback);
  }, [html]);

  const imprimir = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
  }, []);

  useEffect(() => {
    if (!listo || movil) return;
    const timer = window.setTimeout(imprimir, 300);
    return () => window.clearTimeout(timer);
  }, [listo, movil, imprimir]);

  useEffect(() => {
    if (!listo) return;
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const cerrar = () => onClose();
    win.addEventListener("afterprint", cerrar);
    return () => win.removeEventListener("afterprint", cerrar);
  }, [listo, onClose]);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-white">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
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
      <iframe ref={iframeRef} title="Documento para imprimir" className="min-h-0 flex-1 w-full border-0 bg-white" />
      <div className="flex gap-2 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button type="button" className="flex-1 gap-2" onClick={imprimir}>
          <Printer className="h-4 w-4" strokeWidth={1.75} />
          Imprimir
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </div>
  );
}
