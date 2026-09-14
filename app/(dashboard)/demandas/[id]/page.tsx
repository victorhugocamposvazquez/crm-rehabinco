"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { matchingDemandas, ESTADOS_MATCHING, type CriteriosDemanda } from "@/lib/demandas/matching";
import { rutaPropiedadCrm } from "@/lib/catastro/explorer";
import { relacionUno } from "@/lib/citas/citas";

type Demanda = {
  id: string;
  cliente_id: string;
  tipo_operacion: string;
  tipos_inmueble: string[] | null;
  zonas: string[] | null;
  presupuesto_min: number | null;
  presupuesto_max: number | null;
  superficie_min: number | null;
  superficie_max: number | null;
  habitaciones_min: number | null;
  banos_min: number | null;
  requisitos: string | null;
  estado: string;
  clientes?: { nombre?: string | null } | null;
};

type MatchRow = {
  id: string;
  propiedad_id: string;
  puntuacion: number;
  estado: string;
  propiedades?: { titulo?: string | null; direccion?: string | null; localidad?: string | null } | null;
};

export default function DemandaDetallePage() {
  const params = useParams();
  const id = params.id as string;
  const [demanda, setDemanda] = useState<Demanda | null>(null);
  const [matches, setMatches] = useState<MatchRow[]>([]);

  const cargar = () => {
    const supabase = createClient();
    void supabase
      .from("demandas")
      .select(
        "id, cliente_id, tipo_operacion, tipos_inmueble, zonas, presupuesto_min, presupuesto_max, superficie_min, superficie_max, habitaciones_min, banos_min, requisitos, estado, clientes:cliente_id(nombre)"
      )
      .eq("id", id)
      .single()
      .then(({ data }) => {
        if (!data) {
          setDemanda(null);
          return;
        }
        const fila = data as Demanda & { clientes?: Demanda["clientes"] | Demanda["clientes"][] };
        setDemanda({ ...fila, clientes: relacionUno(fila.clientes) });
      });
    void supabase
      .from("demanda_inmuebles")
      .select("id, propiedad_id, puntuacion, estado, propiedades:propiedad_id(titulo, direccion, localidad)")
      .eq("demanda_id", id)
      .order("puntuacion", { ascending: false })
      .then(({ data }) =>
        setMatches(
          ((data ?? []) as Array<MatchRow & { propiedades?: MatchRow["propiedades"] | MatchRow["propiedades"][] }>).map(
            (item) => ({
              ...item,
              propiedades: relacionUno(item.propiedades),
            })
          )
        )
      );
  };

  useEffect(() => {
    cargar();
  }, [id]);

  const buscar = async () => {
    if (!demanda) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("propiedades")
      .select(
        "id, tipo_operacion, tipo_inmueble, localidad, codigo_postal, precio_venta, precio_alquiler, superficie_m2, superficie_util, habitaciones, banos, estado"
      )
      .eq("estado", "disponible");
    const criterios: CriteriosDemanda = {
      tipoOperacion: demanda.tipo_operacion,
      tiposInmueble: demanda.tipos_inmueble ?? [],
      zonas: demanda.zonas ?? [],
      presupuestoMin: demanda.presupuesto_min,
      presupuestoMax: demanda.presupuesto_max,
      superficieMin: demanda.superficie_min,
      superficieMax: demanda.superficie_max,
      habitacionesMin: demanda.habitaciones_min,
      banosMin: demanda.banos_min,
    };
    const resultados = matchingDemandas(
      criterios,
      (data ?? []).map((p) => ({
        id: p.id,
        tipoOperacion: p.tipo_operacion,
        tipoInmueble: p.tipo_inmueble,
        localidad: p.localidad,
        codigoPostal: p.codigo_postal,
        precioVenta: p.precio_venta,
        precioAlquiler: p.precio_alquiler,
        superficie: p.superficie_util ?? p.superficie_m2,
        habitaciones: p.habitaciones,
        banos: p.banos,
        estado: p.estado,
      }))
    );
    const ya = new Set(matches.map((item) => item.propiedad_id));
    for (const item of resultados) {
      if (ya.has(item.propiedadId)) {
        await supabase
          .from("demanda_inmuebles")
          .update({ puntuacion: item.puntuacion })
          .eq("demanda_id", id)
          .eq("propiedad_id", item.propiedadId);
        continue;
      }
      await supabase.from("demanda_inmuebles").insert({
        demanda_id: id,
        propiedad_id: item.propiedadId,
        origen: "automatico",
        puntuacion: item.puntuacion,
        estado: "propuesto",
      });
    }
    toast.success(`${resultados.length} inmuebles encajan.`);
    cargar();
  };

  const cambiarMatch = async (matchId: string, estado: string) => {
    const supabase = createClient();
    await supabase.from("demanda_inmuebles").update({ estado }).eq("id", matchId);
    cargar();
  };

  if (!demanda) {
    return <p className="mt-8 text-sm text-[#5D6B67]">Cargando demanda…</p>;
  }

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Demandas", href: "/demandas" }, { label: demanda.clientes?.nombre ?? "Demanda" }]}
        title={demanda.clientes?.nombre ?? "Demanda"}
        description={`${demanda.tipo_operacion}${demanda.zonas?.length ? ` · ${demanda.zonas.join(", ")}` : ""}`}
        actions={
          <Button type="button" size="sm" onClick={() => void buscar()}>
            Buscar en stock
          </Button>
        }
      />
      {demanda.requisitos ? <p className="mt-4 text-sm text-[#5D6B67]">{demanda.requisitos}</p> : null}
      <ul className="mt-6 space-y-2">
        {matches.map((item) => (
          <li key={item.id} className="rounded-2xl border border-[#E6E3DD] bg-white px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Link href={rutaPropiedadCrm(item.propiedad_id)} className="font-semibold hover:underline">
                  {item.propiedades?.titulo || item.propiedades?.direccion || "Inmueble"}
                </Link>
                <p className="text-sm text-[#5D6B67]">
                  {item.propiedades?.localidad} · {Math.round(Number(item.puntuacion))} pts · {item.estado}
                </p>
              </div>
              <select
                value={item.estado}
                onChange={(e) => void cambiarMatch(item.id, e.target.value)}
                className="h-9 rounded-lg border px-2 text-sm"
              >
                {ESTADOS_MATCHING.map((estado) => (
                  <option key={estado} value={estado}>
                    {estado}
                  </option>
                ))}
              </select>
            </div>
          </li>
        ))}
        {matches.length === 0 ? (
          <li className="text-sm text-[#5D6B67]">Aún no hay inmuebles propuestos. Pulsa «Buscar en stock».</li>
        ) : null}
      </ul>
    </div>
  );
}
