"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const SUGERIDOS = ["Cliente cancela", "Reprogramar", "No contesta", "Error de agenda", "Otro"] as const;

export function DialogoAnularCita({
  open,
  onOpenChange,
  onConfirmar,
  loading = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmar: (motivo: string) => void | Promise<void>;
  loading?: boolean;
}) {
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    if (open) setMotivo("");
  }, [open]);

  if (!open) return null;

  const texto = motivo.trim();
  const listo = texto.length >= 2;

  return (
    <div
      className="velo-flotante fixed inset-0 z-[120] flex items-center justify-center p-4"
      onClick={() => {
        if (!loading) onOpenChange(false);
      }}
    >
      <div
        className="caja-flotante w-full max-w-sm rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-medium text-foreground">Anular entrada</p>
        <p className="mt-2 text-sm text-neutral-500">
          Dejará de aparecer en el calendario. Indica el motivo (obligatorio).
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {SUGERIDOS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={loading}
              onClick={() => setMotivo(s === "Otro" ? "" : s)}
              className="rounded-full border border-[var(--input)] px-2.5 py-1 text-[12px] font-medium text-[var(--text-2)] hover:bg-[var(--surface-soft)]"
            >
              {s}
            </button>
          ))}
        </div>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          disabled={loading}
          placeholder="Motivo de la anulación"
          className="mt-3 w-full resize-none rounded-[10px] border border-[var(--input)] bg-[var(--field)] px-3 py-2.5 text-[14px] outline-none focus:border-accent"
          autoFocus
        />
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            Volver
          </Button>
          <Button
            className="bg-red-600 text-white hover:bg-red-700"
            disabled={!listo || loading}
            onClick={() => void onConfirmar(texto)}
          >
            {loading ? "…" : "Anular"}
          </Button>
        </div>
      </div>
    </div>
  );
}
