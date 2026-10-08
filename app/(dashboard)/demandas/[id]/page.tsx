"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { ESTADOS_MATCHING, ESTADO_MATCHING_LABEL, TIPO_OPERACION_DEMANDA_LABEL, type TipoOperacionDemanda } from "@/lib/demandas/matching";
import { ORIGENES_DEMANDA } from "@/lib/demandas/nueva";
import { criteriosDeDemanda, proponerStockParaDemanda } from "@/lib/demandas/proponer-stock";
import { TIPO_INMUEBLE_LABEL, type TipoInmueble } from "@/lib/inmuebles/catalogo";
import { formatEuro } from "@/lib/ui/estados-vista";
import { FichaLink } from "@/components/crm/FichaPeek";
import { relacionUno } from "@/lib/citas/citas";
import { NuevaDemandaPanel } from "@/components/demandas/NuevaDemandaPanel";
import { AvatarComercial } from "@/components/ui/avatar-comercial";
import { Pencil } from "lucide-react";
import { Selector } from "@/components/ui/selector";

type Demanda = {
  id: string;
  cliente_id: string;
  comercial_id: string;
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
  origen: string | null;
  estado: string;
  clientes?: { nombre?: string | null } | null;
  profiles?: { nombre_completo?: string | null; color?: string | null } | null;
};

function numero(valor: number | string | null | undefined): number | null {
  if (valor == null || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function rango(
  min: number | string | null | undefined,
  max: number | string | null | undefined,
  formato: (n: number) => string
): string {
  const a = numero(min);
  const b = numero(max);
  if (a != null && b != null) return `${formato(a)} – ${formato(b)}`;
  if (a != null) return `desde ${formato(a)}`;
  if (b != null) return `hasta ${formato(b)}`;
  return "—";
}

function labelTipos(tipos: string[] | null | undefined): string {
  if (!tipos?.length) return "—";
  return tipos.map((tipo) => TIPO_INMUEBLE_LABEL[tipo as TipoInmueble] ?? tipo).join(", ");
}

function labelOrigen(origen: string | null | undefined): string {
  if (!origen) return "—";
  return ORIGENES_DEMANDA.find((item) => item.id === origen)?.label ?? origen;
}

function Dato({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-[var(--text-3)]">{label}</dt>
      <dd className="mt-1.5 text-[14px] leading-5 text-foreground">{children}</dd>
    </div>
  );
}

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
        "id, cliente_id, comercial_id, tipo_operacion, tipos_inmueble, zonas, presupuesto_min, presupuesto_max, superficie_min, superficie_max, habitaciones_min, banos_min, requisitos, origen, estado, clientes:cliente_id(nombre), profiles:comercial_id(nombre_completo, color)"
      )
      .eq("id", id)
      .single()
      .then(({ data }) => {
        if (!data) {
          setDemanda(null);
          return;
        }
        const fila = data as Demanda & {
          clientes?: Demanda["clientes"] | Demanda["clientes"][];
          profiles?: Demanda["profiles"] | Demanda["profiles"][];
        };
        setDemanda({
          ...fila,
          clientes: relacionUno(fila.clientes),
          profiles: relacionUno(fila.profiles),
        });
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
    return <p className="mt-8 text-sm text-[var(--text-2)]">Cargando demanda…</p>;
  }

  const operacion = TIPO_OPERACION_DEMANDA_LABEL[demanda.tipo_operacion as TipoOperacionDemanda] ?? demanda.tipo_operacion;
  const tipos = labelTipos(demanda.tipos_inmueble);
  const comercial = demanda.profiles?.nombre_completo?.trim() || "Sin comercial";

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
        description={`${operacion} · ${demanda.estado}`}
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
      <section className="mt-6 rounded-[13px] border border-border bg-[var(--surface)] px-5 py-5">
        <h2 className="text-[13px] font-semibold text-[var(--text-2)]">Lo que busca</h2>
        <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-5 lg:grid-cols-3">
          <Dato label="Operación">{operacion}</Dato>
          <Dato label="Tipo de inmueble">{tipos}</Dato>
          <Dato label="Zonas">{demanda.zonas?.length ? demanda.zonas.join(", ") : "—"}</Dato>
          <Dato label={demanda.tipo_operacion === "alquiler" ? "Presupuesto €/mes" : "Presupuesto"}>
            {rango(demanda.presupuesto_min, demanda.presupuesto_max, (n) => formatEuro(n))}
          </Dato>
          <Dato label="Superficie">{rango(demanda.superficie_min, demanda.superficie_max, (n) => `${n} m²`)}</Dato>
          <Dato label="Habitaciones">
            {numero(demanda.habitaciones_min) != null ? `desde ${numero(demanda.habitaciones_min)}` : "—"}
          </Dato>
          <Dato label="Baños">{numero(demanda.banos_min) != null ? `desde ${numero(demanda.banos_min)}` : "—"}</Dato>
          <Dato label="Origen">{labelOrigen(demanda.origen)}</Dato>
          <Dato label="Comercial">
            <span className="inline-flex items-center gap-1.5">
              <AvatarComercial nombre={demanda.profiles?.nombre_completo} color={demanda.profiles?.color} size={18} />
              {comercial}
            </span>
          </Dato>
          <div className="col-span-2 lg:col-span-3">
            <Dato label="Imprescindible">{demanda.requisitos?.trim() || "—"}</Dato>
          </div>
        </dl>
      </section>
      <h2 className="mt-6 text-[13px] font-semibold text-[var(--text-2)]">Inmuebles propuestos</h2>
      <ul className="mt-3 space-y-2">
        {matches.map((item) => (
          <li key={item.id} className="rounded-[13px] border border-border bg-[var(--surface)] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <FichaLink tipo="propiedad" id={item.propiedad_id} className="font-semibold text-foreground">
                  {item.propiedades?.titulo || item.propiedades?.direccion || "Inmueble"}
                </FichaLink>
                <p className="text-sm text-[var(--text-2)]">
                  {item.propiedades?.localidad} · {Math.round(Number(item.puntuacion))} pts ·{" "}
                  {ESTADO_MATCHING_LABEL[item.estado as keyof typeof ESTADO_MATCHING_LABEL] ?? item.estado}
                </p>
              </div>
              <Selector
                value={item.estado}
                onChange={(e) => void cambiarMatch(item.id, e.target.value)}
                className="h-9 rounded-lg border px-2 text-sm"
              >
                {ESTADOS_MATCHING.map((estado) => (
                  <option key={estado} value={estado}>
                    {ESTADO_MATCHING_LABEL[estado]}
                  </option>
                ))}
              </Selector>
            </div>
          </li>
        ))}
        {matches.length === 0 ? (
          <li className="text-sm text-[var(--text-2)]">Aún no hay inmuebles propuestos. Pulsa «Buscar en stock».</li>
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
