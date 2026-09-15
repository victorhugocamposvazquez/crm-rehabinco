"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { FichaLink } from "@/components/crm/FichaPeek";
import {
  ESTADOS_MATCHING,
  ESTADO_MATCHING_LABEL,
  matchingInmuebleDemandas,
  type CriteriosDemanda,
} from "@/lib/demandas/matching";
import { relacionUno } from "@/lib/citas/citas";
import type { Inmueble } from "@/lib/inmuebles/catalogo";

type MatchRow = {
  id: string;
  demanda_id: string;
  puntuacion: number;
  estado: string;
  demandas?: { cliente_id?: string; clientes?: { nombre?: string | null } | null } | null;
};

export function InmuebleMatching({ inmueble }: { inmueble: Inmueble }) {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [buscando, setBuscando] = useState(false);

  const cargar = () => {
    const supabase = createClient();
    void supabase
      .from("demanda_inmuebles")
      .select("id, demanda_id, puntuacion, estado, demandas:demanda_id(cliente_id, clientes:cliente_id(nombre))")
      .eq("propiedad_id", inmueble.id)
      .order("puntuacion", { ascending: false })
      .then(({ data }) =>
        setMatches(
          ((data ?? []) as Array<MatchRow & { demandas?: MatchRow["demandas"] | MatchRow["demandas"][] }>).map((row) => {
            const demanda = relacionUno(row.demandas);
            return {
              ...row,
              demandas: demanda
                ? { ...demanda, clientes: relacionUno(demanda.clientes) }
                : null,
            };
          })
        )
      );
  };

  useEffect(() => {
    cargar();
  }, [inmueble.id]);

  const buscar = async () => {
    setBuscando(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("demandas")
      .select(
        "id, tipo_operacion, tipos_inmueble, zonas, presupuesto_min, presupuesto_max, superficie_min, superficie_max, habitaciones_min, banos_min"
      )
      .eq("estado", "activa");
    const criterios = (data ?? []).map((d) => ({
      id: d.id,
      tipoOperacion: d.tipo_operacion,
      tiposInmueble: d.tipos_inmueble ?? [],
      zonas: d.zonas ?? [],
      presupuestoMin: d.presupuesto_min,
      presupuestoMax: d.presupuesto_max,
      superficieMin: d.superficie_min,
      superficieMax: d.superficie_max,
      habitacionesMin: d.habitaciones_min,
      banosMin: d.banos_min,
    })) satisfies Array<CriteriosDemanda & { id: string }>;
    const resultados = matchingInmuebleDemandas(
      {
        id: inmueble.id,
        tipoOperacion: inmueble.tipo_operacion,
        tipoInmueble: inmueble.tipo_inmueble,
        localidad: inmueble.localidad,
        codigoPostal: inmueble.codigo_postal,
        precioVenta: inmueble.precio_venta,
        precioAlquiler: inmueble.precio_alquiler,
        superficie: inmueble.superficie_util ?? inmueble.superficie_m2,
        habitaciones: inmueble.habitaciones,
        banos: inmueble.banos,
        estado: inmueble.estado,
      },
      criterios
    );
    const ya = new Set(matches.map((item) => item.demanda_id));
    for (const item of resultados) {
      if (ya.has(item.demandaId)) {
        await supabase
          .from("demanda_inmuebles")
          .update({ puntuacion: item.puntuacion })
          .eq("demanda_id", item.demandaId)
          .eq("propiedad_id", inmueble.id);
        continue;
      }
      await supabase.from("demanda_inmuebles").insert({
        demanda_id: item.demandaId,
        propiedad_id: inmueble.id,
        origen: "automatico",
        puntuacion: item.puntuacion,
        estado: "propuesto",
      });
    }
    setBuscando(false);
    toast.success(`${resultados.length} demandas encajan.`);
    cargar();
  };

  const cambiar = async (id: string, estado: string) => {
    const supabase = createClient();
    await supabase.from("demanda_inmuebles").update({ estado }).eq("id", id);
    cargar();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-neutral-500">Quién busca un inmueble como este.</p>
        <Button type="button" size="sm" variant="secondary" disabled={buscando} onClick={() => void buscar()}>
          {buscando ? "Buscando…" : "Buscar demandas"}
        </Button>
      </div>
      <ul className="space-y-2">
        {matches.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E6E3DD] px-3 py-2">
            <FichaLink tipo="demanda" id={item.demanda_id} className="text-sm font-medium">
              {item.demandas?.clientes?.nombre ?? "Demanda"} · {Math.round(Number(item.puntuacion))} pts
            </FichaLink>
            <select
              value={item.estado}
              onChange={(e) => void cambiar(item.id, e.target.value)}
              className="h-8 rounded-lg border px-2 text-xs"
            >
              {ESTADOS_MATCHING.map((estado) => (
                <option key={estado} value={estado}>
                  {ESTADO_MATCHING_LABEL[estado]}
                </option>
              ))}
            </select>
          </li>
        ))}
        {matches.length === 0 ? (
          <li className="text-sm text-neutral-500">Nadie propuesto aún. Pulsa «Buscar demandas».</li>
        ) : null}
      </ul>
    </div>
  );
}
