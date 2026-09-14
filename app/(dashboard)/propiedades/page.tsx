"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Fab } from "@/components/ui/fab";
import { Button } from "@/components/ui/button";
import { AvatarComercial } from "@/components/ui/avatar-comercial";
import { Chip } from "@/components/ui/chip";
import {
  Plus,
  Building2,
  Search,
  LayoutList,
  LayoutGrid,
  X,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import {
  FILTROS_DH_PROPERTY,
  FILTROS_ORIGEN_CATASTRAL,
  coincideDhCatastro,
  coincideOrigenCatastral,
  type FiltroDhProperty,
  type FiltroOrigenCatastral,
} from "@/lib/catastro/explorer";
import { completitudFicha } from "@/lib/inmuebles/completitud";
import {
  formatPrecioInmueble,
  labelEstadoInmueble,
  labelTipoInmueble,
} from "@/lib/inmuebles/catalogo";
import { rutaNuevaVisitaDesdeProperty } from "@/lib/partes-visita";
import { relacionUno } from "@/lib/citas/citas";
import { matchingInmuebleDemandas, type CriteriosDemanda } from "@/lib/demandas/matching";
import { colorEstado } from "@/lib/ui/estados-vista";
import { cn } from "@/lib/utils";

type PropiedadLista = {
  id: string;
  titulo: string | null;
  direccion: string | null;
  localidad: string | null;
  tipo_operacion: string;
  precio_venta: number | null;
  precio_alquiler: number | null;
  estado: string;
  ofertanteNombre: string;
  referencia: string | null;
  tipo_inmueble: string | null;
  portadaUrl: string | null;
  nFotos: number;
  origen: string | null;
  dhStatus: string | null;
  superficie_m2: number | null;
  anio_construccion: number | null;
  referencia_catastral: string | null;
  descripcion: string | null;
  publicado: boolean;
  ofertante_id: string | null;
  comercialNombre: string | null;
  comercialColor: string | null;
  fincaReference: string | null;
  habitaciones: number | null;
};

type MatchVista = {
  id?: string;
  demandaId: string;
  cliente: string;
  criterios: string;
  score: number;
  estado?: string;
};

export default function PropiedadesPage() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState("todos");
  const [filterTipo, setFilterTipo] = useState("todos");
  const [filterOrigen, setFilterOrigen] = useState<FiltroOrigenCatastral>("ALL");
  const [filterDh, setFilterDh] = useState<FiltroDhProperty>("ALL");
  const [vista, setVista] = useState<"lista" | "grid">("lista");
  const [narrow, setNarrow] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchVista[]>([]);
  const [propiedades, setPropiedades] = useState<PropiedadLista[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 819px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("propiedades")
      .select(
        "id, titulo, direccion, localidad, tipo_operacion, precio_venta, precio_alquiler, estado, referencia, tipo_inmueble, origen, superficie_m2, anio_construccion, referencia_catastral, descripcion, publicado, ofertante_id, comercial_id, habitaciones, clientes:ofertante_id(nombre), profiles:comercial_id(nombre_completo, color), inmueble_media(url, portada), catastro_property_links(finca_reference)"
      )
      .order("created_at", { ascending: false })
      .then(async ({ data, error: err }) => {
        if (err) {
          setError(err.message);
          setPropiedades([]);
          setLoading(false);
          return;
        }
        const rows = (data ?? []) as Array<{
          id: string;
          titulo: string | null;
          direccion: string | null;
          localidad: string | null;
          tipo_operacion: string;
          precio_venta: number | null;
          precio_alquiler: number | null;
          estado: string;
          referencia: string | null;
          tipo_inmueble: string | null;
          origen: string | null;
          superficie_m2: number | null;
          anio_construccion: number | null;
          referencia_catastral: string | null;
          descripcion: string | null;
          publicado: boolean;
          ofertante_id: string | null;
          clientes: { nombre: string } | { nombre: string }[] | null;
          profiles:
            | { nombre_completo: string | null; color: string | null }
            | { nombre_completo: string | null; color: string | null }[]
            | null;
          inmueble_media: Array<{ url: string; portada: boolean }> | null;
          catastro_property_links:
            | { finca_reference: string }
            | { finca_reference: string }[]
            | null;
        }>;
        const refs = [
          ...new Set(
            rows
              .map((r) => relacionUno(r.catastro_property_links)?.finca_reference)
              .filter((ref): ref is string => Boolean(ref))
          ),
        ];
        const dhPorFinca = new Map<string, string>();
        if (refs.length > 0) {
          const { data: fincas } = await supabase
            .from("catastro_fincas")
            .select("finca_reference, dh_status")
            .in("finca_reference", refs);
          for (const finca of fincas ?? []) {
            dhPorFinca.set(finca.finca_reference, finca.dh_status);
          }
        }
        setPropiedades(
          rows.map((r) => {
            const c = relacionUno(r.clientes);
            const com = relacionUno(r.profiles);
            const fotos = r.inmueble_media ?? [];
            const portada = fotos.find((f) => f.portada) ?? fotos[0];
            const link = relacionUno(r.catastro_property_links);
            return {
              id: r.id,
              titulo: r.titulo,
              direccion: r.direccion,
              localidad: r.localidad,
              tipo_operacion: r.tipo_operacion,
              precio_venta: r.precio_venta,
              precio_alquiler: r.precio_alquiler,
              estado: r.estado,
              ofertanteNombre: c?.nombre ?? "—",
              referencia: r.referencia,
              tipo_inmueble: r.tipo_inmueble,
              portadaUrl: portada?.url ?? null,
              nFotos: fotos.length,
              origen: r.origen ?? null,
              dhStatus: link?.finca_reference ? dhPorFinca.get(link.finca_reference) ?? null : null,
              superficie_m2: r.superficie_m2,
              anio_construccion: r.anio_construccion,
              referencia_catastral: r.referencia_catastral,
              descripcion: r.descripcion,
              publicado: r.publicado,
              ofertante_id: r.ofertante_id,
              comercialNombre: com?.nombre_completo ?? null,
              comercialColor: com?.color ?? null,
              fincaReference: link?.finca_reference ?? null,
              habitaciones: (r as { habitaciones?: number | null }).habitaciones ?? null,
            };
          })
        );
        setLoading(false);
      });
  }, []);

  const filteredPropiedades = useMemo(() => {
    return propiedades.filter((p) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        (p.titulo ?? "").toLowerCase().includes(q) ||
        (p.direccion ?? "").toLowerCase().includes(q) ||
        (p.localidad ?? "").toLowerCase().includes(q) ||
        (p.referencia ?? "").toLowerCase().includes(q) ||
        p.ofertanteNombre.toLowerCase().includes(q);
      return (
        matchSearch &&
        (filterEstado === "todos" || p.estado === filterEstado) &&
        (filterTipo === "todos" || p.tipo_operacion === filterTipo) &&
        coincideOrigenCatastral(p.origen, filterOrigen) &&
        coincideDhCatastro(p.dhStatus, filterDh)
      );
    });
  }, [propiedades, search, filterEstado, filterTipo, filterOrigen, filterDh]);

  useEffect(() => {
    if (narrow) return;
    if (filteredPropiedades.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filteredPropiedades.some((p) => p.id === selectedId)) {
      setSelectedId(filteredPropiedades[0].id);
    }
  }, [filteredPropiedades, selectedId, narrow]);

  const selected = filteredPropiedades.find((p) => p.id === selectedId) ?? null;
  const modo = narrow ? "grid" : vista;
  const nDisponibles = propiedades.filter((p) => p.estado === "disponible").length;

  useEffect(() => {
    if (!selected) {
      setMatches([]);
      return;
    }
    const supabase = createClient();
    let cancelled = false;
    void (async () => {
      const { data: guardados } = await supabase
        .from("demanda_inmuebles")
        .select("id, demanda_id, puntuacion, estado, demandas:demanda_id(zonas, presupuesto_max, clientes:cliente_id(nombre))")
        .eq("propiedad_id", selected.id)
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
          id: selected.id,
          tipoOperacion: selected.tipo_operacion,
          tipoInmueble: selected.tipo_inmueble,
          localidad: selected.localidad,
          codigoPostal: null,
          precioVenta: selected.precio_venta,
          precioAlquiler: selected.precio_alquiler,
          superficie: selected.superficie_m2,
          habitaciones: selected.habitaciones,
          banos: null,
          estado: selected.estado,
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
  }, [selected]);

  const precioDe = (p: PropiedadLista) =>
    p.tipo_operacion === "alquiler" ? p.precio_alquiler : p.precio_venta;

  const completar = selected
    ? completitudFicha({
        inmueble: {
          direccion: selected.direccion,
          localidad: selected.localidad,
          tipo_inmueble: selected.tipo_inmueble,
          tipo_operacion: selected.tipo_operacion,
          precio_venta: selected.precio_venta,
          precio_alquiler: selected.precio_alquiler,
          superficie_m2: selected.superficie_m2,
          superficie_util: null,
          habitaciones: selected.habitaciones,
          descripcion: selected.descripcion,
          ofertante_id: selected.ofertante_id,
          publicado: selected.publicado,
        },
        fotos: selected.nFotos,
      })
    : null;

  const marcarMatch = async (item: MatchVista, estado: "presentado" | "descartado") => {
    const supabase = createClient();
    if (item.id) {
      await supabase.from("demanda_inmuebles").update({ estado }).eq("id", item.id);
    } else if (selected) {
      await supabase.from("demanda_inmuebles").insert({
        demanda_id: item.demandaId,
        propiedad_id: selected.id,
        origen: "automatico",
        puntuacion: item.score,
        estado,
      });
    }
    setMatches((prev) => prev.map((m) => (m.demandaId === item.demandaId ? { ...m, estado } : m)));
  };

  const compartir = async () => {
    if (!selected) return;
    const url = `${window.location.origin}/propiedades/${selected.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace de la ficha copiado.");
    } catch {
      toast.error("No se ha podido copiar el enlace.");
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Inmuebles", href: "/propiedades" }]}
        title="Inmuebles"
        description={`Stock de la agencia · ${nDisponibles} disponibles`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="secondary">
              <Link href="/catastro" className="gap-2">
                <Search className="h-4 w-4" strokeWidth={1.5} />
                Buscar en Catastro
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/propiedades/nueva" className="gap-2">
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                Nuevo inmueble
              </Link>
            </Button>
          </div>
        }
      />

      {error ? <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <div className="mt-6 rounded-[14px] border border-dashed border-[var(--input)] px-4 py-16 text-center text-[13px] text-[var(--text-2)]">
          Cargando inmuebles…
        </div>
      ) : propiedades.length === 0 ? (
        <div className="mt-6 rounded-[14px] border border-dashed border-[var(--input)] bg-white p-8 text-center">
          <p className="text-[var(--text-2)]">Aún no hay inmuebles.</p>
          <Button asChild className="mt-4">
            <Link href="/propiedades/nueva" className="gap-2">
              <Building2 className="h-4 w-4" strokeWidth={1.5} />
              Añadir primer inmueble
            </Link>
          </Button>
        </div>
      ) : (
        <div className="mt-5 flex items-start gap-4">
          <section className="min-w-0 flex-[1_1_540px] overflow-hidden rounded-[14px] border border-border bg-white">
            <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-soft)] px-3.5 py-3">
              <div className="relative min-w-0 flex-[1_1_180px]">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-2)]" strokeWidth={2.2} />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Referencia, dirección, propietario"
                  className="h-9 w-full rounded-[9px] border border-[var(--input)] bg-transparent pl-9 pr-3 text-[13.5px] outline-none focus:border-accent"
                />
              </div>
              <select
                value={filterEstado}
                onChange={(e) => setFilterEstado(e.target.value)}
                className="h-9 rounded-[9px] border border-[var(--input)] bg-white px-2.5 text-[13px]"
              >
                <option value="todos">Estado: todos</option>
                <option value="disponible">Disponible</option>
                <option value="reservada">Reservada</option>
                <option value="vendida">Vendida</option>
                <option value="alquilada">Alquilada</option>
                <option value="baja">Baja</option>
              </select>
              <select
                value={filterTipo}
                onChange={(e) => setFilterTipo(e.target.value)}
                className="h-9 rounded-[9px] border border-[var(--input)] bg-white px-2.5 text-[13px]"
              >
                <option value="todos">Operación</option>
                <option value="venta">Venta</option>
                <option value="alquiler">Alquiler</option>
                <option value="ambos">Ambos</option>
              </select>
              {!narrow ? (
                <div className="flex overflow-hidden rounded-[9px] border border-[var(--input)]">
                  <button
                    type="button"
                    onClick={() => setVista("lista")}
                    className={cn("grid h-[34px] w-[34px] place-items-center", vista === "lista" ? "bg-accent-soft text-accent" : "text-[var(--text-2)]")}
                    aria-label="Vista lista"
                  >
                    <LayoutList className="h-3.5 w-3.5" strokeWidth={2.2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setVista("grid")}
                    className={cn("grid h-[34px] w-[34px] place-items-center", vista === "grid" ? "bg-accent-soft text-accent" : "text-[var(--text-2)]")}
                    aria-label="Vista cuadrícula"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" strokeWidth={2.2} />
                  </button>
                </div>
              ) : null}
              <div className="flex w-full flex-wrap gap-1.5">
                {FILTROS_ORIGEN_CATASTRAL.map((item) => (
                  <Chip key={item.value} active={filterOrigen === item.value} onClick={() => setFilterOrigen(item.value)}>
                    {item.label}
                  </Chip>
                ))}
                {FILTROS_DH_PROPERTY.map((item) => (
                  <Chip key={item.value} active={filterDh === item.value} onClick={() => setFilterDh(item.value)}>
                    {item.label}
                  </Chip>
                ))}
              </div>
            </div>

            {filteredPropiedades.length === 0 ? (
              <p className="px-4 py-9 text-center text-[13.5px] text-[var(--text-2)]">Ningún inmueble con ese filtro.</p>
            ) : modo === "lista" ? (
              <>
                <div className="grid grid-cols-[minmax(0,2.4fr)_70px_100px_110px_120px] gap-3 border-b border-[var(--border-soft)] bg-[var(--surface-soft)] px-3.5 py-2 text-[11px] uppercase tracking-[.06em] text-[var(--label)]">
                  <div>Inmueble</div>
                  <div className="text-right">m²</div>
                  <div className="text-right">Precio</div>
                  <div>Estado</div>
                  <div>Comercial</div>
                </div>
                {filteredPropiedades.map((p) => {
                  const active = p.id === selectedId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedId(p.id)}
                      className={cn(
                        "grid w-full grid-cols-[minmax(0,2.4fr)_70px_100px_110px_120px] items-center gap-3 border-b border-[var(--border-row)] px-3.5 py-2.5 text-left hover:bg-[var(--surface-soft)]",
                        active && "bg-[var(--row-active)] shadow-[inset_3px_0_0_var(--accent)]"
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span
                          className="h-[42px] w-14 shrink-0 rounded-[7px] bg-[var(--surface-soft)] bg-cover bg-center"
                          style={p.portadaUrl ? { backgroundImage: `url(${p.portadaUrl})` } : undefined}
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-semibold">{p.titulo || p.direccion || "Inmueble"}</span>
                          <span className="mt-0.5 flex items-center gap-2">
                            <span className="font-mono text-[11.5px] text-accent">{p.referencia ?? "—"}</span>
                            <span className="truncate text-[12px] text-[var(--text-2)]">{p.direccion}</span>
                          </span>
                        </span>
                      </span>
                      <span className="text-right text-[13.5px] tabular-nums">{p.superficie_m2 ?? "—"}</span>
                      <span className="text-right text-[13.5px] font-semibold tabular-nums">{formatPrecioInmueble(precioDe(p))}</span>
                      <span className="inline-flex items-center gap-1.5 text-[12.5px]" style={{ color: colorEstado(p.estado) }}>
                        <span className="h-[7px] w-[7px] rounded-full" style={{ background: colorEstado(p.estado) }} />
                        {labelEstadoInmueble(p.estado)}
                      </span>
                      <span className="flex items-center gap-1.5 text-[12.5px] text-[var(--text-2)]">
                        <AvatarComercial nombre={p.comercialNombre} color={p.comercialColor} size={20} />
                        {p.comercialNombre?.split(" ")[0] ?? "—"}
                      </span>
                    </button>
                  );
                })}
              </>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3 p-3.5">
                {filteredPropiedades.map((p) => {
                  const active = p.id === selectedId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedId(p.id)}
                      className={cn(
                        "overflow-hidden rounded-xl border bg-white text-left",
                        active ? "border-accent" : "border-border hover:border-accent"
                      )}
                    >
                      <span
                        className="relative block aspect-[4/3] bg-[var(--surface-soft)] bg-cover bg-center"
                        style={p.portadaUrl ? { backgroundImage: `url(${p.portadaUrl})` } : undefined}
                      >
                        <span
                          className="absolute left-2 top-2 rounded-md bg-white/94 px-2 py-0.5 text-[11px] font-semibold"
                          style={{ color: colorEstado(p.estado) }}
                        >
                          {labelEstadoInmueble(p.estado)}
                        </span>
                      </span>
                      <span className="block px-3 pb-3 pt-2.5">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="font-mono text-[11.5px] text-accent">{p.referencia ?? "—"}</span>
                          <span className="text-[14px] font-semibold tabular-nums">{formatPrecioInmueble(precioDe(p))}</span>
                        </span>
                        <span className="mt-1 block truncate text-[14px] font-semibold">{p.titulo || p.direccion || "Inmueble"}</span>
                        <span className="mt-0.5 block truncate text-[12px] text-[var(--text-2)]">
                          {p.direccion}
                          {p.superficie_m2 ? ` · ${p.superficie_m2} m²` : ""}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {selected ? (
            <aside
              className={cn(
                "overflow-hidden rounded-[14px] border border-border bg-white",
                narrow
                  ? "fixed inset-0 z-50 rounded-none"
                  : "sticky top-[72px] min-w-[300px] flex-[1_1_330px]"
              )}
            >
              <div
                className="relative aspect-video bg-[var(--surface-soft)] bg-cover bg-center"
                style={selected.portadaUrl ? { backgroundImage: `url(${selected.portadaUrl})` } : undefined}
              >
                <div className="absolute bottom-2.5 left-3 flex gap-1.5">
                  <span className="rounded-md bg-white/94 px-2 py-0.5 text-[11px] font-semibold" style={{ color: colorEstado(selected.estado) }}>
                    {labelEstadoInmueble(selected.estado)}
                  </span>
                  <span className="rounded-md bg-white/94 px-2 py-0.5 text-[11px] font-semibold text-[var(--text-2)]">
                    {selected.nFotos} fotos
                  </span>
                </div>
                {narrow ? (
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
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
                    <span className="font-mono text-[12px] text-accent">{selected.referencia ?? "—"}</span>
                    <h2 className="mt-0.5 text-[17px] font-semibold tracking-tight">{selected.titulo || selected.direccion || "Inmueble"}</h2>
                    <p className="mt-0.5 text-[12.5px] text-[var(--text-2)]">{[selected.direccion, selected.localidad].filter(Boolean).join(", ")}</p>
                  </div>
                  <div className="shrink-0 text-[19px] font-semibold tabular-nums tracking-tight">{formatPrecioInmueble(precioDe(selected))}</div>
                </div>
                {completar ? (
                  <div className="mt-3 flex items-center gap-2">
                    <div className="h-[5px] flex-1 overflow-hidden rounded-[3px] bg-[var(--border-soft)]">
                      <div className="h-full bg-accent" style={{ width: `${completar.porcentaje}%` }} />
                    </div>
                    <span className="whitespace-nowrap text-[12px] tabular-nums text-[var(--text-2)]">Ficha al {completar.porcentaje}%</span>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2 border-b border-[var(--border-soft)] px-4 py-3">
                <Button asChild className="h-[38px] flex-[1_1_120px]">
                  <Link href={rutaNuevaVisitaDesdeProperty(selected.id)}>Concertar visita</Link>
                </Button>
                <Button type="button" variant="secondary" className="h-[38px] flex-[1_1_120px]" onClick={() => void compartir()}>
                  Compartir ficha
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2.5 border-b border-[var(--border-soft)] px-4 py-3">
                {[
                  ["Tipo", labelTipoInmueble(selected.tipo_inmueble)],
                  ["Superficie", selected.superficie_m2 != null ? `${selected.superficie_m2} m²` : "—"],
                  ["Año", selected.anio_construccion != null ? String(selected.anio_construccion) : "—"],
                  ["Propietario", selected.ofertanteNombre],
                  ["Comercial", selected.comercialNombre ?? "—"],
                  ["Catastro", selected.referencia_catastral || selected.fincaReference || "—"],
                ].map(([label, value]) => (
                  <div key={label} className={label === "Catastro" ? "min-w-0" : undefined}>
                    <div className="text-[11px] uppercase tracking-[.07em] text-[var(--label)]">{label}</div>
                    <div className={cn("mt-0.5 truncate text-[13.5px]", label === "Catastro" && "font-mono text-[11.5px]", label === "Propietario" && "text-accent")}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
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
                      <Link href={`/demandas/${m.demandaId}`} className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold">{m.cliente}</div>
                        <div className="text-[11.5px] text-[var(--text-2)]">{m.criterios}</div>
                      </Link>
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
                <Link href={`/propiedades/${selected.id}`} className="mt-2 inline-block text-[12.5px] font-medium text-accent hover:underline">
                  Abrir ficha completa
                </Link>
              </div>
            </aside>
          ) : null}
        </div>
      )}

      <Fab href="/propiedades/nueva" label="Nuevo inmueble" />
    </div>
  );
}
