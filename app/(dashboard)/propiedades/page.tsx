"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Fab } from "@/components/ui/fab";
import { Button } from "@/components/ui/button";
import { AvatarComercial } from "@/components/ui/avatar-comercial";
import { Chip } from "@/components/ui/chip";
import { PanelInmueble } from "@/components/inmuebles/PanelInmueble";
import {
  Plus,
  Building2,
  Search,
  LayoutList,
  LayoutGrid,
} from "lucide-react";
import {
  FILTROS_DH_PROPERTY,
  FILTROS_ORIGEN_CATASTRAL,
  coincideDhCatastro,
  coincideOrigenCatastral,
  type FiltroDhProperty,
  type FiltroOrigenCatastral,
} from "@/lib/catastro/explorer";
import { formatPrecioInmueble, labelEstadoInmueble } from "@/lib/inmuebles/catalogo";
import {
  SELECT_INMUEBLE_PANEL,
  cargarDhPorFincas,
  mapInmueblePanel,
  precioDeInmueble,
  type InmueblePanel,
  type InmueblePanelRow,
} from "@/lib/inmuebles/panel";
import { colorEstado } from "@/lib/ui/estados-vista";
import { cn } from "@/lib/utils";
import { extraAlta } from "@/lib/ui/alta-panel";
import { NuevoInmueblePanel } from "@/components/inmuebles/NuevoInmueblePanel";
import { useHayAltaBorrador } from "@/lib/ui/use-alta-borrador";

type PropiedadLista = InmueblePanel;

export default function PropiedadesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState("todos");
  const [filterTipo, setFilterTipo] = useState("todos");
  const [filterOrigen, setFilterOrigen] = useState<FiltroOrigenCatastral>("ALL");
  const [filterDh, setFilterDh] = useState<FiltroDhProperty>("ALL");
  const [vista, setVista] = useState<"lista" | "grid">("lista");
  const [narrow, setNarrow] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [propiedades, setPropiedades] = useState<PropiedadLista[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [nuevaOpen, setNuevaOpen] = useState(false);
  const [ofertanteInicial, setOfertanteInicial] = useState<string | undefined>();
  const [cargaKey, setCargaKey] = useState(0);
  const [pendingSelectedId, setPendingSelectedId] = useState<string | null>(null);
  const hayBorrador = useHayAltaBorrador("inmueble");

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 819px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const extra = extraAlta(searchParams);
    if (!extra) return;
    setOfertanteInicial(extra.get("ofertante") ?? undefined);
    setNuevaOpen(true);
    router.replace("/propiedades", { scroll: false });
  }, [searchParams, router]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("propiedades")
      .select(SELECT_INMUEBLE_PANEL)
      .order("created_at", { ascending: false })
      .then(async ({ data, error: err }) => {
        if (err) {
          setError(err.message);
          setPropiedades([]);
          setLoading(false);
          return;
        }
        const rows = (data ?? []) as InmueblePanelRow[];
        const refs = [
          ...new Set(
            rows
              .map((r) => {
                const link = Array.isArray(r.catastro_property_links)
                  ? r.catastro_property_links[0]
                  : r.catastro_property_links;
                return link?.finca_reference;
              })
              .filter((ref): ref is string => Boolean(ref))
          ),
        ];
        const dhPorFinca = await cargarDhPorFincas(refs);
        setPropiedades(rows.map((r) => mapInmueblePanel(r, dhPorFinca)));
        setLoading(false);
      });
  }, [cargaKey]);

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
    if (pendingSelectedId) {
      if (filteredPropiedades.some((p) => p.id === pendingSelectedId)) {
        setSelectedId(pendingSelectedId);
        setPendingSelectedId(null);
      }
      return;
    }
    if (filteredPropiedades.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filteredPropiedades.some((p) => p.id === selectedId)) {
      setSelectedId(filteredPropiedades[0].id);
    }
  }, [filteredPropiedades, selectedId, narrow, pendingSelectedId]);

  const selected = filteredPropiedades.find((p) => p.id === selectedId) ?? null;
  const modo = narrow ? "grid" : vista;
  const nDisponibles = propiedades.filter((p) => p.estado === "disponible").length;

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
            <Button type="button" size="sm" onClick={() => { setOfertanteInicial(undefined); setNuevaOpen(true); }} className="gap-2">
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              {hayBorrador ? "Continuar borrador" : "Nuevo inmueble"}
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
          <Button type="button" className="mt-4 gap-2" onClick={() => { setOfertanteInicial(undefined); setNuevaOpen(true); }}>
            <Building2 className="h-4 w-4" strokeWidth={1.5} />
            {hayBorrador ? "Continuar borrador" : "Añadir primer inmueble"}
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
                      <span className="text-right text-[13.5px] font-semibold tabular-nums">{formatPrecioInmueble(precioDeInmueble(p))}</span>
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
                          <span className="text-[14px] font-semibold tabular-nums">{formatPrecioInmueble(precioDeInmueble(p))}</span>
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
            <PanelInmueble
              inmueble={selected}
              overlay={narrow}
              onClose={narrow ? () => setSelectedId(null) : undefined}
            />
          ) : null}
        </div>
      )}

      <Fab onClick={() => { setOfertanteInicial(undefined); setNuevaOpen(true); }} label={hayBorrador ? "Continuar borrador" : "Nuevo inmueble"} />
      <NuevoInmueblePanel
        open={nuevaOpen}
        onOpenChange={(open) => {
          setNuevaOpen(open);
          if (!open) setOfertanteInicial(undefined);
        }}
        ofertanteIdInicial={ofertanteInicial}
        onCreado={(id) => {
          setPendingSelectedId(id);
          setCargaKey((n) => n + 1);
        }}
      />
    </div>
  );
}
