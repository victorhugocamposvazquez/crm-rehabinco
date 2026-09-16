"use client";

import { useState } from "react";
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
  guardar: (opts?: { quedarse?: boolean }) => Promise<boolean>
) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const lanzarImpresion = async () => {
    try {
      await imprimirDocumentoHtml(html);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se ha podido imprimir.");
    }
  };

  return {
    pedirImprimir: () => setOpen(true),
    dialogo: (
      <DialogoGuardarAlImprimir
        open={open}
        loading={busy}
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
