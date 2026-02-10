"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { FacturaCard } from "@/components/facturas/FacturaCard";
import { FacturaListSkeleton } from "@/components/facturas/FacturaListSkeleton";
import { Fab } from "@/components/ui/fab";

interface FacturaRow {
  id: string;
  numero: string;
  estado: string;
  cliente_id: string | null;
  clientes: { nombre: string } | { nombre: string }[] | null;
}

interface FacturaLineaTotal {
  cantidad: number;
  precio_unitario: number;
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
      .select("id, numero, estado, cliente_id, clientes(nombre)")
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
            const { data: lineas } = await supabase
              .from("factura_lineas")
              .select("cantidad, precio_unitario")
              .eq("factura_id", row.id);
            const total = ((lineas ?? []) as FacturaLineaTotal[]).reduce(
              (acc, l) => acc + Number(l.cantidad) * Number(l.precio_unitario),
              0
            );
            const cliente = Array.isArray(row.clientes)
              ? (row.clientes[0] ?? null)
              : row.clientes;
            return {
              id: row.id,
              numero: row.numero,
              clienteNombre: cliente?.nombre ?? "—",
              importe: total.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €",
              estado: row.estado as "borrador" | "emitida" | "pagada",
            };
          })
        ).then(setFacturas);
        setLoading(false);
      });
  }, []);

  return (
    <div className="animate-[fadeIn_0.3s_ease-out]">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Facturas
      </h1>
      <p className="mt-1 text-base text-neutral-600">
        Gestiona facturas y cobros
      </p>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-8">
        {loading ? (
          <FacturaListSkeleton />
        ) : facturas.length === 0 && !error ? (
          <p className="text-neutral-500">Aún no hay facturas. Crea la primera con el botón +.</p>
        ) : (
          <div className="space-y-3">
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
