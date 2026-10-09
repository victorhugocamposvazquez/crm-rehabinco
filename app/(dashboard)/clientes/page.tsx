"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Fab } from "@/components/ui/fab";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { CarrilHorizontal } from "@/components/ui/carril-horizontal";
import { AvatarComercial } from "@/components/ui/avatar-comercial";
import { UserPlus, Search, X } from "lucide-react";
import { inicialesNombre, nombreYApellido } from "@/lib/ui/tokens";
import { cargarPerfilesEquipo, mapaPerfiles, type PerfilEquipo } from "@/lib/equipo/perfiles";
import { telWhatsApp } from "@/lib/ui/estados-vista";
import { cn } from "@/lib/utils";
import { FichaLink } from "@/components/crm/FichaPeek";
import { extraAlta } from "@/lib/ui/alta-panel";
import { NuevoClientePanel } from "@/components/clientes/NuevoClientePanel";
import { NuevaDemandaPanel } from "@/components/demandas/NuevaDemandaPanel";
import { useHayAltaBorrador } from "@/lib/ui/use-alta-borrador";
import { mensajeGuardado } from "@/lib/ui/mensaje-guardado";
import { rutaNuevaCita } from "@/lib/citas/citas";

type ClienteLista = {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  activo: boolean;
  etiqueta: "fallecido" | null;
  tipo_cliente: "particular" | "empresa";
  documento_fiscal: string | null;
  tipo_documento: string | null;
  direccion: string | null;
  localidad: string | null;
  codigo_postal: string | null;
  notas: string | null;
  es_cliente: boolean;
  created_at: string | null;
  user_id: string | null;
  creador: PerfilEquipo | null;
  tieneOferta: boolean;
  tieneBusqueda: boolean;
  tieneObra: boolean;
  detalleCargado: boolean;
  ofrece: Array<{ id: string; a: string; b: string }>;
  busca: Array<{ id: string; a: string; b: string }>;
  visitas: Array<{ id: string; a: string; b: string; propiedad_id: string | null }>;
  docs: Array<{ id: string; a: string; b: string; href: string }>;
};

type FiltroCli = "todos" | "contactos" | "clientes" | "ofrecen" | "buscan" | "obra" | "inactivos";

const FILTROS_CLI: Array<{ id: FiltroCli; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "contactos", label: "Contactos" },
  { id: "clientes", label: "Clientes" },
  { id: "ofrecen", label: "Ofrecen" },
  { id: "buscan", label: "Buscan" },
  { id: "obra", label: "Obra" },
  { id: "inactivos", label: "Inactivos" },
];

function contacto(c: ClienteLista) {
  return [c.telefono, c.email].filter(Boolean).join(" · ") || "Sin contacto";
}

function fechaAlta(iso: string | null | undefined) {
  if (!iso) return "";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  const mismoAno = fecha.getFullYear() === new Date().getFullYear();
  return fecha.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: mismoAno ? undefined : "numeric",
  });
}

async function idsConColumna(tabla: "propiedades" | "demandas" | "presupuestos" | "facturas", columna: "ofertante_id" | "cliente_id") {
  const supabase = createClient();
  const ids = new Set<string>();
  const tam = 1000;
  for (let desde = 0; ; desde += tam) {
    const { data, error } = await supabase
      .from(tabla)
      .select(columna)
      .not(columna, "is", null)
      .range(desde, desde + tam - 1);
    if (error || !data?.length) break;
    for (const fila of data as Array<Record<string, string | null>>) {
      const id = fila[columna];
      if (typeof id === "string") ids.add(id);
    }
    if (data.length < tam) break;
  }
  return ids;
}

function estadoCliente(c: ClienteLista) {
  if (c.etiqueta === "fallecido") return { label: "Fallecido", color: "var(--text-3)" };
  if (!c.activo) return { label: "Inactivo", color: "var(--text-3)" };
  return { label: "Activo", color: "var(--foreground)" };
}

export default function ClientesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState<FiltroCli>("todos");
  const [clientes, setClientes] = useState<ClienteLista[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [narrow, setNarrow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nuevaOpen, setNuevaOpen] = useState(false);
  const [demandaOpen, setDemandaOpen] = useState(false);
  const [padreInicial, setPadreInicial] = useState<string | undefined>();
  const [contactoInicial, setContactoInicial] = useState<
    { nombre?: string; telefono?: string; email?: string } | undefined
  >();
  const [cargaKey, setCargaKey] = useState(0);
  const [listaLista, setListaLista] = useState(0);
  const [pendingSelectedId, setPendingSelectedId] = useState<string | null>(null);
  const hayBorrador = useHayAltaBorrador("cliente");

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
    setPadreInicial(extra.get("padre") ?? undefined);
    const nombre = extra.get("nombre")?.trim();
    const telefono = extra.get("telefono")?.trim();
    const email = extra.get("email")?.trim();
    if (nombre || telefono || email) {
      setContactoInicial({
        nombre: nombre || undefined,
        telefono: telefono || undefined,
        email: email || undefined,
      });
    } else {
      setContactoInicial(undefined);
    }
    setNuevaOpen(true);
    router.replace("/clientes", { scroll: false });
  }, [searchParams, router]);

  useEffect(() => {
    let vivo = true;
    const supabase = createClient();
    void (async () => {
      const [{ data, error: err }, perfiles] = await Promise.all([
        supabase
          .from("clientes")
          .select(
            "id, nombre, email, telefono, activo, etiqueta, tipo_cliente, documento_fiscal, tipo_documento, direccion, localidad, codigo_postal, notas, es_cliente, created_at, user_id"
          )
          .order("created_at", { ascending: false }),
        cargarPerfilesEquipo(),
      ]);
      if (!vivo) return;
      if (err) {
        setError(err.message);
        setClientes([]);
        setLoading(false);
        return;
      }
      const equipo = mapaPerfiles(perfiles);
      const base = (data ?? []) as Array<
        Omit<ClienteLista, "creador" | "tieneOferta" | "tieneBusqueda" | "tieneObra" | "detalleCargado" | "ofrece" | "busca" | "visitas" | "docs">
      >;
      setClientes(
        base.map((c) => ({
          ...c,
          creador: c.user_id ? equipo.get(c.user_id) ?? null : null,
          tieneOferta: false,
          tieneBusqueda: false,
          tieneObra: false,
          detalleCargado: false,
          ofrece: [],
          busca: [],
          visitas: [],
          docs: [],
        }))
      );
      setListaLista((n) => n + 1);
      setLoading(false);
      if (base.length === 0) return;
      const [ofertas, busquedas, presupuestos, facturas] = await Promise.all([
        idsConColumna("propiedades", "ofertante_id"),
        idsConColumna("demandas", "cliente_id"),
        idsConColumna("presupuestos", "cliente_id"),
        idsConColumna("facturas", "cliente_id"),
      ]);
      if (!vivo) return;
      setClientes((prev) =>
        prev.map((c) => ({
          ...c,
          tieneOferta: ofertas.has(c.id),
          tieneBusqueda: busquedas.has(c.id),
          tieneObra: presupuestos.has(c.id) || facturas.has(c.id),
        }))
      );
    })();
    return () => {
      vivo = false;
    };
  }, [cargaKey]);

  useEffect(() => {
    if (!selectedId) return;
    let vivo = true;
    const supabase = createClient();
    void (async () => {
      const [props, demandas, presupuestos, facturas, citas] = await Promise.all([
        supabase.from("propiedades").select("id, ofertante_id, titulo, direccion, referencia, estado").eq("ofertante_id", selectedId),
        supabase.from("demandas").select("id, cliente_id, tipo_operacion, estado, zonas").eq("cliente_id", selectedId),
        supabase.from("presupuestos").select("id, cliente_id, numero, estado, total").eq("cliente_id", selectedId),
        supabase.from("facturas").select("id, cliente_id, numero, estado, total").eq("cliente_id", selectedId),
        supabase.from("citas").select("id, cliente_id, titulo, empieza, estado, propiedad_id").eq("tipo", "visita").eq("cliente_id", selectedId),
      ]);
      if (!vivo) return;
      const inmuebles = (props.data ?? []) as Array<{
        id: string;
        titulo: string | null;
        direccion: string | null;
        referencia: string | null;
        estado: string;
      }>;
      const dems = (demandas.data ?? []) as Array<{
        id: string;
        tipo_operacion: string;
        estado: string;
        zonas: string[] | null;
      }>;
      const pres = (presupuestos.data ?? []) as Array<{ id: string; numero: string; estado: string }>;
      const facs = (facturas.data ?? []) as Array<{ id: string; numero: string; estado: string }>;
      const vis = (citas.data ?? []) as Array<{
        id: string;
        titulo: string;
        empieza: string;
        propiedad_id: string | null;
      }>;
      const ofrece = inmuebles.slice(0, 3).map((p) => ({
        id: p.id,
        a: p.referencia || p.titulo || p.direccion || "Inmueble",
        b: p.estado,
      }));
      const busca = dems.slice(0, 3).map((d) => ({
        id: d.id,
        a: d.tipo_operacion,
        b: d.zonas?.[0] ?? d.estado,
      }));
      const docs = [
        ...pres.slice(0, 2).map((p) => ({ id: p.id, a: p.numero, b: p.estado, href: `/presupuestos/${p.id}` })),
        ...facs.slice(0, 2).map((f) => ({ id: f.id, a: f.numero, b: f.estado, href: `/facturas/${f.id}` })),
      ];
      setClientes((prev) =>
        prev.map((c) =>
          c.id === selectedId
            ? {
                ...c,
                detalleCargado: true,
                tieneOferta: inmuebles.length > 0,
                tieneBusqueda: dems.length > 0,
                tieneObra: pres.length > 0 || facs.length > 0,
                ofrece,
                busca,
                visitas: vis.slice(0, 3).map((v) => ({
                  id: v.id,
                  a: v.titulo,
                  b: v.empieza.slice(0, 10),
                  propiedad_id: v.propiedad_id,
                })),
                docs,
              }
            : c
        )
      );
    })();
    return () => {
      vivo = false;
    };
  }, [selectedId, listaLista]);

  const filtered = useMemo(() => {
    return clientes.filter((c) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        c.nombre.toLowerCase().includes(q) ||
        (c.email?.toLowerCase().includes(q) ?? false) ||
        (c.telefono?.includes(q) ?? false) ||
        (c.notas?.toLowerCase().includes(q) ?? false);
      const matchFiltro =
        filtro === "todos" ||
        (filtro === "contactos" && !c.es_cliente) ||
        (filtro === "clientes" && c.es_cliente) ||
        (filtro === "ofrecen" && c.tieneOferta) ||
        (filtro === "buscan" && c.tieneBusqueda) ||
        (filtro === "obra" && c.tieneObra) ||
        (filtro === "inactivos" && (!c.activo || c.etiqueta === "fallecido"));
      return matchSearch && matchFiltro;
    });
  }, [clientes, search, filtro]);

  useEffect(() => {
    if (narrow) return;
    if (pendingSelectedId) {
      if (filtered.some((c) => c.id === pendingSelectedId)) {
        setSelectedId(pendingSelectedId);
        setPendingSelectedId(null);
      }
      return;
    }
    if (filtered.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filtered.some((c) => c.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId, narrow, pendingSelectedId]);

  const selected = filtered.find((c) => c.id === selectedId) ?? null;
  const wa = selected ? telWhatsApp(selected.telefono) : null;

  const pasarACliente = async (id: string) => {
    const supabase = createClient();
    const { data, error: err } = await supabase.from("clientes").update({ es_cliente: true }).eq("id", id).select("id").maybeSingle();
    const aviso = mensajeGuardado(err, "No se ha podido pasar a cliente.", data);
    if (aviso) {
      setError(aviso);
      return;
    }
    setClientes((prev) => prev.map((fila) => (fila.id === id ? { ...fila, es_cliente: true } : fila)));
  };

  const rolesDe = (c: ClienteLista) => {
    const roles: Array<{ label: string; bg: string; fg: string }> = [];
    if (c.ofrece.length) roles.push({ label: "Ofrece", bg: "var(--accent-soft)", fg: "var(--foreground)" });
    if (c.busca.length) roles.push({ label: "Busca", bg: "var(--blue-bg)", fg: "var(--blue)" });
    if (c.docs.length) roles.push({ label: "Obra", bg: "var(--violet-bg)", fg: "var(--violet-ink)" });
    return roles;
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Contactos", href: "/clientes" }]}
        title="Contactos"
        description="La agenda. Quien busca, ofrece o tiene obra pasa a cliente; el resto sigue como contacto."
        hideActionsOnMobile
        actions={
          <Button type="button" size="sm" onClick={() => { setPadreInicial(undefined); setNuevaOpen(true); }} className="gap-2">
            <UserPlus className="h-4 w-4" strokeWidth={1.5} />
            {hayBorrador ? "Continuar borrador" : "Nuevo contacto"}
          </Button>
        }
      />

      {error ? <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <div className="mt-6 rounded-[14px] border border-dashed border-[var(--input)] px-4 py-16 text-center text-[13px] text-[var(--text-2)]">
          Cargando contactos…
        </div>
      ) : clientes.length === 0 ? (
        <div className="mt-6 rounded-[14px] border border-dashed border-[var(--input)] bg-white p-8 text-center">
          <p className="text-[var(--text-2)]">Aún no hay contactos.</p>
          <Button type="button" className="mt-4 gap-2" onClick={() => { setPadreInicial(undefined); setNuevaOpen(true); }}>
            <UserPlus className="h-4 w-4" strokeWidth={1.5} />
            {hayBorrador ? "Continuar borrador" : "Añadir primer contacto"}
          </Button>
        </div>
      ) : (
        <div className="mt-5 flex items-start gap-4">
          <section className="min-w-0 flex-[1_1_480px] overflow-hidden rounded-[14px] border border-border bg-[var(--surface)]">
            <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-soft)] px-3.5 py-3">
              <div className="relative min-w-0 flex-[1_1_180px]">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-2)]" strokeWidth={2.2} />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nombre, teléfono o nota"
                  className="h-9 w-full rounded-[9px] border border-[var(--input)] bg-transparent pl-9 pr-3 text-[13.5px] outline-none focus:border-accent"
                />
              </div>
              <CarrilHorizontal className="min-w-0 flex-[1_1_16rem]" trackClassName="gap-1.5" label="Filtros de contactos">
                {FILTROS_CLI.map((f) => (
                  <Chip key={f.id} active={filtro === f.id} onClick={() => setFiltro(f.id)}>
                    {f.label}
                  </Chip>
                ))}
              </CarrilHorizontal>
            </div>
            {filtered.length === 0 ? (
              <p className="px-4 py-9 text-center text-[13.5px] text-[var(--text-2)]">No hay contactos con ese filtro.</p>
            ) : (
              filtered.map((c) => {
                const est = estadoCliente(c);
                const active = c.id === selectedId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      "flex w-full items-center gap-3 border-b border-[var(--border-row)] px-3.5 py-2.5 text-left hover:bg-[var(--surface-soft)]",
                      active && "bg-[var(--row-active)] shadow-[inset_3px_0_0_var(--accent)]"
                    )}
                  >
                    <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-accent-soft text-[12px] font-semibold text-accent-dark">
                      {inicialesNombre(c.nombre)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">{c.nombre}</span>
                      <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px] text-[var(--text-2)]">
                        {c.creador ? (
                          <AvatarComercial
                            nombre={c.creador.nombre}
                            email={c.creador.email}
                            color={c.creador.color}
                            size={18}
                            title={`Creado por ${nombreYApellido(c.creador.nombre, c.creador.email) || c.creador.nombre}`}
                          />
                        ) : null}
                        {c.created_at ? <span className="shrink-0 tabular-nums">{fechaAlta(c.created_at)}</span> : null}
                        <span className="truncate">{contacto(c)}</span>
                      </span>
                      {c.notas?.trim() ? (
                        <span className="mt-0.5 block truncate text-[12px] text-[var(--text-3)]">{c.notas.trim()}</span>
                      ) : null}
                    </span>
                    <span className="hidden shrink-0 gap-1 min-[640px]:flex">
                      {rolesDe(c).map((r) => (
                        <span key={r.label} className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: r.bg, color: r.fg }}>
                          {r.label}
                        </span>
                      ))}
                    </span>
                    <span
                      className="shrink-0 rounded-md bg-[var(--surface-soft)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--foreground)]"
                      style={c.es_cliente ? { background: "var(--accent-soft)" } : undefined}
                    >
                      {c.es_cliente ? "Cliente" : "Contacto"}
                    </span>
                    <span className="flex w-[84px] shrink-0 items-center gap-1.5 text-[12.5px] text-[var(--text-2)]">
                      <span className="h-[7px] w-[7px] rounded-full" style={{ background: est.color }} />
                      {est.label}
                    </span>
                  </button>
                );
              })
            )}
          </section>

          {selected ? (
            <aside
              className={cn(
                "overflow-hidden rounded-[14px] border border-border bg-[var(--surface)]",
                narrow ? "fixed inset-0 z-[80] overflow-y-auto rounded-none pb-[var(--mobile-content-pb)]" : "sticky top-[72px] min-w-[300px] flex-[1_1_330px]"
              )}
            >
              <div className="flex items-center gap-3 px-5 pt-5">
                <span className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full bg-accent-soft text-[15px] font-semibold text-accent-dark">
                  {inicialesNombre(selected.nombre)}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[22px] font-medium leading-tight tracking-[-0.03em]">{selected.nombre}</h2>
                  <p className="mt-0.5 text-[12.5px] text-[var(--text-2)]">
                    {[selected.es_cliente ? "Cliente" : "Contacto", selected.tipo_documento?.toUpperCase(), selected.documento_fiscal]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-[12px] text-[var(--text-2)]">
                    {selected.creador ? (
                      <AvatarComercial
                        nombre={selected.creador.nombre}
                        email={selected.creador.email}
                        color={selected.creador.color}
                        size={18}
                        title={`Creado por ${nombreYApellido(selected.creador.nombre, selected.creador.email) || selected.creador.nombre}`}
                      />
                    ) : null}
                    <span className="truncate">
                      {[
                        selected.creador
                          ? nombreYApellido(selected.creador.nombre, selected.creador.email) || selected.creador.nombre
                          : null,
                        selected.created_at ? `alta ${fechaAlta(selected.created_at)}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </p>
                </div>
                {narrow ? (
                  <button type="button" onClick={() => setSelectedId(null)} className="grid h-[34px] w-[34px] place-items-center rounded-[9px] border border-border" aria-label="Cerrar">
                    <X className="h-4 w-4" strokeWidth={2.4} />
                  </button>
                ) : null}
              </div>
              <div className="mt-5 flex flex-wrap gap-2 px-5">
                {selected.telefono ? (
                  <a href={`tel:${selected.telefono}`} className="flex h-[38px] flex-[1_1_90px] items-center justify-center rounded-[9px] border border-[var(--input)] text-[13px] font-semibold">
                    Llamar
                  </a>
                ) : (
                  <span className="flex h-[38px] flex-[1_1_90px] items-center justify-center rounded-[9px] border border-[var(--input)] text-[13px] font-semibold text-[var(--text-3)]">
                    Llamar
                  </span>
                )}
                {wa ? (
                  <a href={wa} target="_blank" rel="noreferrer" className="flex h-[38px] flex-[1_1_90px] items-center justify-center rounded-[9px] border border-[var(--input)] text-[13px] font-semibold">
                    WhatsApp
                  </a>
                ) : (
                  <span className="flex h-[38px] flex-[1_1_90px] items-center justify-center rounded-[9px] border border-[var(--input)] text-[13px] font-semibold text-[var(--text-3)]">
                    WhatsApp
                  </span>
                )}
                <Link href={rutaNuevaCita({ clienteId: selected.id })} className="flex h-[38px] flex-[1_1_120px] items-center justify-center rounded-[9px] bg-accent text-[13px] font-medium text-accent-foreground hover:bg-accent-dark">
                  Nueva tarea
                </Link>
                <button
                  type="button"
                  onClick={() => setDemandaOpen(true)}
                  className="flex h-[38px] flex-[1_1_140px] items-center justify-center rounded-[9px] border border-[var(--input)] text-[13px] font-semibold"
                >
                  Nueva demanda
                </button>
              </div>
              {selected.es_cliente ? null : (
                <div className="mt-3 px-5">
                  <button
                    type="button"
                    onClick={() => void pasarACliente(selected.id)}
                    className="flex h-[38px] w-full items-center justify-center rounded-[9px] border border-[var(--input)] text-[13px] font-semibold"
                  >
                    Pasar a cliente
                  </button>
                </div>
              )}
              <div className="mt-5 px-5">
                <div className="text-[12px] text-[var(--text-3)]">Notas</div>
                <p className="mt-1.5 whitespace-pre-wrap text-[14px]">{selected.notas?.trim() || "Sin notas"}</p>
              </div>
              <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-5 px-5">
                <div>
                  <div className="text-[12px] text-[var(--text-3)]">Teléfono</div>
                  <div className="mt-1.5 text-[14px]">{selected.telefono || "—"}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-[12px] text-[var(--text-3)]">Email</div>
                  <div className="mt-1.5 truncate text-[14px]">{selected.email || "—"}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-[12px] text-[var(--text-3)]">Dirección</div>
                  <div className="mt-1.5 text-[14px]">
                    {[selected.direccion, selected.codigo_postal, selected.localidad].filter(Boolean).join(", ") || "—"}
                  </div>
                </div>
              </div>
              {[
                {
                  label: "Inmuebles que ofrece",
                  n: selected.ofrece.length,
                  items: selected.ofrece.map((p) => ({
                    id: p.id,
                    a: p.a,
                    b: p.b,
                    peek: { tipo: "propiedad" as const, id: p.id },
                  })),
                },
                {
                  label: "Demandas",
                  n: selected.busca.length,
                  items: selected.busca.map((d) => ({
                    id: d.id,
                    a: d.a,
                    b: d.b,
                    peek: { tipo: "demanda" as const, id: d.id },
                  })),
                },
                {
                  label: "Visitas",
                  n: selected.visitas.length,
                  items: selected.visitas.map((v) => ({
                    id: v.id,
                    a: v.a,
                    b: v.b,
                    peek: v.propiedad_id ? { tipo: "propiedad" as const, id: v.propiedad_id } : undefined,
                  })),
                },
                {
                  label: "Presupuestos y facturas",
                  n: selected.docs.length,
                  items: selected.docs.map((d) => ({ id: d.id, a: d.a, b: d.b, href: d.href })),
                },
              ].map((bloque) => (
                <div key={bloque.label} className="mt-8 px-5">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-[12px] font-medium text-[var(--text-3)]">{bloque.label}</h3>
                    <span className="text-[12px] text-[var(--text-2)]">{selected.detalleCargado ? bloque.n : "…"}</span>
                  </div>
                  {!selected.detalleCargado ? (
                    <p className="mt-1.5 text-[12.5px] text-[var(--text-3)]">Cargando…</p>
                  ) : bloque.items.length === 0 ? (
                    <p className="mt-1.5 text-[12.5px] text-[var(--text-3)]">Ninguno</p>
                  ) : (
                    bloque.items.map((item) => {
                      const inner = (
                        <>
                          <span className="min-w-0 truncate">{item.a}</span>
                          <span className="whitespace-nowrap tabular-nums text-[var(--text-2)]">{item.b}</span>
                        </>
                      );
                      const cls = "mt-1.5 flex w-full justify-between gap-2.5 text-[13px] hover:text-accent";
                      if ("peek" in item && item.peek) {
                        return (
                          <FichaLink key={item.id} tipo={item.peek.tipo} id={item.peek.id} className={cls}>
                            {inner}
                          </FichaLink>
                        );
                      }
                      if ("href" in item && item.href) {
                        return (
                          <Link key={item.id} href={item.href} className={cls}>
                            {inner}
                          </Link>
                        );
                      }
                      return (
                        <div key={item.id} className="mt-1.5 flex justify-between gap-2.5 text-[13px]">
                          {inner}
                        </div>
                      );
                    })
                  )}
                </div>
              ))}
              <div className="px-4 py-3">
                <Link href={`/clientes/${selected.id}`} className="text-[12.5px] font-medium text-accent hover:underline">
                  Abrir ficha completa
                </Link>
              </div>
            </aside>
          ) : null}
        </div>
      )}

      <Fab onClick={() => { setPadreInicial(undefined); setContactoInicial(undefined); setNuevaOpen(true); }} label={hayBorrador ? "Continuar borrador" : "Añadir contacto"} />
      <NuevaDemandaPanel
        open={demandaOpen && Boolean(selected)}
        onOpenChange={setDemandaOpen}
        clienteIdInicial={selected?.id}
        clienteNombre={selected?.nombre}
        onCreada={() => {
          if (selected) setPendingSelectedId(selected.id);
          setCargaKey((n) => n + 1);
        }}
      />
      <NuevoClientePanel
        open={nuevaOpen}
        onOpenChange={(open) => {
          setNuevaOpen(open);
          if (!open) {
            setPadreInicial(undefined);
            setContactoInicial(undefined);
          }
        }}
        padreId={padreInicial}
        contactoInicial={contactoInicial}
        onCreado={(id) => {
          setPendingSelectedId(id);
          setCargaKey((n) => n + 1);
        }}
      />
    </div>
  );
}
