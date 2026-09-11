"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ImagePlus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { InmuebleMedia } from "@/lib/inmuebles/catalogo";

export function InmuebleGaleria({
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const fotos = media.filter((m) => m.tipo === "foto").sort((a, b) => a.orden - b.orden);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const supabase = createClient();
    const next = [...media];
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} no es una imagen.`);
          continue;
        }
        if (file.size > 8_000_000) {
          toast.error(`${file.name} supera 8 MB.`);
          continue;
        }
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${propiedadId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("inmuebles").upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });
        if (upErr) {
          toast.error(upErr.message);
          continue;
        }
        const { data: pub } = supabase.storage.from("inmuebles").getPublicUrl(path);
        const portada = next.filter((m) => m.tipo === "foto").length === 0;
        const { data, error } = await supabase
          .from("inmueble_media")
          .insert({
            propiedad_id: propiedadId,
            user_id: userId,
            tipo: "foto",
            path,
            url: pub.publicUrl,
            orden: next.length,
            portada,
          })
          .select("id, propiedad_id, tipo, path, url, orden, portada")
          .single();
        if (error || !data) {
          toast.error(error?.message ?? "No se pudo guardar la foto.");
          continue;
        }
        next.push(data as InmuebleMedia);
      }
      onChange(next);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const setPortada = async (id: string) => {
    const supabase = createClient();
    await supabase.from("inmueble_media").update({ portada: false }).eq("propiedad_id", propiedadId);
    await supabase.from("inmueble_media").update({ portada: true }).eq("id", id);
    onChange(media.map((m) => ({ ...m, portada: m.id === id })));
  };

  const remove = async (item: InmuebleMedia) => {
    const supabase = createClient();
    await supabase.from("inmueble_media").delete().eq("id", item.id);
    await supabase.storage.from("inmuebles").remove([item.path]);
    onChange(media.filter((m) => m.id !== item.id));
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-neutral-500">{fotos.length} foto{fotos.length === 1 ? "" : "s"}</p>
        <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => inputRef.current?.click()}>
          <ImagePlus className="mr-1.5 h-4 w-4" strokeWidth={1.5} />
          {busy ? "Subiendo…" : "Añadir fotos"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => void upload(e.target.files)}
        />
      </div>
      {fotos.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-white px-6 py-12 text-sm text-neutral-500 hover:bg-neutral-50"
        >
          Suelta fotos o pulsa para subir. La primera será la portada.
        </button>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {fotos.map((f) => (
            <li key={f.id} className="group relative overflow-hidden rounded-xl bg-neutral-100">
              <img src={f.url} alt="" className="aspect-[4/3] w-full object-cover" />
              {f.portada && (
                <span className="absolute left-2 top-2 rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                  Portada
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/50 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                {!f.portada && (
                  <button
                    type="button"
                    onClick={() => void setPortada(f.id)}
                    className="rounded-full bg-white/90 p-1.5 text-neutral-800"
                    aria-label="Marcar portada"
                  >
                    <Star className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void remove(f)}
                  className="rounded-full bg-white/90 p-1.5 text-red-700"
                  aria-label="Quitar foto"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
