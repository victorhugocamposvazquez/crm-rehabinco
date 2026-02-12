"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PropiedadCard } from "@/components/propiedades/PropiedadCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Fab } from "@/components/ui/fab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Building2, Search } from "lucide-react";

export default function PropiedadesPage() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState<"todos" | string>("todos");
  const [filterTipo, setFilterTipo] = useState<"todos" | string>("todos");
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

  const filteredPropiedades = useMemo(() => {
    return propiedades.filter((p) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        (p.titulo ?? "").toLowerCase().includes(q) ||
        (p.direccion ?? "").toLowerCase().includes(q) ||
        (p.localidad ?? "").toLowerCase().includes(q) ||
        p.ofertanteNombre.toLowerCase().includes(q);
      const matchEstado = filterEstado === "todos" || p.estado === filterEstado;
      const matchTipo = filterTipo === "todos" || p.tipo_operacion === filterTipo;
      return matchSearch && matchEstado && matchTipo;
    });
  }, [propiedades, search, filterEstado, filterTipo]);

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Propiedades", href: "/propiedades" }]}
        title="Propiedades"
        description="Oferta: inmuebles que tus clientes ponen a la venta o alquiler. La demanda (buscadores) se gestiona como clientes."
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

      {!loading && propiedades.length > 0 && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" strokeWidth={1.5} aria-hidden />
            <Input
              type="search"
              placeholder="Buscar por título, dirección, propietario..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              aria-label="Buscar propiedades"
            />
          </div>
          <div className="flex flex-wrap gap-1 rounded-lg border border-border p-1">
            {(["todos", "disponible", "reservada", "vendida", "alquilada", "baja"] as const).map((e) => (
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
                {e === "todos" ? "Todos" : e.charAt(0).toUpperCase() + e.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1 rounded-lg border border-border p-1">
            {(["todos", "venta", "alquiler", "ambos"] as const).map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setFilterTipo(e)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  filterTipo === e
                    ? "bg-foreground text-background"
                    : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {e === "todos" ? "Tipo" : e.charAt(0).toUpperCase() + e.slice(1)}
              </button>
            ))}
          </div>
        </div>
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
            {filteredPropiedades.length === 0 ? (
              <p className="rounded-2xl border border-border bg-white p-6 text-center text-neutral-500">
                No hay propiedades que coincidan con la búsqueda.
              </p>
            ) : (
              filteredPropiedades.map((p) => (
                <PropiedadCard
                  key={p.id}
                  id={p.id}
                  titulo={p.titulo}
                  direccion={p.direccion}
                  localidad={p.localidad}
                  tipo_operacion={p.tipo_operacion}
                  precio_venta={p.precio_venta}
                  precio_alquiler={p.precio_alquiler}
                  estado={p.estado}
                  ofertanteNombre={p.ofertanteNombre}
                />
              ))
            )}
          </div>
        )}
      </div>

      <Fab href="/propiedades/nueva" label="Nueva propiedad" />
    </div>
  );
}
