"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Fab } from "@/components/ui/fab";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { UserPlus, Search, X } from "lucide-react";
import { inicialesNombre } from "@/lib/ui/tokens";
import { telWhatsApp } from "@/lib/ui/estados-vista";
import { cn } from "@/lib/utils";
import { FichaLink } from "@/components/crm/FichaPeek";
import { extraAlta } from "@/lib/ui/alta-panel";
import { NuevoClientePanel } from "@/components/clientes/NuevoClientePanel";

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
  ofrece: Array<{ id: string; a: string; b: string }>;
  busca: Array<{ id: string; a: string; b: string }>;
  visitas: Array<{ id: string; a: string; b: string; propiedad_id: string | null }>;
  docs: Array<{ id: string; a: string; b: string; href: string }>;
};

type FiltroCli = "todos" | "ofrecen" | "buscan" | "obra" | "inactivos";

function contacto(c: ClienteLista) {
  return [c.telefono, c.email].filter(Boolean).join(" · ") || "Sin contacto";
}

function estadoCliente(c: ClienteLista) {
  if (c.etiqueta === "fallecido") return { label: "Fallecido", color: "#B3ADA3" };
  if (!c.activo) return { label: "Inactivo", color: "#B3ADA3" };
  return { label: "Activo", color: "#0B7461" };
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
  const [padreInicial, setPadreInicial] = useState<string | undefined>();
  const [cargaKey, setCargaKey] = useState(0);
  const [pendingSelectedId, setPendingSelectedId] = useState<string | null>(null);

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
    setNuevaOpen(true);
    router.replace("/clientes", { scroll: false });
  }, [searchParams, router]);

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const { data, error: err } = await supabase
        .from("clientes")
        .select(
          "id, nombre, email, telefono, activo, etiqueta, tipo_cliente, documento_fiscal, tipo_documento, direccion, localidad, codigo_postal"
        )
        .order("created_at", { ascending: false });
      if (err) {
        setError(err.message);
        setClientes([]);
        setLoading(false);
        return;
      }
      const base = (data ?? []) as Omit<ClienteLista, "ofrece" | "busca" | "visitas" | "docs">[];
      const ids = base.map((c) => c.id);
      if (ids.length === 0) {
        setClientes([]);
        setLoading(false);
        return;
      }
      const [props, demandas, presupuestos, facturas, citas] = await Promise.all([
        supabase.from("propiedades").select("id, ofertante_id, titulo, direccion, referencia, estado").in("ofertante_id", ids),
        supabase.from("demandas").select("id, cliente_id, tipo_operacion, estado, zonas").in("cliente_id", ids),
        supabase.from("presupuestos").select("id, cliente_id, numero, estado, total").in("cliente_id", ids),
        supabase.from("facturas").select("id, cliente_id, numero, estado, total").in("cliente_id", ids),
        supabase.from("citas").select("id, cliente_id, titulo, empieza, estado, propiedad_id").eq("tipo", "visita").in("cliente_id", ids),
      ]);
      const byCliente = (rows: Array<{ cliente_id?: string | null; ofertante_id?: string | null }> | null, key: "cliente_id" | "ofertante_id") => {
        const map = new Map<string, typeof rows>();
        for (const row of rows ?? []) {
          const id = row[key];
          if (!id) continue;
          const list = map.get(id) ?? [];
          list.push(row);
          map.set(id, list);
        }
        return map;
      };
      const propsMap = byCliente(props.data as Array<{ ofertante_id: string | null }>, "ofertante_id");
      const demMap = byCliente(demandas.data as Array<{ cliente_id: string | null }>, "cliente_id");
      const preMap = byCliente(presupuestos.data as Array<{ cliente_id: string | null }>, "cliente_id");
      const facMap = byCliente(facturas.data as Array<{ cliente_id: string | null }>, "cliente_id");
      const citMap = byCliente(citas.data as Array<{ cliente_id: string | null }>, "cliente_id");

      setClientes(
        base.map((c) => {
          const inmuebles = (propsMap.get(c.id) ?? []) as Array<{
            id: string;
            titulo: string | null;
            direccion: string | null;
            referencia: string | null;
            estado: string;
          }>;
          const dems = (demMap.get(c.id) ?? []) as Array<{
            id: string;
            tipo_operacion: string;
            estado: string;
            zonas: string[] | null;
          }>;
          const pres = (preMap.get(c.id) ?? []) as Array<{
            id: string;
            numero: string;
            estado: string;
            total: number | null;
          }>;
          const facs = (facMap.get(c.id) ?? []) as Array<{
            id: string;
            numero: string;
            estado: string;
            total: number | null;
          }>;
          const vis = (citMap.get(c.id) ?? []) as Array<{
            id: string;
            titulo: string;
            empieza: string;
            estado: string;
            propiedad_id: string | null;
          }>;
          return {
            ...c,
            ofrece: inmuebles.slice(0, 3).map((p) => ({
              id: p.id,
              a: p.referencia || p.titulo || p.direccion || "Inmueble",
              b: p.estado,
            })),
            busca: dems.slice(0, 3).map((d) => ({
              id: d.id,
              a: d.tipo_operacion,
              b: d.zonas?.[0] ?? d.estado,
            })),
            visitas: vis.slice(0, 3).map((v) => ({
              id: v.id,
              a: v.titulo,
              b: v.empieza.slice(0, 10),
              propiedad_id: v.propiedad_id,
            })),
            docs: [
              ...pres.slice(0, 2).map((p) => ({
                id: p.id,
                a: p.numero,
                b: p.estado,
                href: `/presupuestos/${p.id}`,
              })),
              ...facs.slice(0, 2).map((f) => ({
                id: f.id,
                a: f.numero,
                b: f.estado,
                href: `/facturas/${f.id}`,
              })),
            ],
          };
        })
      );
      setLoading(false);
    })();
  }, [cargaKey]);

  const filtered = useMemo(() => {
    return clientes.filter((c) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        c.nombre.toLowerCase().includes(q) ||
        (c.email?.toLowerCase().includes(q) ?? false) ||
        (c.telefono?.includes(q) ?? false);
      const matchFiltro =
        filtro === "todos" ||
        (filtro === "ofrecen" && c.ofrece.length > 0) ||
        (filtro === "buscan" && c.busca.length > 0) ||
        (filtro === "obra" && c.docs.length > 0) ||
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

  const rolesDe = (c: ClienteLista) => {
    const roles: Array<{ label: string; bg: string; fg: string }> = [];
    if (c.ofrece.length) roles.push({ label: "Ofrece", bg: "#E8F3EF", fg: "#08594B" });
    if (c.busca.length) roles.push({ label: "Busca", bg: "#E9EEF8", fg: "#2B4A8A" });
    if (c.docs.length) roles.push({ label: "Obra", bg: "#F1EFF8", fg: "#4B3F8A" });
    return roles;
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Clientes", href: "/clientes" }]}
        title="Clientes"
        description="Ofertantes y demandantes. Cada ficha reúne inmuebles, demandas, visitas y facturas."
        actions={
          <Button type="button" size="sm" onClick={() => { setPadreInicial(undefined); setNuevaOpen(true); }} className="gap-2">
            <UserPlus className="h-4 w-4" strokeWidth={1.5} />
            Nuevo cliente
          </Button>
        }
      />

      {error ? <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <div className="mt-6 rounded-[14px] border border-dashed border-[var(--input)] px-4 py-16 text-center text-[13px] text-[var(--text-2)]">
          Cargando clientes…
        </div>
      ) : clientes.length === 0 ? (
        <div className="mt-6 rounded-[14px] border border-dashed border-[var(--input)] bg-white p-8 text-center">
          <p className="text-[var(--text-2)]">Aún no hay clientes.</p>
          <Button type="button" className="mt-4 gap-2" onClick={() => { setPadreInicial(undefined); setNuevaOpen(true); }}>
            <UserPlus className="h-4 w-4" strokeWidth={1.5} />
            Añadir primer cliente
          </Button>
        </div>
      ) : (
        <div className="mt-5 flex items-start gap-4">
          <section className="min-w-0 flex-[1_1_480px] overflow-hidden rounded-[14px] border border-border bg-white">
            <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-soft)] px-3.5 py-3">
              <div className="relative min-w-0 flex-[1_1_180px]">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-2)]" strokeWidth={2.2} />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nombre, email o teléfono"
                  className="h-9 w-full rounded-[9px] border border-[var(--input)] bg-transparent pl-9 pr-3 text-[13.5px] outline-none focus:border-accent"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(["todos", "ofrecen", "buscan", "obra", "inactivos"] as const).map((f) => (
                  <Chip key={f} active={filtro === f} onClick={() => setFiltro(f)}>
                    {f === "todos" ? "Todos" : f === "ofrecen" ? "Ofrecen" : f === "buscan" ? "Buscan" : f === "obra" ? "Obra" : "Inactivos"}
                  </Chip>
                ))}
              </div>
            </div>
            {filtered.length === 0 ? (
              <p className="px-4 py-9 text-center text-[13.5px] text-[var(--text-2)]">No hay clientes con ese filtro.</p>
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
                      <span className="mt-0.5 block truncate text-[12px] text-[var(--text-2)]">{contacto(c)}</span>
                    </span>
                    <span className="hidden shrink-0 gap-1 min-[640px]:flex">
                      {rolesDe(c).map((r) => (
                        <span key={r.label} className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: r.bg, color: r.fg }}>
                          {r.label}
                        </span>
                      ))}
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
                "overflow-hidden rounded-[14px] border border-border bg-white",
                narrow ? "fixed inset-0 z-50 rounded-none overflow-y-auto" : "sticky top-[72px] min-w-[300px] flex-[1_1_330px]"
              )}
            >
              <div className="flex items-center gap-3 border-b border-[var(--border-soft)] px-4 py-4">
                <span className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full bg-accent-soft text-[15px] font-semibold text-accent-dark">
                  {inicialesNombre(selected.nombre)}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[18px] font-semibold tracking-tight">{selected.nombre}</h2>
                  <p className="mt-0.5 text-[12.5px] text-[var(--text-2)]">
                    {[selected.tipo_documento?.toUpperCase(), selected.documento_fiscal, selected.tipo_cliente]
                      .filter(Boolean)
                      .join(" · ") || selected.tipo_cliente}
                  </p>
                </div>
                {narrow ? (
                  <button type="button" onClick={() => setSelectedId(null)} className="grid h-[34px] w-[34px] place-items-center rounded-[9px] border border-border" aria-label="Cerrar">
                    <X className="h-4 w-4" strokeWidth={2.4} />
                  </button>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2 border-b border-[var(--border-soft)] px-4 py-3">
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
                <Link href="/tareas" className="flex h-[38px] flex-[1_1_90px] items-center justify-center rounded-[9px] bg-accent text-[13px] font-semibold text-white hover:bg-accent-dark">
                  Tarea
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-2.5 border-b border-[var(--border-soft)] px-4 py-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[.07em] text-[var(--label)]">Teléfono</div>
                  <div className="mt-0.5 text-[13.5px]">{selected.telefono || "—"}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-[.07em] text-[var(--label)]">Email</div>
                  <div className="mt-0.5 truncate text-[13.5px]">{selected.email || "—"}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-[11px] uppercase tracking-[.07em] text-[var(--label)]">Dirección</div>
                  <div className="mt-0.5 text-[13.5px]">
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
                <div key={bloque.label} className="border-b border-[var(--border-row)] px-4 py-2.5">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-[13px] font-semibold">{bloque.label}</h3>
                    <span className="text-[12px] text-[var(--text-2)]">{bloque.n}</span>
                  </div>
                  {bloque.items.length === 0 ? (
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

      <Fab onClick={() => { setPadreInicial(undefined); setNuevaOpen(true); }} label="Añadir cliente" />
      <NuevoClientePanel
        open={nuevaOpen}
        onOpenChange={(open) => {
          setNuevaOpen(open);
          if (!open) setPadreInicial(undefined);
        }}
        padreId={padreInicial}
        onCreado={(id) => {
          setPendingSelectedId(id);
          setCargaKey((n) => n + 1);
        }}
      />
    </div>
  );
}
