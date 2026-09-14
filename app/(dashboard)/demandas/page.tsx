"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { ESTADOS_DEMANDA } from "@/lib/demandas/matching";
import { relacionUno } from "@/lib/citas/citas";

type DemandaRow = {
  id: string;
  tipo_operacion: string;
  estado: string;
  zonas: string[] | null;
  presupuesto_max: number | null;
  clientes?: { nombre?: string | null } | null;
  profiles?: { nombre_completo?: string | null } | null;
};

export default function DemandasPage() {
  const [filas, setFilas] = useState<DemandaRow[]>([]);
  const [estado, setEstado] = useState("activa");

  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("demandas")
      .select("id, tipo_operacion, estado, zonas, presupuesto_max, clientes:cliente_id(nombre), profiles:comercial_id(nombre_completo)")
      .eq("estado", estado)
      .order("updated_at", { ascending: false })
      .then(({ data }) =>
        setFilas(
          ((data ?? []) as Array<
            DemandaRow & {
              clientes?: DemandaRow["clientes"] | DemandaRow["clientes"][];
              profiles?: DemandaRow["profiles"] | DemandaRow["profiles"][];
            }
          >).map((fila) => ({
            ...fila,
            clientes: relacionUno(fila.clientes),
            profiles: relacionUno(fila.profiles),
          }))
        )
      );
  }, [estado]);

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Demandas" }]}
        title="Demandas"
        description="Lo que busca cada cliente. El matching se confirma a mano."
        actions={
          <Button asChild size="sm">
            <Link href="/demandas/nueva">Nueva demanda</Link>
          </Button>
        }
      />
      <div className="mt-4 flex flex-wrap gap-2">
        {ESTADOS_DEMANDA.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setEstado(item)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              estado === item ? "border-[#0B7461] bg-[#E8F3EF]" : "border-[#E6E3DD] bg-white"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
      <ul className="mt-6 divide-y divide-[#F2F0EB] overflow-hidden rounded-2xl border border-[#E6E3DD] bg-white">
        {filas.map((fila) => (
          <li key={fila.id}>
            <Link href={`/demandas/${fila.id}`} className="block px-4 py-3 hover:bg-[#FBFBF9]">
              <p className="font-semibold">{fila.clientes?.nombre ?? "Cliente"}</p>
              <p className="text-sm text-[#5D6B67]">
                {fila.tipo_operacion}
                {fila.zonas?.length ? ` · ${fila.zonas.join(", ")}` : ""}
                {fila.presupuesto_max != null
                  ? ` · hasta ${fila.presupuesto_max.toLocaleString("es-ES")} €`
                  : ""}
              </p>
            </Link>
          </li>
        ))}
        {filas.length === 0 ? (
          <li className="px-4 py-10 text-center text-sm text-[#5D6B67]">No hay demandas en este estado.</li>
        ) : null}
      </ul>
    </div>
  );
}
