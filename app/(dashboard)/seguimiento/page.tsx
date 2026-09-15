"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { isAdmin } from "@/lib/auth/roles";
import { PageHeader } from "@/components/layout/PageHeader";
import { Chip } from "@/components/ui/chip";
import { Kanban, KanbanCard } from "@/components/ui/kanban";
import { PanelInmueble } from "@/components/inmuebles/PanelInmueble";
import { FiltroComercial, type ComercialFiltro } from "@/components/captacion/FiltroComercial";
import { useFiltroComercial } from "@/lib/ui/filtro-comercial";
import { cargarInmueblePanel, type InmueblePanel } from "@/lib/inmuebles/panel";
import type { FincaCaptacionApi } from "@/lib/catastro-host/captacion-filas";
import { tituloDireccionFinca } from "@/lib/catastro/search-ui";
import { rutaFincaPersistida } from "@/lib/catastro/explorer/history-ui";
import {
  COLUMNAS_FOLLOWUP_FINCA_ABIERTAS,
  COLUMNAS_FOLLOWUP_FINCA_CERRADAS,
  ESTADO_CAPTACION_DOT,
  ESTADO_CAPTACION_LABEL,
  diasDesdeAsignacion,
  parseEstadoCaptacion,
  textoAging,
  type EstadoCaptacion,
} from "@/lib/captacion/estados";
import { detalleCambioEstado } from "@/lib/captacion/actividad";
import { ESTADOS_DEMANDA, ESTADO_DEMANDA_DOT, type EstadoDemanda } from "@/lib/demandas/matching";
import { ESTADOS_INMUEBLE, ESTADO_INMUEBLE_LABEL, formatPrecioInmueble, parseEstadoInmueble } from "@/lib/inmuebles/catalogo";
import { colorEstado } from "@/lib/ui/estados-vista";
import { relacionUno } from "@/lib/citas/citas";
import { useFichaPeek } from "@/components/crm/FichaPeek";

type Tablero = "fincas" | "demandas" | "inmuebles";

type DemandaBoard = {
  id: string;
  cliente: string;
  tipo: string;
  estado: EstadoDemanda;
  zonas: string[] | null;
  comercialId: string;
};

type InmuebleBoard = {
  id: string;
  titulo: string;
  referencia: string | null;
  estado: string;
  precio: number | null;
  comercialId: string | null;
};

export default function SeguimientoPage() {
  const { user } = useAuth();
  const admin = isAdmin(user?.role);
  const { comercialId, setComercialId } = useFiltroComercial();
  const [tab, setTab] = useState<Tablero>("fincas");
  const [cerradas, setCerradas] = useState(false);
  const [fincas, setFincas] = useState<FincaCaptacionApi[]>([]);
  const [demandas, setDemandas] = useState<DemandaBoard[]>([]);
  const [inmuebles, setInmuebles] = useState<InmuebleBoard[]>([]);
  const [comerciales, setComerciales] = useState<ComercialFiltro[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [panel, setPanel] = useState<InmueblePanel | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const hoy = new Date().toISOString().slice(0, 10);
  const { abrir: abrirFicha } = useFichaPeek();

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 819px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!panelId) {
      setPanel(null);
      setPanelLoading(false);
      return;
    }
    let cancelled = false;
    setPanelLoading(true);
    void cargarInmueblePanel(panelId).then((row) => {
      if (cancelled) return;
      setPanel(row);
      setPanelLoading(false);
      if (!row) setError("No se ha podido abrir el inmueble.");
    });
    return () => {
      cancelled = true;
    };
  }, [panelId]);

  const abrirInmueble = (id: string | null | undefined) => {
    if (!id) return;
    setPanelId(id);
  };

  const cargarFincas = () => {
    void fetch("/api/catastro/mine")
      .then(async (res) => {
        const json = (await res.json()) as { ok?: boolean; error?: string; items?: FincaCaptacionApi[] };
        if (!res.ok || !json.ok) {
          setError(json.error ?? "No se han podido cargar las fincas.");
          return;
        }
        setFincas(json.items ?? []);
      })
      .catch(() => setError("No se han podido cargar las fincas."));
  };

  useEffect(() => {
    cargarFincas();
  }, []);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    let dem = supabase
      .from("demandas")
      .select("id, tipo_operacion, estado, zonas, comercial_id, clientes:cliente_id(nombre)")
      .order("updated_at", { ascending: false });
    if (!admin) dem = dem.eq("comercial_id", user.id);
    void dem.then(({ data }) =>
      setDemandas(
        ((data ?? []) as Array<{
          id: string;
          tipo_operacion: string;
          estado: string;
          zonas: string[] | null;
          comercial_id: string;
          clientes?: { nombre?: string } | { nombre?: string }[] | null;
        }>).map((row) => ({
          id: row.id,
          cliente: relacionUno(row.clientes)?.nombre ?? "Cliente",
          tipo: row.tipo_operacion,
          estado: (ESTADOS_DEMANDA.includes(row.estado as EstadoDemanda) ? row.estado : "activa") as EstadoDemanda,
          zonas: row.zonas,
          comercialId: row.comercial_id,
        }))
      )
    );
    let inm = supabase
      .from("propiedades")
      .select("id, titulo, direccion, referencia, estado, precio_venta, precio_alquiler, tipo_operacion, comercial_id")
      .order("updated_at", { ascending: false });
    if (!admin) inm = inm.eq("comercial_id", user.id);
    void inm.then(({ data }) =>
      setInmuebles(
        (data ?? []).map((row) => ({
          id: row.id,
          titulo: row.titulo || row.direccion || "Inmueble",
          referencia: row.referencia,
          estado: row.estado,
          precio: row.tipo_operacion === "alquiler" ? row.precio_alquiler : row.precio_venta,
          comercialId: row.comercial_id,
        }))
      )
    );
  }, [user, admin]);

  useEffect(() => {
    if (!admin) return;
    const supabase = createClient();
    void supabase
      .from("profiles")
      .select("id, nombre_completo, email, color")
      .in("role", ["comercial", "admin", "superadmin"])
      .eq("activo", true)
      .then(({ data }) =>
        setComerciales(
          (data ?? []).map((item) => ({
            id: item.id,
            nombre: item.nombre_completo || item.email || "Comercial",
            color: item.color,
          }))
        )
      );
  }, [admin]);

  const fincasVis = useMemo(
    () => (comercialId ? fincas.filter((f) => f.comercialId === comercialId) : fincas),
    [fincas, comercialId]
  );
  const demandasVis = useMemo(
    () => (comercialId ? demandas.filter((d) => d.comercialId === comercialId) : demandas),
    [demandas, comercialId]
  );
  const inmueblesVis = useMemo(
    () => (comercialId ? inmuebles.filter((p) => p.comercialId === comercialId) : inmuebles),
    [inmuebles, comercialId]
  );

  const colsFinca = (cerradas ? [...COLUMNAS_FOLLOWUP_FINCA_ABIERTAS, ...COLUMNAS_FOLLOWUP_FINCA_CERRADAS] : COLUMNAS_FOLLOWUP_FINCA_ABIERTAS).map(
    (id) => ({ id, label: ESTADO_CAPTACION_LABEL[id], dot: ESTADO_CAPTACION_DOT[id] })
  );

  const moverFinca = async (id: string, estado: EstadoCaptacion) => {
    const actual = fincas.find((f) => f.fincaReference === id);
    if (!actual || actual.estado === estado) return;
    const supabase = createClient();
    const { error: err } = await supabase.from("catastro_explorer_pipeline").upsert(
      {
        finca_reference: id,
        estado,
        proxima_accion: actual.proximaAccion,
        proxima_accion_en: actual.proximaAccionEn,
        updated_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "finca_reference" }
    );
    if (err) {
      toast.error("No se ha podido mover la finca.");
      return;
    }
    await supabase.from("catastro_explorer_actividad").insert({
      finca_reference: id,
      actor_id: user?.id ?? null,
      tipo: "estado",
      detalle: detalleCambioEstado(actual.estado, estado),
      payload: { de: actual.estado, a: estado },
    });
    setFincas((prev) => prev.map((f) => (f.fincaReference === id ? { ...f, estado } : f)));
  };

  const moverDemanda = async (id: string, estado: EstadoDemanda) => {
    const supabase = createClient();
    const { error: err } = await supabase.from("demandas").update({ estado }).eq("id", id);
    if (err) {
      toast.error("No se ha podido mover la demanda.");
      return;
    }
    setDemandas((prev) => prev.map((d) => (d.id === id ? { ...d, estado } : d)));
  };

  const moverInmueble = async (id: string, estado: (typeof ESTADOS_INMUEBLE)[number]) => {
    const supabase = createClient();
    const { error: err } = await supabase.from("propiedades").update({ estado }).eq("id", id);
    if (err) {
      toast.error("No se ha podido mover el inmueble.");
      return;
    }
    setInmuebles((prev) => prev.map((p) => (p.id === id ? { ...p, estado } : p)));
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Seguimiento" }]}
        title="Seguimiento"
        description="Tableros de follow-up. Arrastra las tarjetas entre columnas."
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(["fincas", "demandas", "inmuebles"] as const).map((item) => (
          <Chip
            key={item}
            active={tab === item}
            onClick={() => {
              setTab(item);
              setPanelId(null);
            }}
          >
            {item === "fincas" ? "Fincas" : item === "demandas" ? "Demandas" : "Inmuebles"}
          </Chip>
        ))}
        {tab === "fincas" ? (
          <Chip active={cerradas} onClick={() => setCerradas((v) => !v)}>
            Cerradas
          </Chip>
        ) : null}
      </div>

      {admin ? (
        <div className="mt-4">
          <FiltroComercial comerciales={comerciales} valor={comercialId} onChange={setComercialId} />
        </div>
      ) : null}

      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

      <div className="mt-5 flex items-start gap-4">
        <div className="min-w-0 flex-1">
        {tab === "fincas" ? (
          <Kanban
            columns={colsFinca}
            items={fincasVis.map((f) => ({ ...f, id: f.fincaReference }))}
            colOf={(item) => parseEstadoCaptacion(item.estado)}
            onMove={(id, col) => void moverFinca(id, col)}
            selectedId={fincasVis.find((f) => f.propertyId === panelId)?.fincaReference ?? null}
            onSelect={(item) => {
              if (item.propertyId) abrirInmueble(item.propertyId);
            }}
            renderCard={(item) => (
              <KanbanCard
                href={item.propertyId ? undefined : rutaFincaPersistida(item.fincaReference)}
                title={tituloDireccionFinca(item.finca)}
                meta={item.fincaReference}
                tag={
                  [
                    item.propertyId ? "Inmueble vinculado" : null,
                    item.proximaAccion,
                    item.proximaAccionEn,
                    textoAging(diasDesdeAsignacion(item.assignedAt, hoy)),
                  ]
                    .filter(Boolean)
                    .join(" · ") || undefined
                }
              />
            )}
          />
        ) : null}

        {tab === "demandas" ? (
          <Kanban
            columns={ESTADOS_DEMANDA.map((id) => ({ id, label: id, dot: ESTADO_DEMANDA_DOT[id] }))}
            items={demandasVis}
            colOf={(item) => item.estado}
            onMove={(id, col) => void moverDemanda(id, col)}
            renderCard={(item) => (
              <KanbanCard
                onClick={() => abrirFicha({ tipo: "demanda", id: item.id })}
                title={item.cliente}
                meta={item.tipo}
                tag={item.zonas?.slice(0, 2).join(" · ") || undefined}
              />
            )}
          />
        ) : null}

        {tab === "inmuebles" ? (
          <Kanban
            columns={ESTADOS_INMUEBLE.map((id) => ({
              id,
              label: ESTADO_INMUEBLE_LABEL[id],
              dot: colorEstado(id),
            }))}
            items={inmueblesVis}
            colOf={(item) => parseEstadoInmueble(item.estado)}
            onMove={(id, col) => void moverInmueble(id, col)}
            selectedId={panelId}
            onSelect={(item) => abrirInmueble(item.id)}
            renderCard={(item) => (
              <KanbanCard
                title={item.titulo}
                meta={item.referencia ?? undefined}
                tag={formatPrecioInmueble(item.precio)}
              />
            )}
          />
        ) : null}
        </div>
        {panelId ? (
          <PanelInmueble
            inmueble={panel}
            loading={panelLoading}
            overlay={narrow}
            onClose={() => {
              setPanelId(null);
              setPanel(null);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
