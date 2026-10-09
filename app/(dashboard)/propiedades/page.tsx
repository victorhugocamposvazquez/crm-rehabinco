"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Fab } from "@/components/ui/fab";
import { Button } from "@/components/ui/button";
import { AvataresTarea, type PersonaTarjeta } from "@/components/tareas/TareasBoard";
import { cargarPerfilesEquipo, mapaPerfiles, type PerfilEquipo } from "@/lib/equipo/perfiles";
import { nombreYApellido } from "@/lib/ui/tokens";
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
  SELECT_INMUEBLE_LISTA,
  cargarDhPorFincas,
  idsPortada,
  mapInmueblePanel,
  cargarInmueblePanel,
  precioDeInmueble,
  type InmueblePanel,
  type InmueblePanelRow,
} from "@/lib/inmuebles/panel";
import { colorEstado } from "@/lib/ui/estados-vista";
import { cn } from "@/lib/utils";
import { extraAlta } from "@/lib/ui/alta-panel";
import { NuevoInmueblePanel } from "@/components/inmuebles/NuevoInmueblePanel";
import { useHayAltaBorrador } from "@/lib/ui/use-alta-borrador";
import { Sheet } from "@/components/ui/sheet";
import { Selector } from "@/components/ui/selector";

type PropiedadLista = InmueblePanel;

function EquipoInmueble({
  inmueble,
  perfiles,
}: {
  inmueble: PropiedadLista;
  perfiles: Map<string, PerfilEquipo>;
}) {
  const creador = personaDe(inmueble.user_id, perfiles);
  const asignado = inmueble.comercialId ? personaDe(inmueble.comercialId, perfiles) : creador;
  if (!creador.id && !asignado.id) return <span className="text-[12.5px] text-[var(--text-3)]">—</span>;
  const quienCrea = creador.id ? creador : asignado;
  const quienLleva = asignado.id ? asignado : creador;
  const nombre = nombreYApellido(quienCrea.nombre, quienCrea.email) || quienCrea.nombre;
  return (
    <AvataresTarea
      creador={quienCrea}
      asignado={quienLleva}
      size={20}
      tituloCreador={nombre ? `Creado por ${nombre}` : "Creado por"}
    />
  );
}

function personaDe(id: string | null, perfiles: Map<string, PerfilEquipo>): PersonaTarjeta {
  const perfil = id ? perfiles.get(id) : undefined;
  return {
    id: id ?? "",
    nombre: perfil ? nombreYApellido(perfil.nombre, perfil.email) || perfil.nombre : "",
    color: perfil?.color ?? null,
    email: perfil?.email,
  };
}

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
  const [perfiles, setPerfiles] = useState<Map<string, PerfilEquipo>>(new Map());
  const propsRef = useRef(propiedades);
  propsRef.current = propiedades;
  const portadasRef = useRef(new Map<string, string>());
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
    let vivo = true;
    void cargarPerfilesEquipo().then((lista) => {
      if (vivo) setPerfiles(mapaPerfiles(lista));
    });
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    let vivo = true;
    const supabase = createClient();
    void supabase
      .from("propiedades")
      .select(SELECT_INMUEBLE_LISTA)
      .order("created_at", { ascending: false })
      .then(async ({ data, error: err }) => {
        if (!vivo) return;
        if (err) {
          setError(err.message);
          setPropiedades([]);
          setLoading(false);
          return;
        }
        const rows = (data ?? []) as InmueblePanelRow[];
        setPropiedades(
          rows.map((r) => {
            const item = { ...mapInmueblePanel(r), resumen: true };
            const url = portadasRef.current.get(item.id);
            return url ? { ...item, portadaUrl: url } : item;
          })
        );
        setLoading(false);
        const refs = [
          ...new Set(
            rows
              .map((r) => {
                const link = Array.isArray(r.catastro_property_links) ? r.catastro_property_links[0] : r.catastro_property_links;
                return link?.finca_reference;
              })
              .filter((ref): ref is string => Boolean(ref))
          ),
        ];
        const dhPorFinca = await cargarDhPorFincas(refs);
        if (!vivo) return;
        setPropiedades((prev) =>
          prev.map((p) => {
            if (!p.fincaReference) return p;
            const status = dhPorFinca.get(p.fincaReference);
            return status ? { ...p, dhStatus: status } : p;
          })
        );
      });
    void (async () => {
      const { data } = await supabase.from("inmueble_media").select("id, propiedad_id, portada, orden, tipo");
      if (!vivo || !data) return;
      const elegidas = idsPortada(data);
      const mediaIds = [...new Set(elegidas.values())];
      const urls = new Map<string, string>();
      const tam = 80;
      const lotes: string[][] = [];
      for (let i = 0; i < mediaIds.length; i += tam) lotes.push(mediaIds.slice(i, i + tam));
      const respuestas = await Promise.all(
        lotes.map((lote) => supabase.from("inmueble_media").select("id, url").in("id", lote))
      );
      for (const respuesta of respuestas) {
        for (const fila of respuesta.data ?? []) urls.set(fila.id, fila.url);
      }
      if (!vivo) return;
      const porInmueble = new Map<string, string>();
      for (const [propiedadId, mediaId] of elegidas) {
        const url = urls.get(mediaId);
        if (url) porInmueble.set(propiedadId, url);
      }
      portadasRef.current = porInmueble;
      setPropiedades((prev) =>
        prev.map((p) => {
          const url = porInmueble.get(p.id);
          return url && !p.portadaUrl ? { ...p, portadaUrl: url } : p;
        })
      );
    })();
    return () => {
      vivo = false;
    };
  }, [cargaKey]);

  useEffect(() => {
    if (!selectedId) return;
    if (!propsRef.current.find((p) => p.id === selectedId)?.resumen) return;
    let vivo = true;
    void cargarInmueblePanel(selectedId).then((completo) => {
      if (!vivo || !completo) return;
      setPropiedades((prev) =>
        prev.map((p) => (p.id === completo.id ? { ...completo, portadaUrl: completo.portadaUrl || p.portadaUrl } : p))
      );
    });
    return () => {
      vivo = false;
    };
  }, [selectedId, cargaKey]);

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
    if (!pendingSelectedId) return;
    if (propiedades.some((p) => p.id === pendingSelectedId)) {
      setSelectedId(pendingSelectedId);
      setPendingSelectedId(null);
    }
  }, [propiedades, pendingSelectedId]);

  const selected = propiedades.find((p) => p.id === selectedId) ?? null;
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
            <Button type="button" size="sm" onClick={() => { setOfertanteInicial(undefined); setNuevaOpen(true); }} className="hidden gap-2 min-[820px]:inline-flex">
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
        <div className="mt-5">
          <section className="min-w-0 w-full overflow-hidden rounded-[14px] border border-border bg-[var(--surface)]">
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
              <Selector
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
              </Selector>
              <Selector
                value={filterTipo}
                onChange={(e) => setFilterTipo(e.target.value)}
                className="h-9 rounded-[9px] border border-[var(--input)] bg-white px-2.5 text-[13px]"
              >
                <option value="todos">Operación</option>
                <option value="venta">Venta</option>
                <option value="alquiler">Alquiler</option>
                <option value="ambos">Ambos</option>
              </Selector>
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
                <div className="grid grid-cols-[minmax(0,1fr)_70px_110px_120px_130px] gap-3 border-b border-[var(--border-soft)] bg-[var(--surface-soft)] px-3.5 py-2 text-[12px] text-[var(--text-3)]">
                  <div>Inmueble</div>
                  <div className="text-right">m²</div>
                  <div className="text-right">Precio</div>
                  <div>Estado</div>
                  <div>Creado</div>
                </div>
                {filteredPropiedades.map((p) => {
                  const active = p.id === selectedId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedId(p.id)}
                      className={cn(
                        "grid w-full grid-cols-[minmax(0,1fr)_70px_110px_120px_130px] items-center gap-3 border-b border-[var(--border-row)] px-3.5 py-2.5 text-left hover:bg-[var(--surface-soft)]",
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
                      <span className="text-right text-[13.5px] tabular-nums text-[var(--text-2)]">{p.superficie_m2 ?? "—"}</span>
                      <span className="text-right text-[13.5px] font-semibold tabular-nums text-foreground">{formatPrecioInmueble(precioDeInmueble(p))}</span>
                      <span className="inline-flex items-center gap-1.5 text-[12.5px]" style={{ color: colorEstado(p.estado) }}>
                        <span className="h-[7px] w-[7px] rounded-full" style={{ background: colorEstado(p.estado) }} />
                        {labelEstadoInmueble(p.estado)}
                      </span>
                      <span className="min-w-0">
                        <EquipoInmueble inmueble={p} perfiles={perfiles} />
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
                          className="absolute left-2 top-2 rounded-md bg-white/94 px-2 py-0.5 text-[11px] font-semibold text-black"
                        >
                          {labelEstadoInmueble(p.estado)}
                        </span>
                      </span>
                      <span className="block px-3 pb-3 pt-2.5">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="font-mono text-[11.5px] text-accent">{p.referencia ?? "—"}</span>
                          <span className="text-[14px] font-semibold tabular-nums text-foreground">{formatPrecioInmueble(precioDeInmueble(p))}</span>
                        </span>
                        <span className="mt-1 block truncate text-[14px] font-semibold">{p.titulo || p.direccion || "Inmueble"}</span>
                        <span className="mt-0.5 block truncate text-[12px] text-[var(--text-2)]">
                          {p.direccion}
                          {p.superficie_m2 ? ` · ${p.superficie_m2} m²` : ""}
                        </span>
                        <span className="mt-1.5 block">
                          <EquipoInmueble inmueble={p} perfiles={perfiles} />
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        variant="side"
        side="right"
        className="min-[820px]:w-[min(56rem,92vw)]"
      >
        <PanelInmueble
          inmueble={selected}
          embedded
          onClose={() => setSelectedId(null)}
          onCambio={(patch) => {
            if (!selected) return;
            setPropiedades((prev) => prev.map((p) => (p.id === selected.id ? { ...p, ...patch } : p)));
          }}
        />
      </Sheet>

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
