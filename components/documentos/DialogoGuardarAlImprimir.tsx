"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { imprimirDocumentoHtml } from "@/lib/documentos-pdf";

export function DialogoGuardarAlImprimir({
  open,
  onOpenChange,
  loading,
  onSi,
  onNo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading?: boolean;
  onSi: () => void | Promise<void>;
  onNo: () => void | Promise<void>;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => {
        if (!loading) onOpenChange(false);
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
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" disabled={loading} onClick={() => void onNo()}>
            No
          </Button>
          <Button type="button" disabled={loading} onClick={() => void onSi()}>
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
  const [htmlPreparado, setHtmlPreparado] = useState<string | null>(null);
  const [preparando, setPreparando] = useState(false);
  const prepararHtmlRef = useRef(opts?.prepararHtml);
  prepararHtmlRef.current = opts?.prepararHtml;

  useEffect(() => {
    const preparar = prepararHtmlRef.current;
    if (!preparar) {
      setHtmlPreparado(null);
      setPreparando(false);
      return;
    }

    let cancelado = false;
    setPreparando(true);
    setHtmlPreparado(null);

    const timer = window.setTimeout(() => {
      void preparar(html)
        .then((preparado) => {
          if (!cancelado) setHtmlPreparado(preparado);
        })
        .catch(() => {
          if (!cancelado) setHtmlPreparado(null);
        })
        .finally(() => {
          if (!cancelado) setPreparando(false);
        });
    }, 200);

    return () => {
      cancelado = true;
      window.clearTimeout(timer);
    };
  }, [html]);

  const lanzarImpresion = async (ventanaImpresion?: Window | null) => {
    try {
      let finalHtml = html;
      const preparar = prepararHtmlRef.current;
      if (preparar) {
        finalHtml = htmlPreparado ?? (await preparar(html));
      }
      await imprimirDocumentoHtml(finalHtml, ventanaImpresion);
    } catch (err) {
      ventanaImpresion?.close();
      toast.error(err instanceof Error ? err.message : "No se ha podido imprimir.");
    }
  };

  const abrirVentanaImpresion = () =>
    typeof window !== "undefined" ? window.open("", "_blank", "noopener,noreferrer") : null;

  return {
    preparando,
    pedirImprimir: () => {
      if (prepararHtmlRef.current && preparando) {
        toast.info("Preparando el documento para imprimir…");
        return;
      }
      setOpen(true);
    },
    dialogo: (
      <DialogoGuardarAlImprimir
        open={open}
        loading={busy}
        onOpenChange={setOpen}
        onNo={() => {
          const ventana = abrirVentanaImpresion();
          setOpen(false);
          void lanzarImpresion(ventana);
        }}
        onSi={async () => {
          const ventana = abrirVentanaImpresion();
          setBusy(true);
          const ok = await guardar({ quedarse: true });
          setBusy(false);
          if (!ok) {
            ventana?.close();
            return;
          }
          setOpen(false);
          await lanzarImpresion(ventana);
        }}
      />
    ),
  };
}
