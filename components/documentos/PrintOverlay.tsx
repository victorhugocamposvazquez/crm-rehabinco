"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { esDispositivoMovil } from "@/components/documentos/DialogoGuardarAlImprimir";

export function PrintOverlay({ html, onClose }: { html: string; onClose: () => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [listo, setListo] = useState(false);
  const [mounted, setMounted] = useState(false);

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
    setListo(false);
    const iframe = iframeRef.current;
    if (!iframe) return;

    const marcarListo = () => setListo(true);
    iframe.addEventListener("load", marcarListo, { once: true });
    iframe.srcdoc = html;
    const fallback = window.setTimeout(marcarListo, 500);

    return () => window.clearTimeout(fallback);
  }, [html]);

  const imprimir = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
  }, []);

  useEffect(() => {
    if (!listo || esDispositivoMovil()) return;
    const timer = window.setTimeout(imprimir, 400);
    return () => window.clearTimeout(timer);
  }, [listo, imprimir]);

  useEffect(() => {
    if (!listo) return;
    const cerrar = () => onClose();
    const win = iframeRef.current?.contentWindow;
    win?.addEventListener("afterprint", cerrar);
    window.addEventListener("afterprint", cerrar);
    return () => {
      win?.removeEventListener("afterprint", cerrar);
      window.removeEventListener("afterprint", cerrar);
    };
  }, [listo, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col bg-white" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <h2 className="text-[15px] font-semibold">Vista de impresión</h2>
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
    </div>,
    document.body
  );
}
