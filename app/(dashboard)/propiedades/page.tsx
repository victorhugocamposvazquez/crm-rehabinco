"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Fab } from "@/components/ui/fab";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Building2 } from "lucide-react";

export default function PropiedadesPage() {
  const [loading, setLoading] = useState(true);
  const [propiedades, setPropiedades] = useState<
    Array<{
      id: string;
      titulo: string | null;
      direccion: string | null;
      localidad: string | null;
      tipo_operacion: string;
      precio_venta: number | null;
      precio_alquiler: number | null;
      estado: string;
      ofertanteNombre: string;
    }>
  >([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("propiedades")
      .select("id, titulo, direccion, localidad, tipo_operacion, precio_venta, precio_alquiler, estado, clientes:ofertante_id(nombre)")
      .order("created_at", { ascending: false })
      .then(({ data, error: err }) => {
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
          clientes: { nombre: string } | { nombre: string }[] | null;
        }>;
        setPropiedades(
          rows.map((r) => {
            const c = Array.isArray(r.clientes) ? r.clientes[0] : r.clientes;
            return {
              ...r,
              ofertanteNombre: c?.nombre ?? "—",
            };
          })
        );
        setLoading(false);
      });
  }, []);

  const formatPrecio = (p: number | null) =>
    p != null
      ? p.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
      : "—";

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Propiedades", href: "/propiedades" }]}
        title="Propiedades"
        description="Gestiona propiedades en venta o alquiler"
        actions={
          <Button asChild size="sm">
            <Link href="/propiedades/nueva" className="gap-2">
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              Nueva propiedad
            </Link>
          </Button>
        }
      />

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="mt-10">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} animate={false} className="py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-48 animate-pulse rounded bg-neutral-100" />
                    <div className="h-4 w-64 animate-pulse rounded bg-neutral-100" />
                  </div>
                  <div className="h-6 w-24 animate-pulse rounded-full bg-neutral-100" />
                </div>
              </Card>
            ))}
          </div>
        ) : propiedades.length === 0 && !error ? (
          <div className="rounded-2xl border border-dashed border-border bg-white p-8 text-center">
            <p className="text-neutral-500">Aún no hay propiedades.</p>
            <Button asChild className="mt-4">
              <Link href="/propiedades/nueva" className="gap-2">
                <Building2 className="h-4 w-4" strokeWidth={1.5} />
                Añadir primera propiedad
              </Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {propiedades.map((p) => (
              <Link key={p.id} href={`/propiedades/${p.id}`} className="block">
                <Card className="bg-white/95 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-4 sm:flex-nowrap">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground">
                        {p.titulo || p.direccion || "Sin título"}
                      </p>
                      <p className="truncate text-sm text-neutral-500">
                        {[p.direccion, p.localidad].filter(Boolean).join(", ") || p.ofertanteNombre}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {(p.tipo_operacion === "venta" || p.tipo_operacion === "ambos") && (
                        <p className="text-sm font-semibold text-emerald-700">
                          Venta: {formatPrecio(p.precio_venta)}
                        </p>
                      )}
                      {(p.tipo_operacion === "alquiler" || p.tipo_operacion === "ambos") && (
                        <p className="text-sm font-semibold text-blue-700">
                          Alquiler: {formatPrecio(p.precio_alquiler)}
                        </p>
                      )}
                      <Badge variant="default">{p.estado}</Badge>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Fab href="/propiedades/nueva" label="Nueva propiedad" />
    </div>
  );
}
