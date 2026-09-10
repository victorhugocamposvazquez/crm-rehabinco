"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { fileToAdjunto, puedeAnadirAdjuntos } from "@/lib/presupuesto-adjuntos";
import type { AdjuntoPresupuesto } from "@/lib/presupuesto-propuesta";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function GaralAdjuntosField({
  adjuntos,
  onChange,
}: {
  adjuntos: AdjuntoPresupuesto[];
  onChange: (next: AdjuntoPresupuesto[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onPick = async (files: FileList | null) => {
    if (!files?.length) return;
    if (!puedeAnadirAdjuntos(adjuntos.length)) {
      toast.error("Máximo 8 imágenes.");
      return;
    }
    setBusy(true);
    try {
      const next = [...adjuntos];
      for (const file of Array.from(files)) {
        if (!puedeAnadirAdjuntos(next.length)) break;
        next.push(await fileToAdjunto(file));
      }
      onChange(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo añadir el adjunto");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label>Anexos (fotos)</Label>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1"
          disabled={busy || !puedeAnadirAdjuntos(adjuntos.length)}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus className="h-3.5 w-3.5" strokeWidth={1.5} />
          {busy ? "Añadiendo…" : "Añadir foto"}
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => void onPick(e.target.files)}
      />
      <p className="text-xs text-neutral-500">
        Salen en el PDF como hojas de anexo, debajo de las mediciones. JPG, PNG o WEBP. Hasta 8.
      </p>
      {adjuntos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {adjuntos.map((a) => (
            <div key={a.id} className="overflow-hidden rounded-lg border border-border bg-white">
              <img src={a.dataUrl} alt={a.nombre} className="h-28 w-full object-cover" />
              <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                <span className="truncate text-xs text-neutral-600">{a.nombre}</span>
                <button
                  type="button"
                  className="shrink-0 text-neutral-500 hover:text-red-600"
                  aria-label={`Quitar ${a.nombre}`}
                  onClick={() => onChange(adjuntos.filter((x) => x.id !== a.id))}
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
