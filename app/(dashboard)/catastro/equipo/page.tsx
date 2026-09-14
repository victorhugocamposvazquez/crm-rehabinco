"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { BandejaCaptacion } from "@/components/captacion/BandejaCaptacion";
import type { FincaCaptacionApi } from "@/lib/catastro-host/captacion-filas";
import type { KpiCaptacion, KpiPorComercial } from "@/lib/captacion/kpis";
import { Card, CardContent } from "@/components/ui/card";

export default function EquipoCaptacionPage() {
  const [items, setItems] = useState<FincaCaptacionApi[]>([]);
  const [kpis, setKpis] = useState<KpiCaptacion | null>(null);
  const [porComercial, setPorComercial] = useState<KpiPorComercial[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/catastro/equipo")
      .then(async (respuesta) => {
        const json = (await respuesta.json()) as {
          ok?: boolean;
          error?: string;
          items?: FincaCaptacionApi[];
          kpis?: KpiCaptacion;
          porComercial?: KpiPorComercial[];
        };
        if (!respuesta.ok || !json.ok) {
          setError(json.error ?? "No se ha podido cargar el equipo.");
          return;
        }
        setItems(json.items ?? []);
        setKpis(json.kpis ?? null);
        setPorComercial(json.porComercial ?? []);
      })
      .catch(() => setError("No se ha podido cargar el equipo."));
  }, []);

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Catastro", href: "/catastro" }, { label: "Equipo" }]}
        title="Equipo"
        description="Todas las fincas asignadas y conversión a propiedad."
      />
      {error ? <p className="mt-6 text-sm text-red-700">{error}</p> : null}
      {kpis ? (
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Asignadas" valor={String(kpis.asignadas)} />
          <Kpi label="Sin trabajar" valor={String(kpis.sinTrabajar)} />
          <Kpi label="Con propiedad" valor={String(kpis.conPropiedad)} />
          <Kpi label="Conversión" valor={`${kpis.conversionPct} %`} />
        </div>
      ) : null}
      {porComercial.length > 0 ? (
        <ul className="mt-6 space-y-2">
          {porComercial.map((item) => (
            <li key={item.comercialId} className="rounded-xl border border-[#E6E3DD] bg-white px-4 py-3 text-sm">
              <span className="font-semibold">{item.nombre}</span>
              <span className="text-[#5D6B67]">
                {" "}
                · {item.asignadas} fincas · {item.conPropiedad} propiedades · {item.conversionPct} %
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-8">
        <BandejaCaptacion items={items} mostrarComercial />
      </div>
    </div>
  );
}

function Kpi({ label, valor }: { label: string; valor: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-2xl font-semibold">{valor}</p>
        <p className="mt-1 text-sm text-neutral-500">{label}</p>
      </CardContent>
    </Card>
  );
}
