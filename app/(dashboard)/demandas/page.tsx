"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { ESTADOS_DEMANDA, TIPO_OPERACION_DEMANDA_LABEL, type TipoOperacionDemanda } from "@/lib/demandas/matching";
import { relacionUno } from "@/lib/citas/citas";
import { Chip } from "@/components/ui/chip";
import { AvatarComercial } from "@/components/ui/avatar-comercial";
import { colorEstado, formatEuro } from "@/lib/ui/estados-vista";
import { NuevaDemandaPanel } from "@/components/demandas/NuevaDemandaPanel";
import { TIPO_INMUEBLE_LABEL, type TipoInmueble } from "@/lib/inmuebles/catalogo";

type DemandaRow = {
  id: string;
  tipo_operacion: string;
  estado: string;
  zonas: string[] | null;
  tipos_inmueble: string[] | null;
  presupuesto_max: number | null;
  habitaciones_min: number | null;
  clientes?: { nombre?: string | null } | null;
  profiles?: { nombre_completo?: string | null; color?: string | null } | null;
  demanda_inmuebles?: Array<{ id: string; estado: string }> | null;
};

function labelTipos(tipos: string[] | null | undefined): string {
  if (!tipos?.length) return "";
  return tipos.map((t) => TIPO_INMUEBLE_LABEL[t as TipoInmueble] ?? t).join(", ");
}

export default function DemandasPage() {
  const [filas, setFilas] = useState<DemandaRow[]>([]);
  const [totales, setTotales] = useState<Record<string, number>>({});
  const [estado, setEstado] = useState("activa");
  const [nuevaOpen, setNuevaOpen] = useState(false);
  const [clienteInicial, setClienteInicial] = useState<string | undefined>();

  const cargarTotales = () => {
    const supabase = createClient();
    void supabase.from("demandas").select("estado").then(({ data }) => {
      const map: Record<string, number> = {};
      for (const item of ESTADOS_DEMANDA) map[item] = 0;
      for (const row of data ?? []) {
        const e = (row as { estado: string }).estado;
        map[e] = (map[e] ?? 0) + 1;
      }
      setTotales(map);
    });
  };

  const cargarFilas = (estadoActual = estado) => {
    const supabase = createClient();
    void supabase
      .from("demandas")
      .select(
        "id, tipo_operacion, estado, zonas, tipos_inmueble, presupuesto_max, habitaciones_min, clientes:cliente_id(nombre), profiles:comercial_id(nombre_completo, color), demanda_inmuebles(id, estado)"
      )
      .eq("estado", estadoActual)
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
            demanda_inmuebles: Array.isArray(fila.demanda_inmuebles)
              ? fila.demanda_inmuebles
              : fila.demanda_inmuebles
                ? [fila.demanda_inmuebles]
                : [],
          }))
        )
      );
  };

  useEffect(() => {
    cargarTotales();
  }, []);

  useEffect(() => {
    cargarFilas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("nueva") !== "1") return;
    setClienteInicial(q.get("cliente") ?? undefined);
    setNuevaOpen(true);
    window.history.replaceState({}, "", "/demandas");
  }, []);

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Demandas" }]}
        title="Demandas"
        description="Lo que busca cada cliente. El matching se confirma a mano."
        actions={
          <Button type="button" size="sm" onClick={() => { setClienteInicial(undefined); setNuevaOpen(true); }}>
            Nueva demanda
          </Button>
        }
      />
      <div className="mt-4 flex flex-wrap gap-1.5">
        {ESTADOS_DEMANDA.map((item) => (
          <Chip key={item} active={estado === item} count={totales[item] ?? 0} onClick={() => setEstado(item)}>
            {item}
          </Chip>
        ))}
      </div>
      <ul className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
        {filas.map((fila) => {
          const matches = fila.demanda_inmuebles ?? [];
          const encajan = matches.filter((m) => m.estado !== "descartado").length;
          const visitados = matches.filter((m) => m.estado === "visitado").length;
          const chips = [
            ...(fila.zonas ?? []).slice(0, 2),
            fila.presupuesto_max != null ? `hasta ${formatEuro(fila.presupuesto_max)}` : null,
            fila.habitaciones_min != null ? `${fila.habitaciones_min}+ hab` : null,
          ].filter(Boolean) as string[];
          const tipos = labelTipos(fila.tipos_inmueble);
          const operacion = TIPO_OPERACION_DEMANDA_LABEL[fila.tipo_operacion as TipoOperacionDemanda] ?? fila.tipo_operacion;
          return (
            <li key={fila.id}>
              <Link
                href={`/demandas/${fila.id}`}
                className="block rounded-[13px] border border-border bg-white px-[15px] py-3.5 hover:border-accent"
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold">{fila.clientes?.nombre ?? "Cliente"}</p>
                    <p className="mt-0.5 text-[12.5px] text-[var(--text-2)]">
                      {operacion}
                      {tipos ? ` · ${tipos}` : ""}
                    </p>
                  </div>
                  <span
                    className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{ background: `${colorEstado(fila.estado)}1A`, color: colorEstado(fila.estado) }}
                  >
                    {fila.estado}
                  </span>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {chips.map((chip) => (
                    <span key={chip} className="rounded-md bg-[#F4F3EF] px-2 py-0.5 text-[11.5px] text-[var(--text-2)]">
                      {chip}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-[var(--border-soft)] pt-2.5">
                  <span className="flex items-center gap-1.5 text-[12.5px] text-[var(--text-2)]">
                    <AvatarComercial nombre={fila.profiles?.nombre_completo} color={fila.profiles?.color} size={18} />
                    {fila.profiles?.nombre_completo ?? "Sin comercial"}
                  </span>
                  <span className="text-[12.5px] font-semibold" style={{ color: encajan ? "#0B7461" : "#8A938F" }}>
                    {encajan} encajan{visitados ? ` · ${visitados} visitado${visitados === 1 ? "" : "s"}` : ""}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
        {filas.length === 0 ? (
          <li className="rounded-[10px] border border-dashed border-[var(--input)] px-4 py-10 text-center text-[12.5px] text-[var(--text-2)]">
            No hay demandas en este estado.
          </li>
        ) : null}
      </ul>
      <NuevaDemandaPanel
        open={nuevaOpen}
        onOpenChange={setNuevaOpen}
        clienteIdInicial={clienteInicial}
        onCreada={() => {
          setEstado("activa");
          cargarTotales();
          cargarFilas("activa");
        }}
      />
    </div>
  );
}
