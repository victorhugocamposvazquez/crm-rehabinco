"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { LayoutGrid, List, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { isAdmin } from "@/lib/auth/roles";
import { PageHeader } from "@/components/layout/PageHeader";
import { FiltroComercial, type ComercialFiltro } from "@/components/captacion/FiltroComercial";
import { useFiltroComercial } from "@/lib/ui/filtro-comercial";
import { relacionUno } from "@/lib/citas/citas";
import {
  COLUMNAS_TAREA,
  columnaDeTarea,
  etiquetaVence,
  parseTareaRapida,
  patchAlMoverColumna,
  textoVinculoTarea,
  type ColumnaTarea,
} from "@/lib/tareas/tareas";
import { TareasBoard, type TareaTarjeta } from "@/components/tareas/TareasBoard";
import { TareaPanel, type TareaDetalle } from "@/components/tareas/TareaPanel";

function normalizar(row: TareaDetalle & Record<string, unknown>): TareaDetalle {
  return {
    ...row,
    propiedades: relacionUno(row.propiedades as TareaDetalle["propiedades"] | TareaDetalle["propiedades"][] | null),
    clientes: relacionUno(row.clientes as TareaDetalle["clientes"] | TareaDetalle["clientes"][] | null),
    demandas: relacionUno(row.demandas as TareaDetalle["demandas"] | TareaDetalle["demandas"][] | null),
    partes_visita: relacionUno(row.partes_visita as TareaDetalle["partes_visita"] | TareaDetalle["partes_visita"][] | null),
    profiles: relacionUno(row.profiles as TareaDetalle["profiles"] | TareaDetalle["profiles"][] | null),
  };
}

const SELECT_TAREA =
  "id, comercial_id, titulo, vence, hora, estado, finca_reference, propiedad_id, cliente_id, demanda_id, cita_id, parte_visita_id, created_at, propiedades:propiedad_id(titulo, direccion, referencia), clientes:cliente_id(nombre), demandas:demanda_id(tipo_operacion), partes_visita:parte_visita_id(inmueble_direccion, fecha_visita), profiles:comercial_id(nombre_completo, color)";

export default function TareasPage() {
  const { user } = useAuth();
  const admin = isAdmin(user?.role);
  const hoy = new Date().toISOString().slice(0, 10);
  const { comercialId, setComercialId } = useFiltroComercial();
  const [tareas, setTareas] = useState<TareaDetalle[]>([]);
  const [titulo, setTitulo] = useState("");
  const [comerciales, setComerciales] = useState<ComercialFiltro[]>([]);
  const [vista, setVista] = useState<"tablero" | "lista">("tablero");
  const [sel, setSel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const cargar = () => {
    if (!user) return;
    const supabase = createClient();
    let q = supabase.from("tareas").select(SELECT_TAREA).order("vence");
    if (!admin) q = q.eq("comercial_id", user.id);
    void q.then(({ data, error }) => {
      if (error) {
        toast.error("No se han podido cargar las tareas.");
        setLoading(false);
        return;
      }
      setTareas(((data ?? []) as Array<TareaDetalle & Record<string, unknown>>).map(normalizar));
      setLoading(false);
    });
  };

  useEffect(() => {
    if (!admin) return;
    const supabase = createClient();
    void supabase
      .from("profiles")
      .select("id, nombre_completo, email, color")
      .in("role", ["comercial", "admin"])
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

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, admin]);

  const visibles = comercialId ? tareas.filter((item) => item.comercial_id === comercialId) : tareas;

  const tarjetas: TareaTarjeta[] = useMemo(() => {
    const corteHechas = new Date();
    corteHechas.setDate(corteHechas.getDate() - 7);
    const corte = corteHechas.toISOString().slice(0, 10);
    return visibles
      .filter((t) => t.estado !== "hecha" || (t.vence ?? t.id) >= corte || !t.vence)
      .map((t) => {
        const v = etiquetaVence(t.vence, hoy);
        return {
          id: t.id,
          titulo: t.titulo,
          col: columnaDeTarea(t.vence, hoy, t.estado),
          venceLabel: v.label,
          hora: t.hora,
          vencida: v.vencida,
          hecha: t.estado === "hecha",
          link: (() => {
            const texto = textoVinculoTarea({
              propiedad: t.propiedades?.referencia || t.propiedades?.titulo || t.propiedades?.direccion,
              cliente: t.clientes?.nombre,
              finca: t.finca_reference,
              demanda: t.demandas?.tipo_operacion,
              parte: t.partes_visita?.inmueble_direccion,
            });
            return texto === "Sin vincular" ? null : texto;
          })(),
          comercial: {
            nombre: t.profiles?.nombre_completo || "Comercial",
            color: t.profiles?.color ?? null,
          },
        };
      });
  }, [visibles, hoy]);

  const registrar = async (tareaId: string, texto: string, tipo = "nota") => {
    if (!user) return;
    const supabase = createClient();
    await supabase.from("tareas_actividad").insert({
      tarea_id: tareaId,
      actor_id: user.id,
      tipo,
      texto,
    });
  };

  const syncCita = async (tarea: TareaDetalle, patch: { hora?: string | null; vence?: string | null; titulo?: string }) => {
    const hora = (patch.hora !== undefined ? patch.hora : tarea.hora)?.slice(0, 5) ?? null;
    const vence = (patch.vence !== undefined ? patch.vence : tarea.vence) ?? hoy;
    const tituloCita = patch.titulo ?? tarea.titulo;
    if (!hora) return tarea.cita_id ?? null;
    const supabase = createClient();
    const [hh, mm] = hora.split(":").map(Number);
    const empieza = new Date(`${vence}T12:00:00`);
    empieza.setHours(hh || 12, mm || 0, 0, 0);
    const termina = new Date(empieza);
    termina.setHours(empieza.getHours() + 1);
    if (tarea.cita_id) {
      await supabase
        .from("citas")
        .update({ empieza: empieza.toISOString(), termina: termina.toISOString(), titulo: tituloCita })
        .eq("id", tarea.cita_id);
      return tarea.cita_id;
    }
    const { data } = await supabase
      .from("citas")
      .insert({
        comercial_id: tarea.comercial_id,
        tipo: "otro",
        titulo: tituloCita,
        empieza: empieza.toISOString(),
        termina: termina.toISOString(),
        tarea_id: tarea.id,
        propiedad_id: tarea.propiedad_id,
        cliente_id: tarea.cliente_id,
      })
      .select("id")
      .single();
    if (data?.id) {
      await supabase.from("tareas").update({ cita_id: data.id }).eq("id", tarea.id);
    }
    return data?.id ?? null;
  };

  const crearCon = async (texto: string, col?: ColumnaTarea) => {
    if (!user) return;
    const parsed = parseTareaRapida(texto);
    if (!parsed.titulo) {
      toast.error("Pon un título a la tarea.");
      return;
    }
    const extra = col ? patchAlMoverColumna(col, hoy) : { estado: "pendiente" as const, vence: parsed.vence };
    const supabase = createClient();
    const { data, error } = await supabase
      .from("tareas")
      .insert({
        comercial_id: user.id,
        titulo: parsed.titulo,
        vence: extra.vence ?? parsed.vence,
        hora: parsed.hora,
        estado: extra.estado,
      })
      .select(SELECT_TAREA)
      .single();
    if (error || !data) {
      toast.error("No se ha podido crear la tarea.");
      return;
    }
    const creada = normalizar(data as TareaDetalle & Record<string, unknown>);
    await registrar(creada.id, `Creada por ${user.nombre?.split(" ")[0] ?? "ti"}`, "creada");
    if (parsed.hora) {
      await syncCita(creada, { hora: parsed.hora, vence: creada.vence, titulo: creada.titulo });
      await registrar(creada.id, `Añadida al calendario a las ${parsed.hora}`, "calendario");
    }
    setTitulo("");
    toast.success(parsed.hora ? "Tarea y cita creadas." : "Tarea creada.");
    setTareas((prev) => [creada, ...prev]);
    setSel(creada.id);
    cargar();
  };

  const marcar = async (id: string) => {
    const actual = tareas.find((t) => t.id === id);
    const siguiente = actual?.estado === "hecha" ? "pendiente" : "hecha";
    const supabase = createClient();
    const { error } = await supabase.from("tareas").update({ estado: siguiente }).eq("id", id);
    if (error) {
      toast.error("No se ha podido actualizar la tarea.");
      return;
    }
    if (actual) {
      await registrar(id, siguiente === "hecha" ? "Marcada como hecha" : "Reabierta", "estado");
    }
    setTareas((prev) => prev.map((item) => (item.id === id ? { ...item, estado: siguiente } : item)));
  };

  const mover = async (id: string, col: ColumnaTarea) => {
    const patch = patchAlMoverColumna(col, hoy);
    const supabase = createClient();
    const { error } = await supabase.from("tareas").update(patch).eq("id", id);
    if (error) {
      toast.error("No se ha podido mover la tarea.");
      return;
    }
    await registrar(id, `Movida a ${COLUMNAS_TAREA.find((c) => c.id === col)?.label ?? col}`, "estado");
    setTareas((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const guardarPatch = async (id: string, patch: Record<string, unknown>, actividad?: string) => {
    const actual = tareas.find((t) => t.id === id);
    if (!actual) return;
    const supabase = createClient();
    const { error } = await supabase.from("tareas").update(patch).eq("id", id);
    if (error) {
      toast.error("No se ha podido guardar la tarea.");
      return;
    }
    const siguiente = { ...actual, ...patch } as TareaDetalle;
    if (patch.hora !== undefined || patch.vence !== undefined || patch.titulo !== undefined) {
      const citaId = await syncCita(actual, {
        hora: (patch.hora as string | null | undefined) ?? actual.hora,
        vence: (patch.vence as string | null | undefined) ?? actual.vence,
        titulo: (patch.titulo as string | undefined) ?? actual.titulo,
      });
      if (citaId) siguiente.cita_id = citaId;
    }
    if (actividad) await registrar(id, actividad, patch.hora ? "calendario" : "vinculo");
    setTareas((prev) => prev.map((item) => (item.id === id ? siguiente : item)));
    if (patch.propiedad_id || patch.cliente_id || patch.demanda_id || patch.parte_visita_id) {
      cargar();
    }
  };

  const seleccionada = tareas.find((t) => t.id === sel) ?? null;

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Tareas" }]}
        title="Tareas"
        description="Arrastra entre columnas. Lo que tiene hora pasa al calendario."
        actions={
          <div className="flex overflow-hidden rounded-[9px] border border-border">
            <button
              type="button"
              onClick={() => setVista("tablero")}
              className={`h-8 px-3 text-[12.5px] font-semibold ${vista === "tablero" ? "bg-foreground text-white" : "bg-white text-[var(--text-2)]"}`}
            >
              Tablero
            </button>
            <button
              type="button"
              onClick={() => setVista("lista")}
              className={`h-8 px-3 text-[12.5px] font-semibold ${vista === "lista" ? "bg-foreground text-white" : "bg-white text-[var(--text-2)]"}`}
            >
              Lista
            </button>
          </div>
        }
      />

      {admin ? (
        <div className="mt-4">
          <FiltroComercial comerciales={comerciales} valor={comercialId} onChange={setComercialId} />
        </div>
      ) : null}

      <form
        className="mt-4 flex items-center gap-2.5 rounded-[12px] border border-[var(--input)] bg-white py-1.5 pl-3.5 pr-2"
        onSubmit={(e) => {
          e.preventDefault();
          void crearCon(titulo);
        }}
      >
        <Plus className="shrink-0 text-accent" size={15} strokeWidth={2.6} />
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Nueva tarea… «Llamar propietario Agra Montes 45 mañana 10:00»"
          className="h-[34px] min-w-0 flex-1 bg-transparent text-[14px] outline-none"
        />
        <span className="hidden whitespace-nowrap pr-1.5 text-[12px] text-[var(--text-3)] min-[820px]:inline">
          ↵ crea · «mañana 10:00» la pone en el calendario
        </span>
      </form>

      <div className="mt-5">
        {loading ? (
          <div className="rounded-[10px] border border-dashed border-[var(--input)] px-3 py-8 text-center text-[12.5px] text-[var(--text-2)]">
            Cargando tareas…
          </div>
        ) : vista === "tablero" ? (
          <TareasBoard
            tareas={tarjetas}
            onMover={(id, col) => void mover(id, col)}
            onToggle={(id) => void marcar(id)}
            onAbrir={setSel}
            onCrearEnColumna={(col, texto) => void crearCon(texto, col)}
          />
        ) : (
          <ul className="overflow-hidden rounded-[14px] border border-border bg-white">
            {tarjetas.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setSel(t.id)}
                  className="flex w-full items-center gap-3 border-b border-[var(--border-row)] px-4 py-2.5 text-left last:border-0 hover:bg-[var(--surface-soft)]"
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: COLUMNAS_TAREA.find((c) => c.id === t.col)?.dot }} />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{t.titulo}</span>
                  <span className="text-[12px] text-[var(--text-2)]">{t.venceLabel}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <TareaPanel
        tarea={seleccionada}
        hoy={hoy}
        admin={admin}
        comerciales={comerciales}
        onClose={() => setSel(null)}
        onPatch={guardarPatch}
        onToggle={(id) => void marcar(id)}
        onMover={(id, col) => {
          void mover(id, col);
        }}
      />
    </div>
  );
}
