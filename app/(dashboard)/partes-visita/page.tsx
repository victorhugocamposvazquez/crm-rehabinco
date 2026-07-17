"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ParteVisitaCard } from "@/components/partes-visita/ParteVisitaCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Fab } from "@/components/ui/fab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, ClipboardPenLine, Search } from "lucide-react";
import { ESTADO_PARTE_LABELS } from "@/lib/partes-visita";

type ParteRow = {
  id: string;
  visitante_nombre: string | null;
  inmueble_direccion: string | null;
  fecha_visita: string | null;
  hora_visita: string | null;
  estado: "borrador" | "pendiente_firma" | "firmado";
  agente_nombre: string | null;
};

export default function PartesVisitaPage() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState<"todos" | ParteRow["estado"]>("todos");
  const [partes, setPartes] = useState<ParteRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("partes_visita")
      .select(
        "id, visitante_nombre, inmueble_direccion, fecha_visita, hora_visita, estado, agente_nombre"
      )
      .order("created_at", { ascending: false })
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message);
          setPartes([]);
        } else {
          setPartes((data ?? []) as ParteRow[]);
        }
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    return partes.filter((p) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        (p.visitante_nombre ?? "").toLowerCase().includes(q) ||
        (p.inmueble_direccion ?? "").toLowerCase().includes(q) ||
        (p.agente_nombre ?? "").toLowerCase().includes(q);
      const matchEstado = filterEstado === "todos" || p.estado === filterEstado;
      return matchSearch && matchEstado;
    });
  }, [partes, search, filterEstado]);

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Partes de visita", href: "/partes-visita" }]}
        title="Partes de visita"
        description="Documenta cada visita y comparte un enlace para que el visitante firme con el dedo."
        actions={
          <Button asChild size="sm">
            <Link href="/partes-visita/nuevo" className="gap-2">
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              Nuevo parte
            </Link>
          </Button>
        }
      />

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {!loading && partes.length > 0 && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          <div className="relative min-w-[200px] flex-1">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
              strokeWidth={1.5}
              aria-hidden
            />
            <Input
              type="search"
              placeholder="Buscar por visitante, dirección o agente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              aria-label="Buscar partes de visita"
            />
          </div>
          <div className="flex flex-wrap gap-1 rounded-lg border border-border p-1">
            {(
              ["todos", "pendiente_firma", "firmado", "borrador"] as const
            ).map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setFilterEstado(e)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  filterEstado === e
                    ? "bg-accent/10 text-accent"
                    : "text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                {e === "todos" ? "Todos" : ESTADO_PARTE_LABELS[e]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {loading && (
          <div className="flex min-h-[30vh] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-foreground" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <Card className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <ClipboardPenLine className="h-10 w-10 text-neutral-300" strokeWidth={1.5} />
            <p className="text-base font-medium text-foreground">
              {partes.length === 0
                ? "Aún no hay partes de visita"
                : "No hay resultados con ese filtro"}
            </p>
            {partes.length === 0 && (
              <Button asChild size="sm">
                <Link href="/partes-visita/nuevo">Crear el primero</Link>
              </Button>
            )}
          </Card>
        )}

        {!loading &&
          filtered.map((p) => (
            <ParteVisitaCard
              key={p.id}
              id={p.id}
              visitante_nombre={p.visitante_nombre}
              inmueble_direccion={p.inmueble_direccion}
              fecha_visita={p.fecha_visita}
              hora_visita={p.hora_visita}
              estado={p.estado}
              agente_nombre={p.agente_nombre}
            />
          ))}
      </div>

      <Fab href="/partes-visita/nuevo" label="Nuevo parte" />
    </div>
  );
}
