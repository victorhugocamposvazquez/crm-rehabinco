"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { comoMedia, delCajon, fotosAnuncio } from "@/lib/inmuebles/archivo";
import type { InmuebleMedia } from "@/lib/inmuebles/catalogo";
import { guardarPlantillaRedes, leerPlantillaRedes } from "@/lib/inmuebles/plantilla-redes";
import {
  CAMPOS_PUBLICACION,
  PLANTILLAS_PUBLICACION,
  piezasPublicacion,
  plantillaPublicacion,
  plantillaRedesPorDefecto,
  type CampoPublicacionId,
  type EstiloPublicacion,
  type FichaParaPublicacion,
  type PlantillaRedes,
} from "@/lib/inmuebles/publicacion-plantilla";
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

function Lienzo({
  fotoUrl,
  plantilla,
  piezas,
}: {
  fotoUrl: string | null;
  plantilla: PlantillaRedes;
  piezas: Record<CampoPublicacionId, string>;
}) {
  const formato = plantillaPublicacion(plantilla.formato) ?? PLANTILLAS_PUBLICACION[0];
  const activos = plantilla.campos.map((campo) => piezas[campo]).filter(Boolean);
  const precio = plantilla.campos.includes("precio") ? piezas.precio : "";
  const resto = activos.filter((linea) => linea !== precio);
  return (
    <div
      className="relative mx-auto w-full overflow-hidden rounded-[16px] bg-neutral-200"
      style={{ aspectRatio: `${formato.ancho} / ${formato.alto}`, maxHeight: 560 }}
    >
      {fotoUrl ? <img src={fotoUrl} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
      {plantilla.estilo === "ficha" ? (
        <div className="absolute bottom-4 left-4 max-w-[70%] rounded-2xl bg-white/95 px-4 py-3 text-neutral-900 shadow-sm">
          {precio ? <p className="text-2xl font-bold leading-tight">{precio}</p> : null}
          {resto.map((linea) => (
            <p key={linea} className="mt-1 text-sm font-medium">
              {linea}
            </p>
          ))}
        </div>
      ) : (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-4 pb-4 pt-16 text-white">
          {precio ? <p className="text-2xl font-bold leading-tight">{precio}</p> : null}
          {resto.length ? <p className="mt-1 text-sm">{resto.join(" · ")}</p> : null}
        </div>
      )}
    </div>
  );
}

export function CajonPublicaciones({
  propiedadId,
  media,
  ficha,
  onChange,
}: {
  propiedadId: string;
  media: InmuebleMedia[];
  ficha?: FichaParaPublicacion;
  onChange: (next: InmuebleMedia[]) => void;
}) {
  const fotos = [...fotosAnuncio(media), ...delCajon(media, "retocada")];
  const publicaciones = delCajon(media, "publicacion");
  const [fotoId, setFotoId] = useState(fotos[0]?.id ?? "");
  const [plantilla, setPlantilla] = useState<PlantillaRedes>(plantillaRedesPorDefecto);
  const [ocupada, setOcupada] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const elegida = fotos.find((f) => f.id === fotoId) ?? fotos[0] ?? null;
  const piezas = piezasPublicacion(ficha ?? {});

  useEffect(() => {
    let vivo = true;
    void leerPlantillaRedes().then((guardada) => {
      if (vivo) setPlantilla(guardada);
    });
    return () => {
      vivo = false;
    };
  }, [propiedadId]);

  const alternarCampo = (campo: CampoPublicacionId) => {
    setPlantilla((actual) => {
      const campos = actual.campos.includes(campo) ? actual.campos.filter((item) => item !== campo) : [...actual.campos, campo];
      return { ...actual, campos };
    });
  };

  const establecer = async () => {
    setGuardando(true);
    const error = await guardarPlantillaRedes(plantilla);
    setGuardando(false);
    if (error) {
      toast.error("La plantilla se ha quedado en este navegador. No se ha podido guardar para todo el equipo.");
      return;
    }
    toast.success("Plantilla establecida. En el siguiente piso entrarán sus datos.");
  };

  const crear = async () => {
    if (!elegida) return;
    setOcupada(true);
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
      toast.success("Creatividad descargada y guardada en el piso.");
    } finally {
      setOcupada(false);
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-[13px] leading-5 text-[var(--text-2)]">
        Monta la creatividad encima de la foto. El precio, los metros y las habitaciones salen de la ficha del piso. Establece la plantilla para reutilizarla en el siguiente.
      </p>
      <Lienzo fotoUrl={elegida?.url ?? null} plantilla={plantilla} piezas={piezas} />
      <div className="flex flex-wrap gap-2">
        {PLANTILLAS_PUBLICACION.map((formato) => (
          <button
            key={formato.id}
            type="button"
            onClick={() => setPlantilla((actual) => ({ ...actual, formato: formato.id }))}
            className={cn(
              "h-9 rounded-[10px] px-3 text-[13px] font-semibold",
              plantilla.formato === formato.id ? "bg-accent text-accent-foreground" : "border border-[var(--input)] bg-white"
            )}
          >
            {formato.etiqueta}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["barra", "Banda inferior"],
            ["ficha", "Ficha blanca"],
          ] as const
        ).map(([estilo, etiqueta]) => (
          <button
            key={estilo}
            type="button"
            onClick={() => setPlantilla((actual) => ({ ...actual, estilo: estilo as EstiloPublicacion }))}
            className={cn(
              "h-9 rounded-[10px] px-3 text-[13px] font-semibold",
              plantilla.estilo === estilo ? "bg-neutral-900 text-white" : "border border-[var(--input)] bg-white"
            )}
          >
            {etiqueta}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {CAMPOS_PUBLICACION.map((campo) => {
          const activo = plantilla.campos.includes(campo.id);
          return (
            <button
              key={campo.id}
              type="button"
              onClick={() => alternarCampo(campo.id)}
              className={cn(
                "h-9 rounded-full px-3 text-[13px] font-semibold",
                activo ? "bg-accent text-accent-foreground" : "border border-[var(--input)] bg-white text-[var(--text-2)]"
              )}
            >
              {campo.etiqueta}: {piezas[campo.id] || "sin dato"}
            </button>
          );
        })}
      </div>
      {fotos.length === 0 ? (
        <p className="rounded-[12px] border border-dashed border-[var(--input)] px-4 py-8 text-center text-[13px] text-[var(--text-2)]">
          Primero sube fotos en el cajón Fotos.
        </p>
      ) : (
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
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={guardando}
          onClick={() => void establecer()}
          className="h-10 rounded-[10px] border border-[var(--input)] bg-white px-3.5 text-[13px] font-semibold disabled:opacity-45"
        >
          {guardando ? "Guardando…" : "Establecer plantilla"}
        </button>
        <button
          type="button"
          disabled={ocupada || !elegida}
          onClick={() => void crear()}
          className="h-10 rounded-[10px] bg-accent px-3.5 text-[13px] font-semibold text-accent-foreground disabled:opacity-45"
        >
          {ocupada ? "Creando…" : "Descargar creatividad"}
        </button>
      </div>

      <div>
        <h4 className="mb-2 text-[13px] font-medium text-[var(--text-3)]">Ya creadas ({publicaciones.length})</h4>
        {publicaciones.length === 0 ? (
          <p className="text-[13px] text-[var(--text-2)]">Todavía no hay creatividades de este piso.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {publicaciones.map((item) => {
              const formato = plantillaPublicacion(item.retoque || "");
              return (
                <li key={item.id} className="overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface-soft)]">
                  <img src={item.url} alt="" className="aspect-[4/3] w-full object-cover" />
                  <div className="flex flex-wrap gap-1 p-2">
                    <button
                      type="button"
                      className="h-8 rounded-[8px] border border-[var(--input)] bg-white px-2 text-[12px] font-semibold"
                      onClick={() => void descargarUrl(item.url, `${formato?.archivo || "publicacion"}.png`)}
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
