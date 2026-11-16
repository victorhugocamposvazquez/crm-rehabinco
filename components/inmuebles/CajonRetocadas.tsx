"use client";

import { useState } from "react";
import { toast } from "sonner";
import { fotosAnuncio, delCajon, comoMedia } from "@/lib/inmuebles/archivo";
import type { InmuebleMedia } from "@/lib/inmuebles/catalogo";
import { quitarArchivoMedia, usarRetoqueEnAnuncio } from "@/lib/inmuebles/promover-retoque";
import { PRESETS_RETOQUE, etiquetaRetoque } from "@/lib/inmuebles/retoque-presets";
import { cn } from "@/lib/utils";

export function CajonRetocadas({
  propiedadId,
  userId,
  media,
  onChange,
}: {
  propiedadId: string;
  userId: string;
  media: InmuebleMedia[];
  onChange: (next: InmuebleMedia[]) => void;
}) {
  const fotos = fotosAnuncio(media);
  const retocadas = delCajon(media, "retocada");
  const [fotoId, setFotoId] = useState(fotos[0]?.id ?? "");
  const [preset, setPreset] = useState<string | null>(null);
  const [comparar, setComparar] = useState<string | null>(null);
  const elegida = fotos.find((f) => f.id === fotoId) ?? fotos[0] ?? null;
  const comparada = retocadas.find((f) => f.id === comparar) ?? null;
  const original = comparada ? media.find((m) => m.id === comparada.origen_id) ?? null : null;

  const retocar = async (presetId: string) => {
    if (!elegida) return;
    setPreset(presetId);
    try {
      const respuesta = await fetch("/api/inmuebles/media/retoque", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propiedadId, mediaId: elegida.id, preset: presetId }),
      });
      const cuerpo = (await respuesta.json().catch(() => null)) as { ok?: boolean; error?: string; media?: InmuebleMedia } | null;
      if (!respuesta.ok || !cuerpo?.ok || !cuerpo.media) {
        toast.error(cuerpo?.error || "No se ha podido retocar la foto.");
        return;
      }
      onChange([...media, comoMedia(cuerpo.media)]);
      toast.success("Retoque guardado. La foto original sigue igual.");
    } finally {
      setPreset(null);
    }
  };

  const usar = async (item: InmuebleMedia) => {
    setPreset(item.id);
    try {
      const { media: next, error } = await usarRetoqueEnAnuncio({ propiedadId, userId, retoque: item, media });
      if (error) {
        toast.error(error);
        return;
      }
      onChange(next);
      toast.success("La foto ya está en el anuncio.");
    } finally {
      setPreset(null);
    }
  };

  const quitar = async (item: InmuebleMedia) => {
    onChange(await quitarArchivoMedia(item, media));
  };

  return (
    <div className="space-y-5">
      <p className="text-[13px] leading-5 text-[var(--text-2)]">
        Elige una foto del anuncio y un retoque. Más luz y Enderezar los hace el CRM, sin coste. Quitar trastos, el cielo y amueblar usan la IA. Se guarda una copia. La original no se sustituye y no sale en la web ni en Idealista hasta que pulses Usar en el anuncio.
      </p>
      {fotos.length === 0 ? (
        <p className="rounded-[12px] border border-dashed border-[var(--input)] px-4 py-8 text-center text-[13px] text-[var(--text-2)]">
          Primero sube fotos en el cajón Fotos.
        </p>
      ) : (
        <>
          <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {fotos.map((foto) => (
              <li key={foto.id}>
                <button
                  type="button"
                  onClick={() => setFotoId(foto.id)}
                  className={cn(
                    "block w-full overflow-hidden rounded-[10px] border",
                    (elegida?.id === foto.id) ? "border-accent ring-2 ring-accent/30" : "border-[var(--border)]"
                  )}
                >
                  <img src={foto.url} alt="" className="aspect-[4/3] w-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
          {elegida ? <img src={elegida.url} alt="" className="max-h-80 w-full rounded-[12px] object-contain bg-[var(--surface-soft)]" /> : null}
          <div className="flex flex-wrap gap-2">
            {PRESETS_RETOQUE.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={preset != null}
                onClick={() => void retocar(item.id)}
                title={item.motor === "crm" ? "Lo hace el CRM, sin coste" : "Usa la IA de imagen"}
                className="h-9 rounded-[10px] bg-accent px-3 text-[13px] font-semibold text-accent-foreground disabled:opacity-45"
              >
                {preset === item.id ? "Retocando…" : item.etiqueta}
              </button>
            ))}
          </div>
        </>
      )}

      <div>
        <h4 className="mb-2 text-[13px] font-medium text-[var(--text-3)]">Retocadas ({retocadas.length})</h4>
        {retocadas.length === 0 ? (
          <p className="text-[13px] text-[var(--text-2)]">Todavía no hay retoques.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {retocadas.map((item) => (
              <li key={item.id} className="overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface-soft)]">
                <img src={item.url} alt="" className="aspect-[4/3] w-full object-cover" />
                <div className="space-y-2 p-2">
                  <p className="text-[12px] font-semibold">{etiquetaRetoque(item.retoque)}</p>
                  <div className="flex flex-wrap gap-1">
                    <button type="button" className="h-8 rounded-[8px] border border-[var(--input)] bg-white px-2 text-[12px] font-semibold" onClick={() => setComparar(item.id)}>
                      Antes y después
                    </button>
                    <button type="button" disabled={preset != null} className="h-8 rounded-[8px] bg-accent px-2 text-[12px] font-semibold text-accent-foreground disabled:opacity-45" onClick={() => void usar(item)}>
                      Usar en el anuncio
                    </button>
                    <button type="button" className="h-8 rounded-[8px] px-2 text-[12px] font-semibold text-red-700" onClick={() => void quitar(item)}>
                      Quitar
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {comparada ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setComparar(null)} role="dialog" aria-modal="true" aria-label="Antes y después">
          <div className="grid w-full max-w-5xl gap-3 sm:grid-cols-2" onClick={(e) => e.stopPropagation()}>
            <figure>
              <img src={original?.url || comparada.url} alt="" className="max-h-[70vh] w-full object-contain" />
              <figcaption className="mt-2 text-center text-[13px] text-white">{original ? "Antes" : "La original ya no está"}</figcaption>
            </figure>
            <figure>
              <img src={comparada.url} alt="" className="max-h-[70vh] w-full object-contain" />
              <figcaption className="mt-2 text-center text-[13px] text-white">Después</figcaption>
            </figure>
          </div>
        </div>
      ) : null}
    </div>
  );
}
