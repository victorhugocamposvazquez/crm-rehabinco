"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { demandasSinMatching, stockPorComercial, visitasEnSemana } from "@/lib/inmuebles/informes";
import { semanaDesde } from "@/lib/citas/citas";

export default function InformesPage() {
  const hoy = new Date().toISOString().slice(0, 10);
  const semana = useMemo(() => semanaDesde(hoy), [hoy]);
  const [visitas, setVisitas] = useState(0);
  const [stock, setStock] = useState<Array<{ nombre: string; total: number; disponibles: number }>>([]);
  const [sinCruce, setSinCruce] = useState(0);
  const [demandasActivas, setDemandasActivas] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    void Promise.all([
      supabase.from("partes_visita").select("comercial_id, fecha_visita, estado"),
      supabase.from("propiedades").select("comercial_id, estado, profiles:comercial_id(nombre_completo, email)"),
      supabase.from("demandas").select("id, demanda_inmuebles(id)").eq("estado", "activa"),
    ]).then(([v, p, d]) => {
      setVisitas(
        visitasEnSemana(
          (v.data ?? []).map((item) => ({
            comercialId: item.comercial_id,
            fechaVisita: item.fecha_visita,
            estado: item.estado,
          })),
          semana[0] ?? hoy,
          semana[6] ?? hoy
        )
      );
      setStock(
        stockPorComercial(
          ((p.data ?? []) as Array<{
            comercial_id: string | null;
            estado: string;
            profiles?: { nombre_completo?: string | null; email?: string | null } | { nombre_completo?: string | null; email?: string | null }[] | null;
          }>).map((item) => {
            const perfil = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
            return {
              comercialId: item.comercial_id,
              comercialNombre: perfil?.nombre_completo || perfil?.email || "Sin asignar",
              estado: item.estado,
            };
          })
        )
      );
      const demandas = (d.data ?? []).map((item) => ({
        id: item.id,
        matches: Array.isArray(item.demanda_inmuebles) ? item.demanda_inmuebles.length : item.demanda_inmuebles ? 1 : 0,
      }));
      setDemandasActivas(demandas.length);
      setSinCruce(demandasSinMatching(demandas));
    });
  }, [hoy, semana]);

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Informes" }]}
        title="Informes"
        description="Visitas de la semana, stock por comercial y demandas sin cruce."
      />
      <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
        {[
          { valor: String(visitas), label: "Visitas esta semana" },
          { valor: String(demandasActivas), label: "Demandas activas" },
          { valor: String(sinCruce), label: "Sin matching" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-white px-[15px] py-3">
            <div className="text-[22px] font-semibold tabular-nums tracking-tight">{k.valor}</div>
            <div className="mt-0.5 text-[12.5px] text-[var(--text-2)]">{k.label}</div>
          </div>
        ))}
      </div>
      <ul className="mt-4 overflow-hidden rounded-[14px] border border-border bg-white">
        {stock.map((item) => (
          <li key={item.nombre} className="flex items-center justify-between gap-3 border-b border-[var(--border-row)] px-4 py-2.5 last:border-0 text-[14px]">
            <span className="font-semibold">{item.nombre}</span>
            <span className="tabular-nums text-[var(--text-2)]">
              {item.total} inmuebles · {item.disponibles} disponibles
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm">
        <Link href="/demandas" className="font-medium text-[#0B7461] hover:underline">
          Ir a demandas
        </Link>
        {" · "}
        <Link href="/propiedades" className="font-medium text-[#0B7461] hover:underline">
          Ir a inmuebles
        </Link>
      </p>
    </div>
  );
}
