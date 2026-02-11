"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, TrendingUp, Clock } from "lucide-react";

interface DashboardStats {
  totalClientes: number;
  facturadoMes: number;
  pendienteCobro: number;
  ultimasFacturas: Array<{ id: string; numero: string; total: number; estado: string }>;
}

function KpiSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-white p-5 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
      <div className="flex items-start justify-between">
        <div className="h-10 w-10 animate-pulse rounded-xl bg-neutral-100" />
        <div className="h-4 w-16 animate-pulse rounded bg-neutral-100" />
      </div>
      <div className="mt-4 h-8 w-20 animate-pulse rounded bg-neutral-100" />
      <div className="mt-2 h-4 w-24 animate-pulse rounded bg-neutral-100" />
    </div>
  );
}

function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <div className="h-4 flex-1 animate-pulse rounded bg-neutral-100" />
          <div className="h-4 w-16 animate-pulse rounded bg-neutral-100" />
        </div>
      ))}
    </div>
  );
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
      supabase.from("facturas").select("id, numero, total").eq("estado", "emitida"),
      supabase.from("facturas").select("id, numero, total, estado").order("created_at", { ascending: false }).limit(5),
    ]).then(([clientesRes, facturadoRes, emitidasRes, ultimasRes]) => {
      const totalClientes = clientesRes.count ?? 0;
      const facturasPagadas = (facturadoRes.data ?? []) as Array<{ total: number }>;
      const facturadoMes = facturasPagadas.reduce((acc, f) => acc + Number(f.total ?? 0), 0);
      const emitidas = (emitidasRes.data ?? []) as Array<{ total: number }>;
      const pendienteCobro = emitidas.reduce((acc, f) => acc + Number(f.total ?? 0), 0);
      const ultimasFacturas = (ultimasRes.data ?? []) as Array<{ id: string; numero: string; total: number; estado: string }>;
      setStats({
        totalClientes,
        facturadoMes,
        pendienteCobro,
        ultimasFacturas,
      });
      setLoading(false);
    });
  }, []);

  return (
    <div className="animate-[fadeIn_0.3s_ease-out]">
      <PageHeader
        breadcrumb={[{ label: "Inicio" }]}
        title="Inicio"
        description="Resumen y acceso rápido"
      />

      {/* KPI cards */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          <>
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </>
        ) : stats ? (
          <>
            <Card className="border-border bg-white shadow-[0_1px_3px_rgba(16,24,40,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(16,24,40,0.08)]">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                    <Users className="h-5 w-5" strokeWidth={1.5} />
                  </span>
                </div>
                <p className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
                  {stats.totalClientes}
                </p>
                <p className="mt-1 text-sm font-medium text-neutral-500">Clientes activos</p>
              </CardContent>
            </Card>
            <Card className="border-border bg-white shadow-[0_1px_3px_rgba(16,24,40,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(16,24,40,0.08)]">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                    <TrendingUp className="h-5 w-5" strokeWidth={1.5} />
                  </span>
                </div>
                <p className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
                  {stats.facturadoMes.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                </p>
                <p className="mt-1 text-sm font-medium text-neutral-500">Facturado este mes</p>
              </CardContent>
            </Card>
            <Card className="border-border bg-white shadow-[0_1px_3px_rgba(16,24,40,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(16,24,40,0.08)]">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                    <Clock className="h-5 w-5" strokeWidth={1.5} />
                  </span>
                </div>
                <p className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
                  {stats.pendienteCobro.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                </p>
                <p className="mt-1 text-sm font-medium text-neutral-500">Pendiente de cobro</p>
              </CardContent>
            </Card>
            <Card className="border-border bg-white shadow-[0_1px_3px_rgba(16,24,40,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(16,24,40,0.08)]">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
                    <FileText className="h-5 w-5" strokeWidth={1.5} />
                  </span>
                </div>
                <p className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
                  {stats.ultimasFacturas.length}
                </p>
                <p className="mt-1 text-sm font-medium text-neutral-500">Últimas facturas</p>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      {/* Quick actions + content */}
      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border bg-white shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {loading ? (
                <ListSkeleton rows={3} />
              ) : stats ? (
                <>
                  <div className="flex items-center justify-between rounded-xl bg-neutral-50/80 px-4 py-3">
                    <span className="text-neutral-600">Clientes activos</span>
                    <span className="font-semibold text-foreground">{stats.totalClientes}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-neutral-50/80 px-4 py-3">
                    <span className="text-neutral-600">Facturado este mes</span>
                    <span className="font-semibold text-foreground">
                      {stats.facturadoMes.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-neutral-50/80 px-4 py-3">
                    <span className="text-neutral-600">Pendiente de cobro</span>
                    <span className="font-semibold text-foreground">
                      {stats.pendienteCobro.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                    </span>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Card className="border-border bg-white shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Últimas facturas</CardTitle>
            <Link
              href="/facturas"
              className="text-sm font-medium text-primary hover:underline"
            >
              Ver todas
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ListSkeleton rows={5} />
            ) : stats && stats.ultimasFacturas.length > 0 ? (
              <ul className="space-y-2">
                {stats.ultimasFacturas.map((f) => (
                  <li key={f.id}>
                    <Link
                      href={`/facturas/${f.id}`}
                      className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-neutral-50"
                    >
                      <span className="font-medium text-foreground">{f.numero}</span>
                      <span className="text-sm text-neutral-500">
                        {Number(f.total ?? 0).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-4 text-center text-sm text-neutral-500">Sin facturas aún.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
