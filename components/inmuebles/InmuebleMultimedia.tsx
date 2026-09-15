"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { altaControl } from "@/components/ui/alta-form";
import { InmuebleGaleria } from "@/components/inmuebles/InmuebleGaleria";
import type { InmuebleMedia } from "@/lib/inmuebles/catalogo";
import { presentacionDeUrl } from "@/lib/inmuebles/media";
import { cn } from "@/lib/utils";

type Pestaña = "fotos" | "planos" | "video" | "tour";

function EmbedMedia({ url, titulo }: { url: string; titulo: string }) {
  const vista = presentacionDeUrl(url);
  if (!vista) return null;
  if (vista.kind === "iframe") {
    return (
      <div className="overflow-hidden rounded-xl bg-neutral-100">
        <iframe
          src={vista.src}
          title={vista.titulo}
          className="aspect-video w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; xr-spatial-tracking"
          allowFullScreen
        />
      </div>
    );
  }
  if (vista.kind === "video") {
    return <video src={vista.src} controls className="w-full rounded-xl bg-black" />;
  }
  return (
    <a href={vista.href} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline">
      {titulo}: abrir enlace
    </a>
  );
}

export function InmuebleMultimedia({
  propiedadId,
  userId,
  media,
  onChange,
  videoUrl,
  tourUrl,
  onUrlsChange,
}: {
  propiedadId: string;
  userId: string;
  media: InmuebleMedia[];
  onChange: (next: InmuebleMedia[]) => void;
  videoUrl: string;
  tourUrl: string;
  onUrlsChange: (patch: { video_url?: string; tour_url?: string }) => void;
}) {
  const [pestaña, setPestaña] = useState<Pestaña>("fotos");
  const [videoDraft, setVideoDraft] = useState(videoUrl);
  const [tourDraft, setTourDraft] = useState(tourUrl);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => setVideoDraft(videoUrl), [videoUrl]);
  useEffect(() => setTourDraft(tourUrl), [tourUrl]);
  const fotos = media.filter((m) => m.tipo === "foto").length;
  const planos = media.filter((m) => m.tipo === "plano").length;
  const videos = media.filter((m) => m.tipo === "video").length;

  const guardarUrl = async (campo: "video_url" | "tour_url", valor: string) => {
    setGuardando(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("propiedades")
      .update({ [campo]: valor.trim() || null, updated_at: new Date().toISOString() })
      .eq("id", propiedadId);
    setGuardando(false);
    if (error) {
      toast.error("No se ha podido guardar el enlace.");
      return;
    }
    onUrlsChange({ [campo]: valor.trim() });
    toast.success("Enlace guardado.");
  };

  const tabs: Array<{ id: Pestaña; label: string; cuenta?: number }> = [
    { id: "fotos", label: "Fotos", cuenta: fotos },
    { id: "planos", label: "Planos", cuenta: planos },
    { id: "video", label: "Vídeo", cuenta: videos || (videoUrl ? 1 : 0) },
    { id: "tour", label: "Tour 3D", cuenta: tourUrl ? 1 : 0 },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1 rounded-[10px] bg-[var(--surface-soft)] p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setPestaña(tab.id)}
            className={cn(
              "h-9 rounded-[8px] px-3 text-[13px] font-semibold",
              pestaña === tab.id ? "bg-white text-foreground" : "text-[var(--text-2)]"
            )}
          >
            {tab.label}
            {tab.cuenta ? <span className="ml-1.5 text-[12px] font-medium text-[var(--text-3)]">{tab.cuenta}</span> : null}
          </button>
        ))}
      </div>

      {pestaña === "fotos" ? (
        <InmuebleGaleria propiedadId={propiedadId} userId={userId} media={media} onChange={onChange} tipo="foto" />
      ) : null}

      {pestaña === "planos" ? (
        <InmuebleGaleria propiedadId={propiedadId} userId={userId} media={media} onChange={onChange} tipo="plano" />
      ) : null}

      {pestaña === "video" ? (
        <div className="space-y-4">
          <p className="text-[13px] text-[var(--text-2)]">
            Pega YouTube o Vimeo, o sube un archivo. El embed se ve en la ficha.
          </p>
          <div className="flex gap-2">
            <input
              value={videoDraft}
              onChange={(e) => setVideoDraft(e.target.value)}
              placeholder="https://youtube.com/… o https://vimeo.com/…"
              className={`${altaControl} mt-0`}
            />
            <button
              type="button"
              disabled={guardando}
              onClick={() => void guardarUrl("video_url", videoDraft)}
              className="h-11 shrink-0 rounded-[10px] bg-accent px-3.5 text-[13px] font-semibold text-white disabled:opacity-45"
            >
              Guardar
            </button>
          </div>
          {videoUrl ? <EmbedMedia url={videoUrl} titulo="Vídeo" /> : null}
          <InmuebleGaleria propiedadId={propiedadId} userId={userId} media={media} onChange={onChange} tipo="video" />
        </div>
      ) : null}

      {pestaña === "tour" ? (
        <div className="space-y-4">
          <p className="text-[13px] text-[var(--text-2)]">
            Matterport, Kuula o un YouTube 360. Queda embebido para enseñarlo en visita.
          </p>
          <div className="flex gap-2">
            <input
              value={tourDraft}
              onChange={(e) => setTourDraft(e.target.value)}
              placeholder="https://my.matterport.com/show/?m=…"
              className={`${altaControl} mt-0`}
            />
            <button
              type="button"
              disabled={guardando}
              onClick={() => void guardarUrl("tour_url", tourDraft)}
              className="h-11 shrink-0 rounded-[10px] bg-accent px-3.5 text-[13px] font-semibold text-white disabled:opacity-45"
            >
              Guardar
            </button>
          </div>
          {tourUrl ? <EmbedMedia url={tourUrl} titulo="Tour 3D" /> : null}
        </div>
      ) : null}
    </div>
  );
}

export { EmbedMedia };
