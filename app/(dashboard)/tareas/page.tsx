"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { isAdmin } from "@/lib/auth/roles";
import { PageHeader } from "@/components/layout/PageHeader";
import { FiltroComercial, type ComercialFiltro } from "@/components/captacion/FiltroComercial";
import { useFiltroComercial } from "@/lib/ui/filtro-comercial";
import { relacionUno } from "@/lib/citas/citas";
import { nombreYApellido } from "@/lib/ui/tokens";
import {
  COLUMNAS_TAREA,
  columnaDeTarea,
  etiquetaVence,
  parseTareaRapida,
  patchAlMoverColumna,
  textoVinculoTarea,
  type ColumnaTarea,
} from "@/lib/tareas/tareas";
import { syncCitaDesdeTarea } from "@/lib/tareas/sync-cita";
import { TareasBoard, AvataresTarea, type TareaTarjeta } from "@/components/tareas/TareasBoard";
import { TareaPanel, type TareaDetalle } from "@/components/tareas/TareaPanel";

function normalizar(row: TareaDetalle & Record<string, unknown>): TareaDetalle {
  return {
    ...row,
    propiedades: relacionUno(row.propiedades as TareaDetalle["propiedades"] | TareaDetalle["propiedades"][] | null),
    clientes: relacionUno(row.clientes as TareaDetalle["clientes"] | TareaDetalle["clientes"][] | null),
    demandas: relacionUno(row.demandas as TareaDetalle["demandas"] | TareaDetalle["demandas"][] | null),
    partes_visita: relacionUno(row.partes_visita as TareaDetalle["partes_visita"] | TareaDetalle["partes_visita"][] | null),
    profiles: relacionUno(row.profiles as TareaDetalle["profiles"] | TareaDetalle["profiles"][] | null),
    creador: relacionUno(row.creador as TareaDetalle["creador"] | TareaDetalle["creador"][] | null),
  };
}

const SELECT_TAREA =
  "id, comercial_id, creado_por, mencionados, titulo, vence, hora, estado, finca_reference, propiedad_id, cliente_id, demanda_id, cita_id, parte_visita_id, created_at, propiedades:propiedad_id(titulo, direccion, referencia), clientes:cliente_id(nombre), demandas:demanda_id(tipo_operacion), partes_visita:parte_visita_id(inmueble_direccion, fecha_visita), profiles:comercial_id(nombre_completo, color, email), creador:creado_por(nombre_completo, color, email)";

function personaDe(
  id: string,
  perfil: { nombre_completo?: string | null; color?: string | null; email?: string | null } | null | undefined,
  equipo: ComercialFiltro[],
  yo: { id: string; nombre?: string | null; email?: string; color?: string | null } | null
) {
  const delEquipo = equipo.find((c) => c.id === id);
  const nombreBruto =
    perfil?.nombre_completo ||
    delEquipo?.nombre ||
    (yo?.id === id ? yo.nombre : null) ||
    perfil?.email ||
    (yo?.id === id ? yo.email : null) ||
    "";
  return {
    id,
    nombre: nombreYApellido(nombreBruto, perfil?.email ?? (yo?.id === id ? yo.email : null)) || nombreBruto || "—",
    color: perfil?.color ?? delEquipo?.color ?? (yo?.id === id ? yo.color ?? null : null),
    email: perfil?.email ?? (yo?.id === id ? yo.email : null) ?? null,
  };
}

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
    void supabase.from("tareas").select(SELECT_TAREA).order("vence").then(({ data, error }) => {
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
    if (!user) return;
    const supabase = createClient();
    void supabase
      .from("profiles")
      .select("id, nombre_completo, email, color")
      .in("role", ["comercial", "admin", "agente", "superadmin"])
      .eq("activo", true)
      .then(({ data }) =>
        setComerciales(
          (data ?? []).map((item) => ({
            id: item.id,
            nombre: item.nombre_completo || item.email || "",
            color: item.color,
          }))
        )
      );
  }, [user]);

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
          creador: personaDe(t.creado_por ?? t.comercial_id, t.creador, comerciales, user),
          asignado: personaDe(t.comercial_id, t.profiles, comerciales, user),
        };
      });
  }, [visibles, hoy, comerciales, user]);

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
        creado_por: user.id,
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
    if (!creada.creador?.nombre_completo && user.nombre) {
      creada.creador = { nombre_completo: user.nombre, color: user.color ?? null, email: user.email };
    }
    if (!creada.profiles?.nombre_completo && user.nombre) {
      creada.profiles = { nombre_completo: user.nombre, color: user.color ?? null, email: user.email };
    }
    if (parsed.hora) {
      await syncCitaDesdeTarea(createClient(), creada, {
        hora: parsed.hora,
        vence: creada.vence,
        titulo: creada.titulo,
      });
    }
    setTitulo("");
    toast.success(parsed.hora ? "Tarea y cita creadas." : "Tarea creada.");
    setTareas((prev) => [creada, ...prev]);
    if (!col) setSel(creada.id);
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
    if (actual?.cita_id) {
      await supabase
        .from("citas")
        .update({ estado: siguiente === "hecha" ? "hecha" : "prevista" })
        .eq("id", actual.cita_id);
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
    setTareas((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const guardarPatch = async (id: string, patch: Record<string, unknown>) => {
    const actual = tareas.find((t) => t.id === id);
    if (!actual) return;
    const supabase = createClient();
    const { error } = await supabase.from("tareas").update(patch).eq("id", id);
    if (error) {
      toast.error("No se ha podido guardar la tarea.");
      return;
    }
    const siguiente = { ...actual, ...patch } as TareaDetalle;
    if (typeof patch.comercial_id === "string") {
      const dest = comerciales.find((c) => c.id === patch.comercial_id);
      if (dest) siguiente.profiles = { nombre_completo: dest.nombre, color: dest.color };
      if (actual.cita_id) {
        await supabase.from("citas").update({ comercial_id: patch.comercial_id }).eq("id", actual.cita_id);
      }
    }
    if (patch.hora !== undefined || patch.vence !== undefined || patch.titulo !== undefined) {
      const citaId = await syncCitaDesdeTarea(createClient(), actual, {
        hora: (patch.hora as string | null | undefined) ?? actual.hora,
        vence: (patch.vence as string | null | undefined) ?? actual.vence,
        titulo: (patch.titulo as string | undefined) ?? actual.titulo,
      });
      if (citaId) siguiente.cita_id = citaId;
    }
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
        description="Todo lo del calendario entra aquí por día. Arrastra entre columnas; lo que tiene hora también aparece en la agenda."
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
          enterKeyHint="done"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Nueva tarea… «Llamar propietario Agra Montes 45 mañana 10:00»"
          className="h-[34px] min-w-0 flex-1 bg-transparent text-[14px] outline-none"
        />
        <span className="hidden whitespace-nowrap pr-1.5 text-[12px] text-[var(--text-3)] min-[820px]:inline">
          ↵ crea · «mañana 10:00» la pone en el calendario
        </span>
        <button
          type="submit"
          aria-label="Crear tarea"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] bg-accent text-white"
        >
          <Check size={16} strokeWidth={2.8} />
        </button>
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
                  <AvataresTarea creador={t.creador} asignado={t.asignado} size={20} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <TareaPanel
        tarea={seleccionada}
        hoy={hoy}
        userId={user?.id ?? ""}
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
