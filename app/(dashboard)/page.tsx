"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FileText, UserPlus } from "lucide-react";

interface DashboardStats {
  totalClientes: number;
  totalFacturas: number;
  facturadoMes: number;
  ultimasFacturas: Array<{ id: string; numero: string; total: number }>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

    Promise.all([
      supabase.from("clientes").select("id", { count: "exact", head: true }).eq("activo", true),
      supabase.from("facturas").select("id, numero, total").eq("estado", "pagada").gte("fecha_emision", startOfMonth),
      supabase.from("facturas").select("id, numero, total").order("created_at", { ascending: false }).limit(5),
    ]).then(([clientesRes, facturadoRes, ultimasRes]) => {
      const totalClientes = clientesRes.count ?? 0;
      const facturasPagadas = (facturadoRes.data ?? []) as Array<{ total: number }>;
      const facturadoMes = facturasPagadas.reduce((acc, f) => acc + Number(f.total ?? 0), 0);
      const ultimasFacturas = (ultimasRes.data ?? []) as Array<{ id: string; numero: string; total: number }>;
      setStats({
        totalClientes,
        totalFacturas: ultimasFacturas.length,
        facturadoMes,
        ultimasFacturas,
      });
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Inicio" }]}
        title="Inicio"
        description="Resumen y acceso rápido"
      />

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Button asChild variant="secondary" className="h-auto flex-col items-stretch gap-2 py-6">
          <Link href="/facturas/nueva" className="flex flex-col items-center gap-2 text-center">
            <FileText className="h-8 w-8" strokeWidth={1.5} />
            <span>Nueva factura</span>
          </Link>
        </Button>
        <Button asChild variant="secondary" className="h-auto flex-col items-stretch gap-2 py-6">
          <Link href="/clientes/nuevo" className="flex flex-col items-center gap-2 text-center">
            <UserPlus className="h-8 w-8" strokeWidth={1.5} />
            <span>Nuevo cliente</span>
          </Link>
        </Button>
        <Button asChild variant="secondary" className="h-auto flex-col items-stretch gap-2 py-6 sm:col-span-2 lg:col-span-1">
          <Link href="/facturas" className="flex flex-col items-center gap-2 text-center">
            <Plus className="h-8 w-8" strokeWidth={1.5} />
            <span>Ver facturas</span>
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="mt-10 h-32 animate-pulse rounded-2xl bg-neutral-100" />
      ) : stats && (
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-neutral-500">Clientes activos:</span> <span className="font-medium">{stats.totalClientes}</span></p>
              <p><span className="text-neutral-500">Facturado este mes:</span> <span className="font-medium">{stats.facturadoMes.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}</span></p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Últimas facturas</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.ultimasFacturas.length === 0 ? (
                <p className="text-sm text-neutral-500">Sin facturas aún.</p>
              ) : (
                <ul className="space-y-2">
                  {stats.ultimasFacturas.map((f) => (
                    <li key={f.id}>
                      <Link href={`/facturas/${f.id}`} className="text-sm font-medium hover:underline">
                        {f.numero}
                      </Link>
                      <span className="ml-2 text-sm text-neutral-500">
                        {Number(f.total ?? 0).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
