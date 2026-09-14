"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
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
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-semibold">{visitas}</p>
            <p className="mt-1 text-sm text-neutral-500">Visitas esta semana</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-semibold">{demandasActivas}</p>
            <p className="mt-1 text-sm text-neutral-500">Demandas activas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-semibold">{sinCruce}</p>
            <p className="mt-1 text-sm text-neutral-500">Sin matching</p>
          </CardContent>
        </Card>
      </div>
      <ul className="mt-8 space-y-2">
        {stock.map((item) => (
          <li key={item.nombre} className="rounded-xl border border-[#E6E3DD] bg-white px-4 py-3 text-sm">
            <span className="font-semibold">{item.nombre}</span>
            <span className="text-[#5D6B67]">
              {" "}
              · {item.total} inmuebles · {item.disponibles} disponibles
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
