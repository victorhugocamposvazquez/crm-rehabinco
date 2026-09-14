"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Fab } from "@/components/ui/fab";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Plus, Search, Trash2, ListChecks, Download } from "lucide-react";
import { toast } from "sonner";
import { relacionUno } from "@/lib/citas/citas";
import { colorEstado, formatEuro, formatFechaCorta } from "@/lib/ui/estados-vista";
import { cn } from "@/lib/utils";

type EstadoFactura = "borrador" | "emitida" | "pagada";

type FacturaLista = {
  id: string;
  numero: string;
  clienteNombre: string;
  concepto: string | null;
  fecha: string | null;
  total: number;
  estado: EstadoFactura;
  tipoFactura: "ordinaria" | "rectificativa";
};

const ESTADOS: EstadoFactura[] = ["borrador", "emitida", "pagada"];

export default function FacturasPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const estadoFromUrl = searchParams.get("estado") as EstadoFactura | null;
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState<"todos" | EstadoFactura>(
    estadoFromUrl && ESTADOS.includes(estadoFromUrl) ? estadoFromUrl : "todos"
  );
  const [filterTipo, setFilterTipo] = useState<"todas" | "ordinaria" | "rectificativa">("todas");
  const [facturas, setFacturas] = useState<FacturaLista[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelectId = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("facturas")
      .select("id, numero, estado, cliente_id, total, tipo_factura, concepto, fecha_emision, clientes(nombre)")
      .order("created_at", { ascending: false })
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message);
          setFacturas([]);
          setLoading(false);
          return;
        }
        setFacturas(
          ((data ?? []) as Array<{
            id: string;
            numero: string;
            estado: string;
            total?: number | null;
            tipo_factura?: "ordinaria" | "rectificativa" | null;
            concepto?: string | null;
            fecha_emision?: string | null;
            clientes: { nombre: string } | { nombre: string }[] | null;
          }>).map((row) => ({
            id: row.id,
            numero: row.numero,
            clienteNombre: relacionUno(row.clientes)?.nombre ?? "—",
            concepto: row.concepto ?? null,
            fecha: row.fecha_emision ?? null,
            total: Number(row.total ?? 0),
            estado: row.estado as EstadoFactura,
            tipoFactura: row.tipo_factura ?? "ordinaria",
          }))
        );
        setLoading(false);
      });
  }, []);

  const filteredFacturas = useMemo(() => {
    return facturas.filter((f) => {
      const q = search.toLowerCase().trim();
      const matchSearch = !q || f.numero.toLowerCase().includes(q) || f.clienteNombre.toLowerCase().includes(q);
      return (
        matchSearch &&
        (filterEstado === "todos" || f.estado === filterEstado) &&
        (filterTipo === "todas" || f.tipoFactura === filterTipo)
      );
    });
  }, [facturas, search, filterEstado, filterTipo]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { todos: facturas.length };
    for (const e of ESTADOS) map[e] = facturas.filter((f) => f.estado === e).length;
    return map;
  }, [facturas]);

  const kpis = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const facturadoMes = facturas
      .filter((f) => f.estado === "pagada" && (f.fecha ?? "").startsWith(ym) && f.tipoFactura !== "rectificativa")
      .reduce((s, f) => s + f.total, 0);
    const pendiente = facturas.filter((f) => f.estado === "emitida").reduce((s, f) => s + f.total, 0);
    const emitidasSinCobrar = facturas.filter((f) => f.estado === "emitida").length;
    const borradores = facturas.filter((f) => f.estado === "borrador").length;
    return [
      { valor: formatEuro(facturadoMes, { fraction: 0 }), label: "Facturado este mes", fg: "#0B7461" },
      { valor: formatEuro(pendiente, { fraction: 0 }), label: "Pendiente de cobro", fg: "#B98A16" },
      { valor: String(emitidasSinCobrar), label: "Emitidas sin cobrar", fg: "#131C1A" },
      { valor: String(borradores), label: "Borradores", fg: "#8A938F" },
    ];
  }, [facturas]);

  const selectAllVisible = useCallback(() => {
    setSelectedIds(new Set(filteredFacturas.map((f) => f.id)));
  }, [filteredFacturas]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkDeleting(true);
    const supabase = createClient();
    const { error: delErr } = await supabase.from("facturas").delete().in("id", ids);
    setBulkDeleting(false);
    if (delErr) {
      toast.error(delErr.message);
      return;
    }
    setFacturas((prev) => prev.filter((f) => !ids.includes(f.id)));
    exitSelectionMode();
    setBulkDeleteOpen(false);
    toast.success(ids.length === 1 ? "1 factura eliminada" : `${ids.length} facturas eliminadas`);
    router.refresh();
  };

  const labelEstado = (f: FacturaLista) =>
    f.tipoFactura === "rectificativa" && f.estado === "emitida" ? "Emitida · Rectificativa" : f.estado;

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Facturas", href: "/facturas" }]}
        title="Facturas"
        description="Gestiona facturas y cobros"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {!loading && facturas.length > 0 ? (
              <Button
                type="button"
                variant={selectionMode ? "default" : "secondary"}
                size="sm"
                onClick={() => (selectionMode ? exitSelectionMode() : setSelectionMode(true))}
                className="gap-2"
              >
                <ListChecks className="h-4 w-4" strokeWidth={1.5} />
                {selectionMode ? "Cancelar selección" : "Seleccionar"}
              </Button>
            ) : null}
            <Button asChild size="sm">
              <Link href="/facturas/nueva" className="gap-2">
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                Crear factura
              </Link>
            </Button>
          </div>
        }
      />

      {error ? <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {!loading && facturas.length > 0 ? (
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

      {!loading && facturas.length > 0 && selectionMode ? (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border bg-[var(--surface-soft)] p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--text-2)]">
            <span className="font-medium text-foreground">{selectedIds.size}</span> seleccionada
            {selectedIds.size !== 1 ? "s" : ""}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={selectAllVisible} disabled={filteredFacturas.length === 0}>
              Seleccionar todas
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={clearSelection} disabled={selectedIds.size === 0}>
              Quitar selección
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setBulkDeleteOpen(true)}
              disabled={selectedIds.size === 0}
              className="gap-1.5 border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
              Eliminar
            </Button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6 rounded-[14px] border border-dashed border-[var(--input)] px-4 py-16 text-center text-[13px] text-[var(--text-2)]">
          Cargando facturas…
        </div>
      ) : facturas.length === 0 ? (
        <div className="mt-6 rounded-[14px] border border-dashed border-[var(--input)] bg-white p-8 text-center">
          <p className="text-[var(--text-2)]">Aún no hay facturas.</p>
          <Button asChild className="mt-4">
            <Link href="/facturas/nueva" className="gap-2">
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              Crear primera factura
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
                Todas
              </Chip>
              {ESTADOS.map((e) => (
                <Chip key={e} active={filterEstado === e} count={counts[e]} onClick={() => setFilterEstado(e)}>
                  {e.charAt(0).toUpperCase() + e.slice(1)}
                </Chip>
              ))}
              {(["todas", "ordinaria", "rectificativa"] as const).map((t) => (
                <Chip key={t} active={filterTipo === t} onClick={() => setFilterTipo(t)}>
                  {t === "todas" ? "Tipo" : t.charAt(0).toUpperCase() + t.slice(1)}
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
          {filteredFacturas.length === 0 ? (
            <p className="px-4 py-9 text-center text-[13.5px] text-[var(--text-2)]">No hay facturas con ese filtro.</p>
          ) : (
            filteredFacturas.map((f) => {
              const total = f.tipoFactura === "rectificativa" ? -Math.abs(f.total) : f.total;
              return (
                <div
                  key={f.id}
                  className={cn(
                    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--border-row)] px-3.5 py-2.5 hover:bg-[var(--surface-soft)] min-[820px]:grid-cols-[112px_minmax(0,2fr)_92px_110px_118px_34px]",
                    selectionMode && selectedIds.has(f.id) && "bg-[var(--row-active)]"
                  )}
                >
                  {selectionMode ? (
                    <label className="flex items-center gap-2 font-mono text-[12.5px] font-medium">
                      <input type="checkbox" checked={selectedIds.has(f.id)} onChange={() => toggleSelectId(f.id)} />
                      {f.numero}
                    </label>
                  ) : (
                    <Link href={`/facturas/${f.id}`} className="font-mono text-[12.5px] font-medium">
                      {f.numero}
                    </Link>
                  )}
                  <Link href={`/facturas/${f.id}`} className="min-w-0">
                    <div className="truncate text-[14px] font-semibold">{f.clienteNombre}</div>
                    <div className="mt-px truncate text-[12px] text-[var(--text-2)]">{f.concepto || "Factura"}</div>
                  </Link>
                  <div className="hidden text-[13px] tabular-nums text-[var(--text-2)] min-[820px]:block">{formatFechaCorta(f.fecha)}</div>
                  <div
                    className={cn("text-right text-[14px] font-semibold tabular-nums", total < 0 && "text-[var(--red)]")}
                  >
                    {formatEuro(total, { fraction: 2 })}
                  </div>
                  <div className="hidden items-center gap-1.5 whitespace-nowrap text-[12.5px] min-[820px]:flex" style={{ color: colorEstado(f.estado) }}>
                    <span className="h-[7px] w-[7px] rounded-full" style={{ background: colorEstado(f.estado) }} />
                    {labelEstado(f)}
                  </div>
                  <Link
                    href={`/facturas/${f.id}`}
                    title="Abrir factura"
                    className="hidden h-[30px] w-[30px] items-center justify-center rounded-lg border border-border text-[var(--text-2)] hover:border-accent hover:text-accent min-[820px]:grid"
                  >
                    <Download className="h-3.5 w-3.5" strokeWidth={2} />
                  </Link>
                </div>
              );
            })
          )}
        </section>
      )}

      <AlertDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`¿Eliminar ${selectedIds.size} factura${selectedIds.size !== 1 ? "s" : ""}?`}
        description="Se eliminarán de forma permanente, incluidas las líneas y los pagos asociados. Esta acción no se puede deshacer."
        confirmLabel={bulkDeleting ? "Eliminando…" : "Eliminar definitivamente"}
        onConfirm={handleBulkDelete}
        loading={bulkDeleting}
        variant="destructive"
      />

      <Fab href="/facturas/nueva" label="Nueva factura" />
    </div>
  );
}
