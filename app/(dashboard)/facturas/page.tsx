"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { FacturaCard } from "@/components/facturas/FacturaCard";
import { FacturaListSkeleton } from "@/components/facturas/FacturaListSkeleton";
import { Fab } from "@/components/ui/fab";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface FacturaRow {
  id: string;
  numero: string;
  estado: string;
  cliente_id: string | null;
  total?: number | null;
  clientes: { nombre: string } | { nombre: string }[] | null;
}

export default function FacturasPage() {
  const [loading, setLoading] = useState(true);
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

  return (
    <div className="animate-[fadeIn_0.3s_ease-out]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
        CRM / Facturas
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-[2.2rem]">
            Facturas
          </h1>
          <p className="mt-2 max-w-2xl text-base text-neutral-600">
            Gestiona facturas y cobros
          </p>
        </div>
        <Button asChild size="sm" className="shrink-0">
          <Link href="/facturas/nueva" className="gap-2">
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            Crear factura
          </Link>
        </Button>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-10">
        {loading ? (
          <FacturaListSkeleton />
        ) : facturas.length === 0 && !error ? (
          <p className="rounded-2xl border border-dashed border-border bg-white p-6 text-neutral-500">
            Aún no hay facturas. Crea la primera con el botón +.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {facturas.map((f) => (
              <FacturaCard
                key={f.id}
                id={f.id}
                numero={f.numero}
                clienteNombre={f.clienteNombre}
                importe={f.importe}
                estado={f.estado}
              />
            ))}
          </div>
        )}
      </div>

      <Fab href="/facturas/nueva" label="Nueva factura" />
    </div>
  );
}
