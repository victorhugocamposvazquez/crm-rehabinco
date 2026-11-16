"use client";

import { useState } from "react";
import { toast } from "sonner";
import { comoMedia, delCajon, fotosAnuncio } from "@/lib/inmuebles/archivo";
import type { InmuebleMedia } from "@/lib/inmuebles/catalogo";
import { PLANTILLAS_PUBLICACION, plantillaPublicacion } from "@/lib/inmuebles/publicacion-plantilla";
import { quitarArchivoMedia } from "@/lib/inmuebles/promover-retoque";
import { cn } from "@/lib/utils";

function descargarBase64(base64: string, nombre: string) {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}

async function descargarUrl(url: string, nombre: string) {
  try {
    const respuesta = await fetch(url);
    if (!respuesta.ok) throw new Error("descarga");
    const blob = await respuesta.blob();
    const local = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = local;
    enlace.download = nombre;
    enlace.click();
    URL.revokeObjectURL(local);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export function CajonPublicaciones({
  propiedadId,
  media,
  onChange,
}: {
  propiedadId: string;
  media: InmuebleMedia[];
  onChange: (next: InmuebleMedia[]) => void;
}) {
  const fotos = [...fotosAnuncio(media), ...delCajon(media, "retocada")];
  const publicaciones = delCajon(media, "publicacion");
  const [fotoId, setFotoId] = useState(fotos[0]?.id ?? "");
  const [ocupada, setOcupada] = useState<string | null>(null);
  const elegida = fotos.find((f) => f.id === fotoId) ?? fotos[0] ?? null;

  const crear = async (plantilla: string) => {
    if (!elegida) return;
    setOcupada(plantilla);
    try {
      const respuesta = await fetch("/api/inmuebles/media/publicacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propiedadId, mediaId: elegida.id, plantilla }),
      });
      const cuerpo = (await respuesta.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        media?: InmuebleMedia;
        nombre?: string;
        pngBase64?: string;
      } | null;
      if (!respuesta.ok || !cuerpo?.ok || !cuerpo.media || !cuerpo.pngBase64) {
        toast.error(cuerpo?.error || "No se ha podido crear la publicación.");
        return;
      }
      onChange([...media, comoMedia(cuerpo.media)]);
      descargarBase64(cuerpo.pngBase64, cuerpo.nombre || "publicacion.png");
      toast.success("Publicación descargada y guardada en el piso.");
    } finally {
      setOcupada(null);
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-[13px] leading-5 text-[var(--text-2)]">
        Elige una foto y una plantilla. Se descarga un PNG con el precio, el municipio y los datos del piso. Queda guardado aquí y no sale en la web ni en Idealista.
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
                    elegida?.id === foto.id ? "border-accent ring-2 ring-accent/30" : "border-[var(--border)]"
                  )}
                >
                  <img src={foto.url} alt="" className="aspect-[4/3] w-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            {PLANTILLAS_PUBLICACION.map((plantilla) => (
              <button
                key={plantilla.id}
                type="button"
                disabled={ocupada != null}
                onClick={() => void crear(plantilla.id)}
                className="h-9 rounded-[10px] bg-accent px-3 text-[13px] font-semibold text-accent-foreground disabled:opacity-45"
              >
                {ocupada === plantilla.id ? "Creando…" : `${plantilla.etiqueta} · ${plantilla.ancho}×${plantilla.alto}`}
              </button>
            ))}
          </div>
        </>
      )}

      <div>
        <h4 className="mb-2 text-[13px] font-medium text-[var(--text-3)]">Publicaciones ({publicaciones.length})</h4>
        {publicaciones.length === 0 ? (
          <p className="text-[13px] text-[var(--text-2)]">Todavía no hay publicaciones.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {publicaciones.map((item) => {
              const plantilla = plantillaPublicacion(item.retoque || "");
              return (
                <li key={item.id} className="overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface-soft)]">
                  <img src={item.url} alt="" className="aspect-[4/3] w-full object-cover" />
                  <div className="flex flex-wrap gap-1 p-2">
                    <button
                      type="button"
                      className="h-8 rounded-[8px] border border-[var(--input)] bg-white px-2 text-[12px] font-semibold"
                      onClick={() => void descargarUrl(item.url, `${plantilla?.archivo || "publicacion"}.png`)}
                    >
                      Descargar
                    </button>
                    <button type="button" className="h-8 rounded-[8px] px-2 text-[12px] font-semibold text-red-700" onClick={() => void quitarArchivoMedia(item, media).then(onChange)}>
                      Quitar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
