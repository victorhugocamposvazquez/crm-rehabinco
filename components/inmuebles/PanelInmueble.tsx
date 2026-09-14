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
import { rutaNuevaVisitaDesdeProperty } from "@/lib/partes-visita";
import { matchingInmuebleDemandas, type CriteriosDemanda } from "@/lib/demandas/matching";
import { relacionUno } from "@/lib/citas/citas";
import { colorEstado } from "@/lib/ui/estados-vista";
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
}: {
  inmueble: InmueblePanel | null;
  overlay?: boolean;
  embedded?: boolean;
  loading?: boolean;
  onClose?: () => void;
}) {
  const [matches, setMatches] = useState<MatchVista[]>([]);

  useEffect(() => {
    if (!inmueble) {
      setMatches([]);
      return;
    }
    const supabase = createClient();
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
          "id, tipo_operacion, tipos_inmueble, zonas, presupuesto_min, presupuesto_max, superficie_min, superficie_max, habitaciones_min, banos_min, clientes:cliente_id(nombre)"
        )
        .eq("estado", "activa");
      const criterios = (demandas ?? []).map((d) => {
        const cliente = relacionUno(d.clientes as { nombre?: string | null } | { nombre?: string | null }[] | null);
        return {
          id: d.id,
          tipoOperacion: d.tipo_operacion,
          tiposInmueble: d.tipos_inmueble ?? [],
          zonas: d.zonas ?? [],
          presupuestoMin: d.presupuesto_min,
          presupuestoMax: d.presupuesto_max,
          superficieMin: d.superficie_min,
          superficieMax: d.superficie_max,
          habitacionesMin: d.habitaciones_min,
          banosMin: d.banos_min,
          cliente: cliente?.nombre ?? "Cliente",
        };
      }) satisfies Array<CriteriosDemanda & { id: string; cliente: string }>;
      const resultados = matchingInmuebleDemandas(
        {
          id: inmueble.id,
          tipoOperacion: inmueble.tipo_operacion,
          tipoInmueble: inmueble.tipo_inmueble,
          localidad: inmueble.localidad,
          codigoPostal: null,
          precioVenta: inmueble.precio_venta,
          precioAlquiler: inmueble.precio_alquiler,
          superficie: inmueble.superficie_m2,
          habitaciones: inmueble.habitaciones,
          banos: inmueble.banos,
          estado: inmueble.estado,
        },
        criterios
      );
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
      await supabase.from("demanda_inmuebles").update({ estado }).eq("id", item.id);
    } else {
      await supabase.from("demanda_inmuebles").insert({
        demanda_id: item.demandaId,
        propiedad_id: inmueble.id,
        origen: "automatico",
        puntuacion: item.score,
        estado,
      });
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
          "overflow-hidden bg-white",
          overlay ? "fixed inset-0 z-50 rounded-none" : embedded ? "" : "sticky top-[72px] min-w-[300px] flex-[1_1_330px] rounded-[14px] border border-border"
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
      superficie_util: null,
      habitaciones: inmueble.habitaciones,
      descripcion: inmueble.descripcion,
      ofertante_id: inmueble.ofertante_id,
      publicado: inmueble.publicado,
    },
    fotos: inmueble.nFotos,
  });

  return (
    <aside
      className={cn(
        "overflow-hidden bg-white",
        overlay
          ? "fixed inset-0 z-50 rounded-none"
          : embedded
            ? ""
            : "sticky top-[72px] min-w-[300px] flex-[1_1_330px] rounded-[14px] border border-border"
      )}
    >
      <div className="max-h-[100dvh] overflow-y-auto">
        <div
          className="relative aspect-video bg-[var(--surface-soft)] bg-cover bg-center"
          style={inmueble.portadaUrl ? { backgroundImage: `url(${inmueble.portadaUrl})` } : undefined}
        >
          <div className="absolute bottom-2.5 left-3 flex gap-1.5">
            <span className="rounded-md bg-white/94 px-2 py-0.5 text-[11px] font-semibold" style={{ color: colorEstado(inmueble.estado) }}>
              {labelEstadoInmueble(inmueble.estado)}
            </span>
            <span className="rounded-md bg-white/94 px-2 py-0.5 text-[11px] font-semibold text-[var(--text-2)]">
              {inmueble.nFotos} fotos
            </span>
          </div>
          {overlay && onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="absolute right-2.5 top-2.5 grid h-[34px] w-[34px] place-items-center rounded-[9px] bg-white/95"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" strokeWidth={2.4} />
            </button>
          ) : null}
          {!overlay && onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="absolute right-2.5 top-2.5 grid h-[34px] w-[34px] place-items-center rounded-[9px] bg-white/95"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" strokeWidth={2.4} />
            </button>
          ) : null}
        </div>
        <div className="border-b border-[var(--border-soft)] px-4 py-3.5">
          <div className="flex items-start justify-between gap-2.5">
            <div className="min-w-0">
              <span className="font-mono text-[12px] text-accent">{inmueble.referencia ?? "—"}</span>
              <h2 className="mt-0.5 text-[17px] font-semibold tracking-tight">{inmueble.titulo || inmueble.direccion || "Inmueble"}</h2>
              <p className="mt-0.5 text-[12.5px] text-[var(--text-2)]">{[inmueble.direccion, inmueble.localidad].filter(Boolean).join(", ")}</p>
            </div>
            <div className="shrink-0 text-[19px] font-semibold tabular-nums tracking-tight">{formatPrecioInmueble(precioDeInmueble(inmueble))}</div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-[5px] flex-1 overflow-hidden rounded-[3px] bg-[var(--border-soft)]">
              <div className="h-full bg-accent" style={{ width: `${completar.porcentaje}%` }} />
            </div>
            <span className="whitespace-nowrap text-[12px] tabular-nums text-[var(--text-2)]">Ficha al {completar.porcentaje}%</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-b border-[var(--border-soft)] px-4 py-3">
          <Button asChild className="h-[38px] flex-[1_1_120px]">
            <Link href={rutaNuevaVisitaDesdeProperty(inmueble.id)}>Concertar visita</Link>
          </Button>
          <Button type="button" variant="secondary" className="h-[38px] flex-[1_1_120px]" onClick={() => void compartir()}>
            Compartir ficha
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2.5 border-b border-[var(--border-soft)] px-4 py-3">
          {[
            ["Tipo", labelTipoInmueble(inmueble.tipo_inmueble)],
            ["Superficie", inmueble.superficie_m2 != null ? `${inmueble.superficie_m2} m²` : "—"],
            ["Habitaciones", inmueble.habitaciones != null ? String(inmueble.habitaciones) : "—"],
            ["Baños", inmueble.banos != null ? String(inmueble.banos) : "—"],
            ["Planta", inmueble.planta || "—"],
            ["Año", inmueble.anio_construccion != null ? String(inmueble.anio_construccion) : "—"],
            ["Propietario", inmueble.ofertanteNombre],
            ["Comercial", inmueble.comercialNombre ?? "—"],
            ["Catastro", inmueble.referencia_catastral || inmueble.fincaReference || "—"],
          ].map(([label, value]) => (
            <div key={label} className={label === "Catastro" ? "min-w-0" : undefined}>
              <div className="text-[11px] uppercase tracking-[.07em] text-[var(--label)]">{label}</div>
              <div className={cn("mt-0.5 truncate text-[13.5px]", label === "Catastro" && "font-mono text-[11.5px]", label === "Propietario" && "text-accent")}>
                {value}
              </div>
            </div>
          ))}
        </div>
        {inmueble.descripcion ? (
          <p className="border-b border-[var(--border-soft)] px-4 py-3 text-[13px] leading-relaxed text-[var(--text-2)]">{inmueble.descripcion}</p>
        ) : null}
        <div className="px-4 pb-3.5 pt-3">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-[13.5px] font-semibold">Demandas que encajan</h3>
            <span className="text-[12px] text-[var(--text-2)]">{matches.length}</span>
          </div>
          {matches.length === 0 ? (
            <p className="rounded-[10px] border border-dashed border-[var(--input)] px-3 py-4 text-center text-[12.5px] text-[var(--text-2)]">
              Ninguna demanda encaja aún.
            </p>
          ) : (
            matches.map((m) => (
              <div key={m.demandaId} className="mb-1.5 flex items-center gap-2.5 rounded-[9px] border border-[var(--border-soft)] bg-[#FDFDFC] px-2.5 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold">{m.cliente}</div>
                  <div className="text-[11.5px] text-[var(--text-2)]">{m.criterios}</div>
                </div>
                <span className="text-[11.5px] font-semibold tabular-nums text-accent">{m.score}%</span>
                <div className="flex gap-0.5">
                  <button
                    type="button"
                    title="Presentar"
                    onClick={() => void marcarMatch(m, "presentado")}
                    className="grid h-7 w-7 place-items-center rounded-[7px] border border-border bg-white text-accent hover:bg-accent-soft"
                  >
                    <ThumbsUp className="h-3 w-3" strokeWidth={2.4} />
                  </button>
                  <button
                    type="button"
                    title="Descartar"
                    onClick={() => void marcarMatch(m, "descartado")}
                    className="grid h-7 w-7 place-items-center rounded-[7px] border border-border bg-white text-[var(--text-2)] hover:bg-[var(--red-bg)] hover:text-[var(--red)]"
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
