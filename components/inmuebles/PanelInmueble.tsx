"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { X, ThumbsUp, ThumbsDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { completitudFicha } from "@/lib/inmuebles/completitud";
import { formatPrecioInmueble, labelEstadoInmueble, labelTipoInmueble } from "@/lib/inmuebles/catalogo";
import { precioDeInmueble, type InmueblePanel } from "@/lib/inmuebles/panel";
import { rutaNuevaCita } from "@/lib/citas/citas";
import { fichaParaMatching, matchingInmuebleDemandas } from "@/lib/demandas/matching";
import { mensajeGuardado } from "@/lib/ui/mensaje-guardado";
import { criteriosDeDemanda } from "@/lib/demandas/proponer-stock";
import { relacionUno } from "@/lib/citas/citas";
import { FichaLink } from "@/components/crm/FichaPeek";
import { InmuebleMultimedia } from "@/components/inmuebles/InmuebleMultimedia";
import { useAuth } from "@/lib/auth/auth-context";
import type { InmuebleMedia } from "@/lib/inmuebles/catalogo";
import { cn } from "@/lib/utils";

type MatchVista = {
  id?: string;
  demandaId: string;
  cliente: string;
  criterios: string;
  score: number;
  estado?: string;
};

export function PanelInmueble({
  inmueble,
  overlay = false,
  embedded = false,
  loading = false,
  onClose,
  onCambio,
}: {
  inmueble: InmueblePanel | null;
  overlay?: boolean;
  embedded?: boolean;
  loading?: boolean;
  onClose?: () => void;
  onCambio?: (patch: Partial<InmueblePanel>) => void;
}) {
  const { user } = useAuth();
  const [matches, setMatches] = useState<MatchVista[]>([]);
  const [media, setMedia] = useState<InmuebleMedia[]>([]);

  useEffect(() => {
    if (!inmueble) {
      setMatches([]);
      setMedia([]);
      return;
    }
    const supabase = createClient();
    void supabase
      .from("inmueble_media")
      .select("id, propiedad_id, tipo, path, url, orden, portada")
      .eq("propiedad_id", inmueble.id)
      .then(({ data }) => setMedia((data ?? []) as InmuebleMedia[]));
    let cancelled = false;
    void (async () => {
      const { data: guardados } = await supabase
        .from("demanda_inmuebles")
        .select("id, demanda_id, puntuacion, estado, demandas:demanda_id(zonas, presupuesto_max, clientes:cliente_id(nombre))")
        .eq("propiedad_id", inmueble.id)
        .order("puntuacion", { ascending: false });
      const existentes: MatchVista[] = ((guardados ?? []) as Array<{
        id: string;
        demanda_id: string;
        puntuacion: number;
        estado: string;
        demandas?:
          | {
              zonas?: string[] | null;
              presupuesto_max?: number | null;
              clientes?: { nombre?: string | null } | { nombre?: string | null }[] | null;
            }
          | Array<{
              zonas?: string[] | null;
              presupuesto_max?: number | null;
              clientes?: { nombre?: string | null } | { nombre?: string | null }[] | null;
            }>;
      }>).map((row) => {
        const demanda = relacionUno(row.demandas);
        const cliente = relacionUno(demanda?.clientes);
        const chips = [
          demanda?.zonas?.[0],
          demanda?.presupuesto_max != null ? `hasta ${demanda.presupuesto_max.toLocaleString("es-ES")} €` : null,
        ].filter(Boolean);
        return {
          id: row.id,
          demandaId: row.demanda_id,
          cliente: cliente?.nombre ?? "Demanda",
          criterios: chips.join(" · ") || "Criterios de búsqueda",
          score: Math.round(Number(row.puntuacion) || 0),
          estado: row.estado,
        };
      });
      if (existentes.length > 0) {
        if (!cancelled) setMatches(existentes);
        return;
      }
      const { data: demandas } = await supabase
        .from("demandas")
        .select(
          "id, tipo_operacion, tipos_inmueble, zonas, presupuesto_min, presupuesto_max, superficie_min, superficie_max, habitaciones_min, banos_min, requisitos, clientes:cliente_id(nombre)"
        )
        .eq("estado", "activa");
      const criterios = (demandas ?? []).map((d) => {
        const cliente = relacionUno(d.clientes as { nombre?: string | null } | { nombre?: string | null }[] | null);
        return {
          id: d.id,
          ...criteriosDeDemanda(d),
          cliente: cliente?.nombre ?? "Cliente",
        };
      });
      const resultados = matchingInmuebleDemandas(fichaParaMatching(inmueble), criterios);
      if (!cancelled) {
        setMatches(
          resultados.slice(0, 5).map((item) => {
            const demanda = criterios.find((c) => c.id === item.demandaId);
            return {
              demandaId: item.demandaId,
              cliente: demanda?.cliente ?? "Demanda",
              criterios: (demanda?.zonas ?? []).slice(0, 2).join(" · ") || "Encaje automático",
              score: Math.round(item.puntuacion),
            };
          })
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inmueble]);

  const marcarMatch = async (item: MatchVista, estado: "presentado" | "descartado") => {
    if (!inmueble) return;
    const supabase = createClient();
    if (item.id) {
      const { data, error } = await supabase.from("demanda_inmuebles").update({ estado }).eq("id", item.id).select("id").maybeSingle();
      const aviso = mensajeGuardado(error, "No se ha podido guardar el encaje.", data);
      if (aviso) {
        toast.error(aviso);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("demanda_inmuebles")
        .insert({
          demanda_id: item.demandaId,
          propiedad_id: inmueble.id,
          origen: "automatico",
          puntuacion: item.score,
          estado,
        })
        .select("id")
        .single();
      const aviso = mensajeGuardado(error, "No se ha podido guardar el encaje.", data);
      if (aviso) {
        toast.error(aviso);
        return;
      }
    }
    setMatches((prev) => prev.map((m) => (m.demandaId === item.demandaId ? { ...m, estado } : m)));
  };

  const compartir = async () => {
    if (!inmueble) return;
    const url = `${window.location.origin}/propiedades/${inmueble.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace de la ficha copiado.");
    } catch {
      toast.error("No se ha podido copiar el enlace.");
    }
  };

  if (loading && !inmueble) {
    return (
      <aside
        className={cn(
          "overflow-hidden bg-[var(--surface)]",
          overlay ? "fixed inset-0 z-50 rounded-none" : embedded ? "" : "sticky top-[72px] w-full max-w-[42rem] shrink-0 rounded-[14px] border border-border"
        )}
      >
        <div className="aspect-video bg-[var(--surface-soft)]" />
        <p className="px-4 py-6 text-[13px] text-[var(--text-2)]">Cargando inmueble…</p>
      </aside>
    );
  }

  if (!inmueble) return null;

  const completar = completitudFicha({
    inmueble: {
      direccion: inmueble.direccion,
      localidad: inmueble.localidad,
      tipo_inmueble: inmueble.tipo_inmueble,
      tipo_operacion: inmueble.tipo_operacion,
      precio_venta: inmueble.precio_venta,
      precio_alquiler: inmueble.precio_alquiler,
      superficie_m2: inmueble.superficie_m2,
      superficie_util: inmueble.superficie_util,
      habitaciones: inmueble.habitaciones,
      descripcion: inmueble.descripcion,
      ofertante_id: inmueble.ofertante_id,
      publicado: inmueble.publicado,
      video_url: inmueble.video_url,
      tour_url: inmueble.tour_url,
    },
    fotos: media.filter((item) => item.tipo === "foto").length || inmueble.nFotos,
    planos: media.filter((item) => item.tipo === "plano").length || inmueble.nPlanos,
  });

  return (
    <aside
      className={cn(
        "bg-[var(--surface)]",
        overlay
          ? "fixed inset-0 z-50 overflow-hidden rounded-none"
          : embedded
            ? "flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain"
            : "sticky top-[72px] w-full max-w-[42rem] shrink-0 overflow-hidden rounded-[14px] border border-border"
      )}
    >
      <div className={cn(!embedded && "max-h-[100dvh] overflow-y-auto")}>
        <div
          className="relative aspect-video bg-[var(--surface-soft)] bg-cover bg-center"
          style={inmueble.portadaUrl ? { backgroundImage: `url(${inmueble.portadaUrl})` } : undefined}
        >
          <div className="absolute bottom-2.5 left-3 flex gap-1.5">
            <span className="rounded-md bg-white/94 px-2 py-0.5 text-[11px] font-semibold text-black">
              {labelEstadoInmueble(inmueble.estado)}
            </span>
            <span className="rounded-md bg-white/94 px-2 py-0.5 text-[11px] font-semibold text-black/70">
              {inmueble.nFotos} fotos{inmueble.nPlanos ? ` · ${inmueble.nPlanos} planos` : ""}
              {inmueble.video_url || inmueble.tour_url ? " · visita virtual" : ""}
            </span>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="absolute right-2.5 top-2.5 grid h-[34px] w-[34px] place-items-center rounded-[9px] bg-white/94 text-black"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" strokeWidth={2.4} />
            </button>
          ) : null}
        </div>
        <div className="px-5 pb-2 pt-5">
          <span className="font-mono text-[12px] text-[var(--text-3)]">{inmueble.referencia ?? "—"}</span>
          <div className="mt-2 flex items-start justify-between gap-4">
            <h2 className="min-w-0 text-[22px] font-medium leading-tight tracking-[-0.03em]">
              {inmueble.titulo || inmueble.direccion || "Inmueble"}
            </h2>
            <div className="shrink-0 text-[22px] font-medium tabular-nums tracking-[-0.03em] text-foreground">
              {formatPrecioInmueble(precioDeInmueble(inmueble))}
            </div>
          </div>
          <p className="mt-2 text-[13.5px] text-[var(--text-2)]">{[inmueble.direccion, inmueble.localidad].filter(Boolean).join(", ")}</p>
          <div className="mt-5 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--input)]">
              <div className="h-full rounded-full bg-[var(--green)]" style={{ width: `${completar.porcentaje}%` }} />
            </div>
            <span className="whitespace-nowrap text-[12px] tabular-nums text-[var(--text-3)]">Ficha {completar.porcentaje}%</span>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button asChild>
              <Link href={`/propiedades/${inmueble.id}/editar`}>Editar inmueble</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href={rutaNuevaCita({ propiedadId: inmueble.id, clienteId: inmueble.ofertante_id })}>Concertar visita</Link>
            </Button>
            <Button type="button" variant="ghost" onClick={() => void compartir()}>
              Compartir ficha
            </Button>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 px-5">
          {[
            ["Tipo", labelTipoInmueble(inmueble.tipo_inmueble)],
            ["Superficie", inmueble.superficie_m2 != null ? `${inmueble.superficie_m2} m²` : "—"],
            ["Habitaciones", inmueble.habitaciones != null ? String(inmueble.habitaciones) : "—"],
            ["Baños", inmueble.banos != null ? String(inmueble.banos) : "—"],
            ["Planta", inmueble.planta || "—"],
            ["Año", inmueble.anio_construccion != null ? String(inmueble.anio_construccion) : "—"],
            ["Comercial", inmueble.comercialNombre ?? "—"],
            ["Catastro", inmueble.referencia_catastral || inmueble.fincaReference || "—"],
          ].map(([label, value]) => (
            <div key={label} className={label === "Catastro" ? "min-w-0" : undefined}>
              <div className="text-[12px] text-[var(--text-3)]">{label}</div>
              <div className={cn("mt-1 truncate text-[14px]", label === "Catastro" && "font-mono text-[12px]")}>
                {value}
              </div>
            </div>
          ))}
          <div>
            <div className="text-[12px] text-[var(--text-3)]">Propietario</div>
            {inmueble.ofertante_id ? (
              <FichaLink tipo="cliente" id={inmueble.ofertante_id} className="mt-1 block truncate text-[14px]">
                {inmueble.ofertanteNombre}
              </FichaLink>
            ) : (
              <div className="mt-1 truncate text-[14px]">{inmueble.ofertanteNombre}</div>
            )}
          </div>
        </div>
        {inmueble.descripcion ? (
          <p className="mt-8 px-5 text-[14px] leading-7 text-[var(--text-2)]">{inmueble.descripcion}</p>
        ) : null}
        {inmueble.resumen ? null : (
          <div className="mt-8 px-5">
            <h3 className="text-[13px] font-medium text-[var(--text-3)]">Notas internas</h3>
            <p className="mt-2 text-[14px] leading-7 text-foreground">{inmueble.notas?.trim() || "Sin notas internas."}</p>
          </div>
        )}
        {user?.id ? (
          <div className="mt-8 px-5">
            <h3 className="mb-4 text-[13px] font-medium text-[var(--text-3)]">Fotos, planos y visita virtual</h3>
            <InmuebleMultimedia
              propiedadId={inmueble.id}
              userId={user.id}
              media={media}
              onChange={(next) => {
                setMedia(next);
                const fotos = next.filter((m) => m.tipo === "foto").sort((a, b) => a.orden - b.orden);
                onCambio?.({
                  nFotos: fotos.length,
                  nPlanos: next.filter((m) => m.tipo === "plano").length,
                  portadaUrl: fotos.find((f) => f.portada)?.url ?? fotos[0]?.url ?? null,
                });
              }}
              videoUrl={inmueble.video_url ?? ""}
              tourUrl={inmueble.tour_url ?? ""}
              onUrlsChange={(patch) =>
                onCambio?.({
                  video_url: patch.video_url !== undefined ? patch.video_url || null : inmueble.video_url,
                  tour_url: patch.tour_url !== undefined ? patch.tour_url || null : inmueble.tour_url,
                })
              }
            />
          </div>
        ) : null}
        <div className="mt-8 px-5 pb-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-[13px] font-medium text-[var(--text-3)]">Demandas que encajan</h3>
            <span className="text-[12px] tabular-nums text-[var(--text-3)]">{matches.length}</span>
          </div>
          {matches.length === 0 ? (
            <p className="rounded-[10px] border border-dashed border-[var(--input)] px-3 py-4 text-center text-[12.5px] text-[var(--text-2)]">
              Ninguna demanda encaja aún.
            </p>
          ) : (
            matches.map((m) => (
              <div key={m.demandaId} className="mb-2 flex items-center gap-3 rounded-[12px] border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3">
                <FichaLink tipo="demanda" id={m.demandaId} className="min-w-0 flex-1 text-foreground hover:text-accent">
                  <div className="text-[13px] font-semibold">{m.cliente}</div>
                  <div className="text-[11.5px] text-[var(--text-2)]">{m.criterios}</div>
                </FichaLink>
                <span className="text-[11.5px] font-semibold tabular-nums text-accent">{m.score}%</span>
                <div className="flex gap-0.5">
                  <button
                    type="button"
                    title="Presentar"
                    onClick={() => void marcarMatch(m, "presentado")}
                    className="grid h-9 w-9 place-items-center rounded-[9px] border border-border bg-[var(--surface)] text-foreground hover:bg-accent-soft"
                  >
                    <ThumbsUp className="h-3 w-3" strokeWidth={2.4} />
                  </button>
                  <button
                    type="button"
                    title="Descartar"
                    onClick={() => void marcarMatch(m, "descartado")}
                    className="grid h-9 w-9 place-items-center rounded-[9px] border border-border bg-[var(--surface)] text-[var(--text-2)] hover:bg-[var(--red-bg)] hover:text-[var(--red)]"
                  >
                    <ThumbsDown className="h-3 w-3" strokeWidth={2.4} />
                  </button>
                </div>
              </div>
            ))
          )}
          {embedded ? null : (
            <Link href={`/propiedades/${inmueble.id}`} className="mt-2 inline-block text-[12.5px] font-medium text-accent hover:underline">
              Abrir ficha completa
            </Link>
          )}
        </div>
      </div>
    </aside>
  );
}
