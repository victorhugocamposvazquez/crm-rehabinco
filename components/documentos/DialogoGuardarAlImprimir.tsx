"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { imprimirDocumentoHtml } from "@/lib/documentos-pdf";

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
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
  const [htmlPreparado, setHtmlPreparado] = useState<string | null>(null);
  const [preparando, setPreparando] = useState(false);
  const prepararHtmlRef = useRef(opts?.prepararHtml);
  const htmlPreparadoRef = useRef<string | null>(null);
  const preparacionRef = useRef<Promise<string> | null>(null);
  prepararHtmlRef.current = opts?.prepararHtml;
  htmlPreparadoRef.current = htmlPreparado;

  useEffect(() => {
    const preparar = prepararHtmlRef.current;
    if (!preparar) {
      setHtmlPreparado(null);
      setPreparando(false);
      preparacionRef.current = null;
      return;
    }

    let cancelado = false;
    setPreparando(true);
    setHtmlPreparado(null);

    const promesa = preparar(html)
      .then((preparado) => {
        if (!cancelado) {
          setHtmlPreparado(preparado);
          htmlPreparadoRef.current = preparado;
        }
        return preparado;
      })
      .catch((err) => {
        if (!cancelado) {
          setHtmlPreparado(null);
          htmlPreparadoRef.current = null;
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
    if (htmlPreparadoRef.current) return htmlPreparadoRef.current;
    if (preparacionRef.current) return preparacionRef.current;
    return preparar(html);
  };

  const lanzarImpresion = async () => {
    try {
      const finalHtml = await resolverHtmlImpresion();
      if (!finalHtml.trim()) throw new Error("El documento está vacío.");
      await imprimirDocumentoHtml(finalHtml);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se ha podido imprimir.");
    }
  };

  return {
    preparando,
    pedirImprimir: () => setOpen(true),
    dialogo: (
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
    ),
  };
}
