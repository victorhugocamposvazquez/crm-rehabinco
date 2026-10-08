"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Fab } from "@/components/ui/fab";
import { Button } from "@/components/ui/button";
import { ESTADOS_DEMANDA, TIPO_OPERACION_DEMANDA_LABEL, type TipoOperacionDemanda } from "@/lib/demandas/matching";
import { relacionUno } from "@/lib/citas/citas";
import { Chip } from "@/components/ui/chip";
import { CarrilHorizontal } from "@/components/ui/carril-horizontal";
import { AvatarComercial } from "@/components/ui/avatar-comercial";
import { colorEstado, formatEuro } from "@/lib/ui/estados-vista";
import { NuevaDemandaPanel } from "@/components/demandas/NuevaDemandaPanel";
import { TIPO_INMUEBLE_LABEL, type TipoInmueble } from "@/lib/inmuebles/catalogo";
import { extraAlta } from "@/lib/ui/alta-panel";
import { cn } from "@/lib/utils";
import { useHayAltaBorrador } from "@/lib/ui/use-alta-borrador";
import { FILTRO_LISTADO_VACIO, hayFiltroListado, pasaFiltroDemanda, type FiltroListadoDemanda } from "@/lib/demandas/filtros";
import { FiltrosDemandas, tiposVisibles } from "@/components/demandas/FiltrosDemandas";

type DemandaRow = {
  id: string;
  comercial_id: string | null;
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filas, setFilas] = useState<DemandaRow[]>([]);
  const [estado, setEstado] = useState("activa");
  const [filtro, setFiltro] = useState<FiltroListadoDemanda>(FILTRO_LISTADO_VACIO);
  const [nuevaOpen, setNuevaOpen] = useState(false);
  const [clienteInicial, setClienteInicial] = useState<string | undefined>();
  const hayBorrador = useHayAltaBorrador("demanda");

  const cargarFilas = () => {
    const supabase = createClient();
    void supabase
      .from("demandas")
      .select(
        "id, comercial_id, tipo_operacion, estado, zonas, tipos_inmueble, presupuesto_max, habitaciones_min, clientes:cliente_id(nombre), profiles:comercial_id(nombre_completo, color), demanda_inmuebles(id, estado)"
      )
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
    cargarFilas();
  }, []);

  useEffect(() => {
    const extra = extraAlta(searchParams);
    if (!extra) return;
    setClienteInicial(extra.get("cliente") ?? undefined);
    setNuevaOpen(true);
    router.replace("/demandas", { scroll: false });
  }, [searchParams, router]);

  const totales = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of ESTADOS_DEMANDA) map[item] = 0;
    for (const fila of filas) map[fila.estado] = (map[fila.estado] ?? 0) + 1;
    return map;
  }, [filas]);

  const delEstado = useMemo(() => filas.filter((fila) => fila.estado === estado), [filas, estado]);

  const visibles = useMemo(
    () =>
      delEstado.filter((fila) =>
        pasaFiltroDemanda(
          {
            tipo_operacion: fila.tipo_operacion,
            tipos_inmueble: fila.tipos_inmueble,
            zonas: fila.zonas,
            comercial_id: fila.comercial_id,
            cliente: fila.clientes?.nombre,
            comercial: fila.profiles?.nombre_completo,
          },
          filtro
        )
      ),
    [delEstado, filtro]
  );

  const tipos = useMemo(() => {
    const presentes = delEstado.flatMap((fila) => fila.tipos_inmueble ?? []);
    return tiposVisibles(presentes, filtro.tipo);
  }, [delEstado, filtro.tipo]);

  const zonas = useMemo(() => {
    const set = new Set(delEstado.flatMap((fila) => (fila.zonas ?? []).map((zona) => zona.trim()).filter(Boolean)));
    if (filtro.zona) set.add(filtro.zona);
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [delEstado, filtro.zona]);

  const comerciales = useMemo(() => {
    const map = new Map<string, string>();
    for (const fila of delEstado) {
      if (!fila.comercial_id) continue;
      map.set(fila.comercial_id, fila.profiles?.nombre_completo?.trim() || "Sin nombre");
    }
    if (filtro.comercialId && !map.has(filtro.comercialId)) map.set(filtro.comercialId, "Comercial");
    return [...map.entries()]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [delEstado, filtro.comercialId]);

  const hayFiltro = hayFiltroListado(filtro);

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Demandas" }]}
        title="Demandas"
        description="Lo que busca cada cliente. Al crear, proponemos stock publicado; tú confirmas."
        hideActionsOnMobile
        actions={
          <Button type="button" size="sm" onClick={() => { setClienteInicial(undefined); setNuevaOpen(true); }}>
            {hayBorrador ? "Continuar borrador" : "Nueva demanda"}
          </Button>
        }
      />
      <CarrilHorizontal className="mt-4" trackClassName="gap-1.5" label="Estado de la demanda">
        {ESTADOS_DEMANDA.map((item) => (
          <Chip key={item} active={estado === item} count={totales[item] ?? 0} onClick={() => setEstado(item)}>
            {item}
          </Chip>
        ))}
      </CarrilHorizontal>
      <FiltrosDemandas
        filtro={filtro}
        onChange={setFiltro}
        tipos={tipos}
        zonas={zonas}
        comerciales={comerciales}
      />
      {hayFiltro ? (
        <p className="mt-2 text-[12.5px] text-[var(--text-2)]">
          {visibles.length} {visibles.length === 1 ? "demanda" : "demandas"}
        </p>
      ) : null}
      <ul className="mt-4 grid grid-cols-1 gap-3 min-[640px]:[grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
        {visibles.map((fila) => {
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
                className="block rounded-[13px] border border-border bg-[var(--surface)] px-[15px] py-3.5 hover:border-accent"
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
                    style={{
                      background: `color-mix(in srgb, ${colorEstado(fila.estado)} 16%, transparent)`,
                      color: colorEstado(fila.estado),
                    }}
                  >
                    {fila.estado}
                  </span>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {chips.map((chip) => (
                    <span key={chip} className="rounded-md bg-[var(--surface-soft)] px-2 py-0.5 text-[11.5px] text-[var(--text-2)]">
                      {chip}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-[var(--border-soft)] pt-2.5">
                  <span className="flex items-center gap-1.5 text-[12.5px] text-[var(--text-2)]">
                    <AvatarComercial nombre={fila.profiles?.nombre_completo} color={fila.profiles?.color} size={18} />
                    {fila.profiles?.nombre_completo ?? "Sin comercial"}
                  </span>
                  <span className={cn("text-[12.5px] font-semibold", encajan ? "text-foreground" : "text-[var(--text-3)]")}>
                    {encajan} encajan{visitados ? ` · ${visitados} visitado${visitados === 1 ? "" : "s"}` : ""}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
        {visibles.length === 0 ? (
          <li className="rounded-[10px] border border-dashed border-[var(--input)] px-4 py-10 text-center text-[12.5px] text-[var(--text-2)]">
            {hayFiltro ? "Ninguna demanda con esos filtros." : "No hay demandas en este estado."}
          </li>
        ) : null}
      </ul>
      <Fab
        onClick={() => {
          setClienteInicial(undefined);
          setNuevaOpen(true);
        }}
        label={hayBorrador ? "Continuar borrador" : "Nueva demanda"}
      />
      <NuevaDemandaPanel
        open={nuevaOpen}
        onOpenChange={(open) => {
          setNuevaOpen(open);
          if (!open) setClienteInicial(undefined);
        }}
        clienteIdInicial={clienteInicial}
        onCreada={() => {
          setEstado("activa");
          cargarFilas();
        }}
      />
    </div>
  );
}
