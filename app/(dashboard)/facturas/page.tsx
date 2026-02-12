"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { FacturaCard } from "@/components/facturas/FacturaCard";
import { FacturaListSkeleton } from "@/components/facturas/FacturaListSkeleton";
import { PageHeader } from "@/components/layout/PageHeader";
import { Fab } from "@/components/ui/fab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";

interface FacturaRow {
  id: string;
  numero: string;
  estado: string;
  cliente_id: string | null;
  total?: number | null;
  clientes: { nombre: string } | { nombre: string }[] | null;
}

export default function FacturasPage() {
  const searchParams = useSearchParams();
  const estadoFromUrl = searchParams.get("estado") as "borrador" | "emitida" | "pagada" | null;
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState<"todos" | "borrador" | "emitida" | "pagada">(
    estadoFromUrl && ["borrador", "emitida", "pagada"].includes(estadoFromUrl) ? estadoFromUrl : "todos"
  );
  const [facturas, setFacturas] = useState<Array<{
    id: string;
    numero: string;
    clienteNombre: string;
    importe: string;
    estado: "borrador" | "emitida" | "pagada";
  }>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("facturas")
      .select("id, numero, estado, cliente_id, total, clientes(nombre)")
      .order("created_at", { ascending: false })
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message);
          setFacturas([]);
          setLoading(false);
          return;
        }
        const rows = (data ?? []) as FacturaRow[];
        Promise.all(
          rows.map(async (row) => {
            const cliente = Array.isArray(row.clientes)
              ? (row.clientes[0] ?? null)
              : row.clientes;
            return {
              id: row.id,
              numero: row.numero,
              clienteNombre: cliente?.nombre ?? "—",
              importe: Number(row.total ?? 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €",
              estado: row.estado as "borrador" | "emitida" | "pagada",
            };
          })
        ).then(setFacturas);
        setLoading(false);
      });
  }, []);

  const filteredFacturas = useMemo(() => {
    return facturas.filter((f) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        f.numero.toLowerCase().includes(q) ||
        f.clienteNombre.toLowerCase().includes(q);
      const matchEstado =
        filterEstado === "todos" || f.estado === filterEstado;
      return matchSearch && matchEstado;
    });
  }, [facturas, search, filterEstado]);

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Facturas", href: "/facturas" }]}
        title="Facturas"
        description="Gestiona facturas y cobros"
        actions={
          <Button asChild size="sm">
            <Link href="/facturas/nueva" className="gap-2">
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              Crear factura
            </Link>
          </Button>
        }
      />

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {!loading && facturas.length > 0 && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" strokeWidth={1.5} aria-hidden />
            <Input
              type="search"
              placeholder="Buscar por número o cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              aria-label="Buscar facturas"
            />
          </div>
          <div className="flex flex-wrap gap-1 rounded-lg border border-border p-1">
            {(["todos", "borrador", "emitida", "pagada"] as const).map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setFilterEstado(e)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  filterEstado === e
                    ? "bg-foreground text-background"
                    : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {e === "todos" ? "Todas" : e.charAt(0).toUpperCase() + e.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-10">
        {loading ? (
          <FacturaListSkeleton />
        ) : facturas.length === 0 && !error ? (
          <div className="rounded-2xl border border-dashed border-border bg-white p-8 text-center">
            <p className="text-neutral-500">Aún no hay facturas.</p>
            <Button asChild className="mt-4">
              <Link href="/facturas/nueva" className="gap-2">
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                Crear primera factura
              </Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredFacturas.length === 0 ? (
              <p className="rounded-2xl border border-border bg-white p-6 text-center text-neutral-500">
                No hay facturas que coincidan con la búsqueda.
              </p>
            ) : (
              filteredFacturas.map((f) => (
                <FacturaCard
                  key={f.id}
                  id={f.id}
                  numero={f.numero}
                  clienteNombre={f.clienteNombre}
                  importe={f.importe}
                  estado={f.estado}
                  onDeleted={() => setFacturas((prev) => prev.filter((x) => x.id !== f.id))}
                />
              )))}
          </div>
        )}
      </div>

      <Fab href="/facturas/nueva" label="Nueva factura" />
    </div>
  );
}
