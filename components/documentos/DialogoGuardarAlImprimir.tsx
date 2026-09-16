"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PrintOverlay } from "@/components/documentos/PrintOverlay";

export function esDispositivoMovil(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

export function DialogoGuardarAlImprimir({
  open,
  onOpenChange,
  loading,
  preparando,
  onSi,
  onNo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading?: boolean;
  preparando?: boolean;
  onSi: () => void | Promise<void>;
  onNo: () => void | Promise<void>;
}) {
  if (!open) return null;

  const bloqueado = loading || preparando;

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 p-4"
      onClick={() => {
        if (!bloqueado) onOpenChange(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialogo-imprimir-titulo"
        className="w-full max-w-sm rounded-2xl border border-border bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-medium text-foreground" id="dialogo-imprimir-titulo">
          ¿Quieres guardar también el documento en el histórico?
        </p>
        {preparando ? (
          <p className="mt-2 text-[13px] text-[var(--text-2)]">Preparando el documento para imprimir…</p>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" disabled={bloqueado} onClick={() => void onNo()}>
            No
          </Button>
          <Button type="button" disabled={bloqueado} onClick={() => void onSi()}>
            {loading ? "Guardando…" : "Sí"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function useImprimirDocumento(
  html: string,
  guardar: (opts?: { quedarse?: boolean }) => Promise<boolean>,
  opts?: { prepararHtml?: (html: string) => Promise<string> }
) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preparando, setPreparando] = useState(false);
  const [htmlImpresion, setHtmlImpresion] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const prepararHtmlRef = useRef(opts?.prepararHtml);
  const htmlListoRef = useRef<string | null>(null);
  const preparacionRef = useRef<Promise<string> | null>(null);
  prepararHtmlRef.current = opts?.prepararHtml;

  useEffect(() => {
    setMounted(true);
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const preparar = prepararHtmlRef.current;
    htmlListoRef.current = null;
    if (!preparar) {
      setPreparando(false);
      preparacionRef.current = null;
      return;
    }

    let cancelado = false;
    setPreparando(true);

    const promesa = preparar(html)
      .then((preparado) => {
        if (!cancelado) htmlListoRef.current = preparado;
        return preparado;
      })
      .catch((err) => {
        if (!cancelado) {
          htmlListoRef.current = null;
          toast.error("No se ha podido preparar el documento para imprimir.");
        }
        throw err;
      })
      .finally(() => {
        if (!cancelado) setPreparando(false);
        preparacionRef.current = null;
      });

    preparacionRef.current = promesa;

    return () => {
      cancelado = true;
    };
  }, [html]);

  const resolverHtmlImpresion = async (): Promise<string> => {
    const preparar = prepararHtmlRef.current;
    if (!preparar) return html;
    if (htmlListoRef.current) return htmlListoRef.current;
    if (preparacionRef.current) return preparacionRef.current;
    const preparado = await preparar(html);
    htmlListoRef.current = preparado;
    return preparado;
  };

  const lanzarImpresion = async () => {
    try {
      const finalHtml = await resolverHtmlImpresion();
      if (!finalHtml.trim()) throw new Error("El documento está vacío.");
      setHtmlImpresion(finalHtml);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se ha podido imprimir.");
    }
  };

  const ui = (
    <>
      <DialogoGuardarAlImprimir
        open={open}
        loading={busy}
        preparando={Boolean(prepararHtmlRef.current && preparando)}
        onOpenChange={setOpen}
        onNo={() => {
          setOpen(false);
          void lanzarImpresion();
        }}
        onSi={async () => {
          setBusy(true);
          const ok = await guardar({ quedarse: true });
          setBusy(false);
          if (!ok) return;
          setOpen(false);
          await lanzarImpresion();
        }}
      />
      {htmlImpresion ? <PrintOverlay html={htmlImpresion} onClose={() => setHtmlImpresion(null)} /> : null}
    </>
  );

  return {
    preparando,
    pedirImprimir: () => setOpen(true),
    dialogo: mounted ? createPortal(ui, document.body) : null,
  };
}
