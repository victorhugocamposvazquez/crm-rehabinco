"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { ESTADOS_MATCHING, ESTADO_MATCHING_LABEL } from "@/lib/demandas/matching";
import { criteriosDeDemanda, proponerStockParaDemanda } from "@/lib/demandas/proponer-stock";
import { FichaLink } from "@/components/crm/FichaPeek";
import { relacionUno } from "@/lib/citas/citas";
import { NuevaDemandaPanel } from "@/components/demandas/NuevaDemandaPanel";
import { Pencil } from "lucide-react";

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
  const [editar, setEditar] = useState(false);

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
    const n = await proponerStockParaDemanda(createClient(), id, criteriosDeDemanda(demanda));
    toast.success(`${n} inmuebles encajan.`);
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
        title={
          demanda.cliente_id ? (
            <FichaLink tipo="cliente" id={demanda.cliente_id} className="text-inherit font-semibold text-foreground hover:text-accent">
              {demanda.clientes?.nombre ?? "Demanda"}
            </FichaLink>
          ) : (
            (demanda.clientes?.nombre ?? "Demanda")
          )
        }
        description={`${demanda.tipo_operacion}${demanda.zonas?.length ? ` · ${demanda.zonas.join(", ")}` : ""}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => setEditar(true)} className="gap-2">
              <Pencil className="h-4 w-4" strokeWidth={1.5} />
              Editar
            </Button>
            <Button type="button" size="sm" onClick={() => void buscar()}>
              Buscar en stock
            </Button>
          </div>
        }
      />
      {demanda.requisitos ? <p className="mt-4 text-sm text-[#5D6B67]">{demanda.requisitos}</p> : null}
      <ul className="mt-6 space-y-2">
        {matches.map((item) => (
          <li key={item.id} className="rounded-2xl border border-[#E6E3DD] bg-white px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <FichaLink tipo="propiedad" id={item.propiedad_id} className="font-semibold text-foreground">
                  {item.propiedades?.titulo || item.propiedades?.direccion || "Inmueble"}
                </FichaLink>
                <p className="text-sm text-[#5D6B67]">
                  {item.propiedades?.localidad} · {Math.round(Number(item.puntuacion))} pts ·{" "}
                  {ESTADO_MATCHING_LABEL[item.estado as keyof typeof ESTADO_MATCHING_LABEL] ?? item.estado}
                </p>
              </div>
              <select
                value={item.estado}
                onChange={(e) => void cambiarMatch(item.id, e.target.value)}
                className="h-9 rounded-lg border px-2 text-sm"
              >
                {ESTADOS_MATCHING.map((estado) => (
                  <option key={estado} value={estado}>
                    {ESTADO_MATCHING_LABEL[estado]}
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
      <NuevaDemandaPanel
        open={editar}
        onOpenChange={setEditar}
        editarId={id}
        clienteIdInicial={demanda.cliente_id}
        clienteNombre={demanda.clientes?.nombre ?? undefined}
        onCreada={() => {
          setEditar(false);
          cargar();
        }}
      />
    </div>
  );
}
