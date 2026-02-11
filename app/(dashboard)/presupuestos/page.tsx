"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Fab } from "@/components/ui/fab";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, ClipboardList } from "lucide-react";

type EstadoPresupuesto = "borrador" | "enviado" | "aceptado" | "rechazado" | "convertido";

const estadoVariant: Record<string, "default" | "activo" | "inactivo" | "borrador" | "emitida" | "pagada"> = {
  borrador: "borrador",
  enviado: "default",
  aceptado: "activo",
  rechazado: "inactivo",
  convertido: "pagada",
};

export default function PresupuestosPage() {
  const [loading, setLoading] = useState(true);
  const [presupuestos, setPresupuestos] = useState<
    Array<{
      id: string;
      numero: string;
      clienteNombre: string;
      importe: string;
      estado: EstadoPresupuesto;
    }>
  >([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("presupuestos")
      .select("id, numero, estado, total, clientes(nombre)")
      .order("created_at", { ascending: false })
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message);
          setPresupuestos([]);
          setLoading(false);
          return;
        }
        const rows = (data ?? []) as Array<{
          id: string;
          numero: string;
          estado: string;
          total?: number | null;
          clientes: { nombre: string } | { nombre: string }[] | null;
        }>;
        setPresupuestos(
          rows.map((r) => {
            const cliente = Array.isArray(r.clientes) ? r.clientes[0] : r.clientes;
            return {
              id: r.id,
              numero: r.numero,
              clienteNombre: cliente?.nombre ?? "—",
              importe:
                Number(r.total ?? 0).toLocaleString("es-ES", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }) + " €",
              estado: r.estado as EstadoPresupuesto,
            };
          })
        );
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Presupuestos", href: "/presupuestos" }]}
        title="Presupuestos"
        description="Gestiona presupuestos y conviértelos en facturas"
        actions={
          <Button asChild size="sm">
            <Link href="/presupuestos/nuevo" className="gap-2">
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              Crear presupuesto
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
                    <div className="h-5 w-40 animate-pulse rounded bg-neutral-100" />
                    <div className="h-4 w-56 animate-pulse rounded bg-neutral-100" />
                  </div>
                  <div className="h-6 w-20 animate-pulse rounded-full bg-neutral-100" />
                </div>
              </Card>
            ))}
          </div>
        ) : presupuestos.length === 0 && !error ? (
          <div className="rounded-2xl border border-dashed border-border bg-white p-8 text-center">
            <p className="text-neutral-500">Aún no hay presupuestos.</p>
            <Button asChild className="mt-4">
              <Link href="/presupuestos/nuevo" className="gap-2">
                <ClipboardList className="h-4 w-4" strokeWidth={1.5} />
                Crear primer presupuesto
              </Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {presupuestos.map((p) => (
              <Link key={p.id} href={`/presupuestos/${p.id}`} className="block">
                <Card className="bg-white/95 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-4 sm:flex-nowrap">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground">{p.numero}</p>
                      <p className="truncate text-sm text-neutral-500">{p.clienteNombre}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      <p className="text-lg font-semibold tracking-tight">{p.importe}</p>
                      <Badge variant={estadoVariant[p.estado] ?? "default"}>
                        {p.estado.charAt(0).toUpperCase() + p.estado.slice(1)}
                      </Badge>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Fab href="/presupuestos/nuevo" label="Nuevo presupuesto" />
    </div>
  );
}
