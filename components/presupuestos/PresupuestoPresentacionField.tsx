"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { fileToAdjunto } from "@/lib/presupuesto-adjuntos";
import type { DensidadTabla, PropuestaPresupuesto, VariantePortada } from "@/lib/presupuesto-propuesta";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function PresupuestoPresentacionField({
  propuesta,
  onChange,
}: {
  propuesta: PropuestaPresupuesto;
  onChange: (next: PropuestaPresupuesto) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const setDensidad = (densidad_tabla: DensidadTabla) => onChange({ ...propuesta, densidad_tabla });
  const setVariante = (variante_portada: VariantePortada) => onChange({ ...propuesta, variante_portada });

  const onPick = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const foto = await fileToAdjunto(file);
      onChange({ ...propuesta, foto_portada: foto, variante_portada: propuesta.variante_portada === "auto" ? "foto" : propuesta.variante_portada });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo usar la foto de portada");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-border p-4">
      <div>
        <p className="text-sm font-medium">Presentación del PDF</p>
        <p className="mt-1 text-xs text-neutral-500">
          Ajustes de la plantilla, no un lienzo libre. El layout de páginas no cambia.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Portada</Label>
        <div className="flex rounded-lg border border-border p-1">
          {(
            [
              ["auto", "Automática"],
              ["foto", "Foto"],
              ["rejilla", "Rejilla"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setVariante(id)}
              className={
                propuesta.variante_portada === id
                  ? "flex-1 rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background"
                  : "flex-1 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
              }
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-neutral-500">
          Automática usa Riazor o la cabecera del cliente. Foto pone tu imagen. Rejilla fuerza el fondo técnico.
        </p>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Foto de portada</Label>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="h-3.5 w-3.5" strokeWidth={1.5} />
            {busy ? "Añadiendo…" : propuesta.foto_portada ? "Cambiar" : "Añadir"}
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => void onPick(e.target.files)}
        />
        {propuesta.foto_portada ? (
          <div className="overflow-hidden rounded-lg border border-border">
            <img src={propuesta.foto_portada.dataUrl} alt={propuesta.foto_portada.nombre} className="h-28 w-full object-cover" />
            <div className="flex items-center justify-between gap-2 px-2 py-1.5">
              <span className="truncate text-xs text-neutral-600">{propuesta.foto_portada.nombre}</span>
              <button
                type="button"
                className="text-neutral-500 hover:text-red-600"
                aria-label="Quitar foto de portada"
                onClick={() => onChange({ ...propuesta, foto_portada: null })}
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-neutral-500">JPG, PNG o WEBP. Opcional.</p>
        )}
      </div>
      {propuesta.tipo !== "ampliacion" && (
      <div className="space-y-2">
        <Label>Densidad de la tabla de partidas</Label>
        <div className="flex rounded-lg border border-border p-1">
          {(
            [
              ["normal", "Normal"],
              ["compacta", "Compacta"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setDensidad(id)}
              className={
                propuesta.densidad_tabla === id
                  ? "flex-1 rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background"
                  : "flex-1 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
              }
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-neutral-500">Compacta cabe más partidas por hoja; Normal deja más aire, como el ejemplo Riazor.</p>
      </div>
      )}
    </div>
  );
}
