"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Fab } from "@/components/ui/fab";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Plus, ClipboardList, Search, Download } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { isEditor } from "@/lib/auth/roles";
import { colorEstado, formatEuro, formatFechaCorta } from "@/lib/ui/estados-vista";
import { relacionUno } from "@/lib/citas/citas";

type EstadoPresupuesto = "borrador" | "enviado" | "aceptado" | "rechazado" | "convertido";

type Row = {
  id: string;
  numero: string;
  clienteNombre: string;
  concepto: string | null;
  fecha: string | null;
  total: number;
  estado: EstadoPresupuesto;
};

const ESTADOS: EstadoPresupuesto[] = ["borrador", "enviado", "aceptado", "rechazado", "convertido"];

export default function PresupuestosPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState<"todos" | EstadoPresupuesto>("todos");
  const [presupuestos, setPresupuestos] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("presupuestos")
      .select("id, numero, estado, total, concepto, fecha, clientes(nombre)")
      .order("created_at", { ascending: false })
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message);
          setPresupuestos([]);
          setLoading(false);
          return;
        }
        setPresupuestos(
          ((data ?? []) as Array<{
            id: string;
            numero: string;
            estado: string;
            total?: number | null;
            concepto?: string | null;
            fecha?: string | null;
            clientes: { nombre: string } | { nombre: string }[] | null;
          }>).map((r) => ({
            id: r.id,
            numero: r.numero,
            clienteNombre: relacionUno(r.clientes)?.nombre ?? "—",
            concepto: r.concepto ?? null,
            fecha: r.fecha ?? null,
            total: Number(r.total ?? 0),
            estado: r.estado as EstadoPresupuesto,
          }))
        );
        setLoading(false);
      });
  }, []);

  const counts = useMemo(() => {
    const map: Record<string, number> = { todos: presupuestos.length };
    for (const e of ESTADOS) map[e] = presupuestos.filter((p) => p.estado === e).length;
    return map;
  }, [presupuestos]);

  const kpis = useMemo(() => {
    const enviados = presupuestos.filter((p) => p.estado === "enviado").length;
    const negociacion = enviados;
    const aceptadosSinFacturar = presupuestos.filter((p) => p.estado === "aceptado").length;
    const decididos = presupuestos.filter((p) => p.estado !== "borrador").length;
    const ganados = presupuestos.filter((p) => p.estado === "aceptado" || p.estado === "convertido").length;
    const tasa = decididos ? Math.round((ganados / decididos) * 100) : 0;
    return [
      { valor: String(enviados), label: "Enviados", fg: "#131C1A" },
      { valor: String(negociacion), label: "En negociación", fg: "#B98A16" },
      { valor: String(aceptadosSinFacturar), label: "Aceptados sin facturar", fg: "#0B7461" },
      { valor: `${tasa} %`, label: "Tasa de aceptación", fg: "#131C1A" },
    ];
  }, [presupuestos]);

  const filtered = useMemo(() => {
    return presupuestos.filter((p) => {
      const q = search.toLowerCase().trim();
      const matchSearch = !q || p.numero.toLowerCase().includes(q) || p.clienteNombre.toLowerCase().includes(q);
      return matchSearch && (filterEstado === "todos" || p.estado === filterEstado);
    });
  }, [presupuestos, search, filterEstado]);

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Presupuestos", href: "/presupuestos" }]}
        title="Presupuestos"
        description={
          isEditor(user?.role)
            ? "Crea y gestiona presupuestos de Garal"
            : "Gestiona presupuestos y conviértelos en facturas"
        }
        actions={
          <Button asChild size="sm">
            <Link href="/presupuestos/nuevo" className="gap-2">
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              Crear presupuesto
            </Link>
          </Button>
        }
      />

      {error ? <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {!loading && presupuestos.length > 0 ? (
        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-xl border border-border bg-white px-[15px] py-3">
              <div className="text-[22px] font-semibold tabular-nums tracking-tight" style={{ color: k.fg }}>
                {k.valor}
              </div>
              <div className="mt-0.5 text-[12.5px] text-[var(--text-2)]">{k.label}</div>
            </div>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6 rounded-[14px] border border-dashed border-[var(--input)] px-4 py-16 text-center text-[13px] text-[var(--text-2)]">
          Cargando presupuestos…
        </div>
      ) : presupuestos.length === 0 ? (
        <div className="mt-6 rounded-[14px] border border-dashed border-[var(--input)] bg-white p-8 text-center">
          <p className="text-[var(--text-2)]">Aún no hay presupuestos.</p>
          <Button asChild className="mt-4">
            <Link href="/presupuestos/nuevo" className="gap-2">
              <ClipboardList className="h-4 w-4" strokeWidth={1.5} />
              Crear primer presupuesto
            </Link>
          </Button>
        </div>
      ) : (
        <section className="mt-4 overflow-hidden rounded-[14px] border border-border bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-soft)] px-3.5 py-3">
            <div className="relative min-w-0 flex-[1_1_180px]">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-2)]" strokeWidth={2.2} />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Número o cliente"
                className="h-9 w-full rounded-[9px] border border-[var(--input)] bg-transparent pl-9 pr-3 text-[13.5px] outline-none focus:border-accent"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Chip active={filterEstado === "todos"} count={counts.todos} onClick={() => setFilterEstado("todos")}>
                Todos
              </Chip>
              {ESTADOS.map((e) => (
                <Chip key={e} active={filterEstado === e} count={counts[e]} onClick={() => setFilterEstado(e)}>
                  {e.charAt(0).toUpperCase() + e.slice(1)}
                </Chip>
              ))}
            </div>
          </div>
          <div className="hidden grid-cols-[112px_minmax(0,2fr)_92px_110px_118px_34px] gap-3 border-b border-[var(--border-soft)] bg-[var(--surface-soft)] px-3.5 py-2 text-[11px] uppercase tracking-[.06em] text-[var(--label)] min-[820px]:grid">
            <div>Número</div>
            <div>Cliente</div>
            <div>Fecha</div>
            <div className="text-right">Total</div>
            <div>Estado</div>
            <div />
          </div>
          {filtered.length === 0 ? (
            <p className="px-4 py-9 text-center text-[13.5px] text-[var(--text-2)]">No hay presupuestos con ese filtro.</p>
          ) : (
            filtered.map((p) => (
              <Link
                key={p.id}
                href={`/presupuestos/${p.id}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--border-row)] px-3.5 py-2.5 hover:bg-[var(--surface-soft)] min-[820px]:grid-cols-[112px_minmax(0,2fr)_92px_110px_118px_34px]"
              >
                <div className="font-mono text-[12.5px] font-medium">{p.numero}</div>
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold">{p.clienteNombre}</div>
                  <div className="mt-px truncate text-[12px] text-[var(--text-2)]">{p.concepto || "Presupuesto"}</div>
                </div>
                <div className="hidden text-[13px] tabular-nums text-[var(--text-2)] min-[820px]:block">{formatFechaCorta(p.fecha)}</div>
                <div className="text-right text-[14px] font-semibold tabular-nums">{formatEuro(p.total, { fraction: 2 })}</div>
                <div className="hidden items-center gap-1.5 text-[12.5px] min-[820px]:flex" style={{ color: colorEstado(p.estado) }}>
                  <span className="h-[7px] w-[7px] rounded-full" style={{ background: colorEstado(p.estado) }} />
                  {p.estado}
                </div>
                <span className="hidden h-[30px] w-[30px] items-center justify-center rounded-lg border border-border text-[var(--text-2)] min-[820px]:grid">
                  <Download className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
              </Link>
            ))
          )}
        </section>
      )}

      <Fab href="/presupuestos/nuevo" label="Nuevo presupuesto" />
    </div>
  );
}
