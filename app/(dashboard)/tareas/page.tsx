"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { LayoutGrid, List } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { isAdmin } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { FiltroComercial, type ComercialFiltro } from "@/components/captacion/FiltroComercial";
import { useFiltroComercial } from "@/lib/ui/filtro-comercial";
import { relacionUno } from "@/lib/citas/citas";
import { rutaFincaPersistida } from "@/lib/catastro/explorer/history-ui";
import {
  COLUMNAS_TAREA,
  columnaDeTarea,
  parseTareaRapida,
  patchAlMoverColumna,
  type ColumnaTarea,
} from "@/lib/tareas/tareas";
import { TareasBoard, type TareaTarjeta } from "@/components/tareas/TareasBoard";

type TareaRow = {
  id: string;
  comercial_id: string;
  titulo: string;
  vence: string | null;
  hora?: string | null;
  estado: string;
  finca_reference: string | null;
  propiedad_id: string | null;
  cliente_id: string | null;
  cita_id?: string | null;
  propiedades?: { titulo?: string | null; direccion?: string | null; referencia?: string | null } | null;
  clientes?: { nombre?: string | null } | null;
  profiles?: { nombre_completo?: string | null; color?: string | null } | null;
};

function etiquetaVence(vence: string | null, hoy: string): { label: string; vencida: boolean } {
  if (!vence) return { label: "Sin fecha", vencida: false };
  if (vence < hoy) return { label: "Ayer", vencida: true };
  if (vence === hoy) return { label: "Hoy", vencida: false };
  const d = new Date(`${vence}T12:00:00`);
  return { label: d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric" }), vencida: false };
}

export default function TareasPage() {
  const { user } = useAuth();
  const admin = isAdmin(user?.role);
  const hoy = new Date().toISOString().slice(0, 10);
  const { comercialId, setComercialId } = useFiltroComercial();
  const [tareas, setTareas] = useState<TareaRow[]>([]);
  const [titulo, setTitulo] = useState("");
  const [comerciales, setComerciales] = useState<ComercialFiltro[]>([]);
  const [vista, setVista] = useState<"tablero" | "lista">("tablero");
  const [sel, setSel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const cargar = () => {
    if (!user) return;
    const supabase = createClient();
    let q = supabase
      .from("tareas")
      .select(
        "id, comercial_id, titulo, vence, hora, estado, finca_reference, propiedad_id, cliente_id, cita_id, propiedades:propiedad_id(titulo, direccion, referencia), clientes:cliente_id(nombre), profiles:comercial_id(nombre_completo, color)"
      )
      .order("vence");
    if (!admin) q = q.eq("comercial_id", user.id);
    void q.then(({ data }) => {
      setTareas(
        ((data ?? []) as Array<TareaRow & { propiedades?: TareaRow["propiedades"] | TareaRow["propiedades"][]; clientes?: TareaRow["clientes"] | TareaRow["clientes"][]; profiles?: TareaRow["profiles"] | TareaRow["profiles"][] }>).map((row) => ({
          ...row,
          propiedades: relacionUno(row.propiedades),
          clientes: relacionUno(row.clientes),
          profiles: relacionUno(row.profiles),
        }))
      );
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
        const link =
          t.propiedades?.referencia ||
          t.propiedades?.titulo ||
          t.clientes?.nombre ||
          t.finca_reference ||
          null;
        return {
          id: t.id,
          titulo: t.titulo,
          col: columnaDeTarea(t.vence, hoy, t.estado),
          venceLabel: v.label,
          hora: t.hora,
          vencida: v.vencida,
          hecha: t.estado === "hecha",
          link,
          comercial: {
            nombre: t.profiles?.nombre_completo || "Comercial",
            color: t.profiles?.color ?? null,
          },
        };
      });
  }, [visibles, hoy]);

  const crear = async () => {
    if (!user) return;
    const parsed = parseTareaRapida(titulo);
    if (!parsed.titulo) {
      toast.error("Pon un título a la tarea.");
      return;
    }
    const supabase = createClient();
    const { data, error } = await supabase
      .from("tareas")
      .insert({
        comercial_id: user.id,
        titulo: parsed.titulo,
        vence: parsed.vence,
        hora: parsed.hora,
      })
      .select("id")
      .single();
    if (error || !data) {
      toast.error("No se ha podido crear la tarea.");
      return;
    }
    if (parsed.hora) {
      const [hh, mm] = parsed.hora.split(":").map(Number);
      const empieza = new Date(`${parsed.vence}T12:00:00`);
      empieza.setHours(hh, mm, 0, 0);
      const termina = new Date(empieza);
      termina.setHours(empieza.getHours() + 1);
      const { data: cita } = await supabase
        .from("citas")
        .insert({
          comercial_id: user.id,
          tipo: "otro",
          titulo: parsed.titulo,
          empieza: empieza.toISOString(),
          termina: termina.toISOString(),
          tarea_id: data.id,
        })
        .select("id")
        .single();
      if (cita?.id) {
        await supabase.from("tareas").update({ cita_id: cita.id }).eq("id", data.id);
      }
    }
    setTitulo("");
    toast.success(parsed.hora ? "Tarea y cita creadas." : "Tarea creada.");
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

  const seleccionada = tareas.find((t) => t.id === sel) ?? null;

  return (
    <div className="animate-rise">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1>Tareas</h1>
        <div className="flex overflow-hidden rounded-[9px] border border-border">
          <button
            type="button"
            onClick={() => setVista("tablero")}
            className={`grid h-[34px] w-[34px] place-items-center ${vista === "tablero" ? "bg-accent text-white" : "bg-white text-[var(--text-2)]"}`}
            aria-label="Tablero"
          >
            <LayoutGrid size={14} />
          </button>
          <button
            type="button"
            onClick={() => setVista("lista")}
            className={`grid h-[34px] w-[34px] place-items-center ${vista === "lista" ? "bg-accent text-white" : "bg-white text-[var(--text-2)]"}`}
            aria-label="Lista"
          >
            <List size={14} />
          </button>
        </div>
      </div>

      {admin ? (
        <div className="mt-4">
          <FiltroComercial comerciales={comerciales} valor={comercialId} onChange={setComercialId} />
        </div>
      ) : null}

      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          void crear();
        }}
      >
        <Input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Llamar propietario … mañana 10:00"
        />
      </form>

      <div className="mt-5">
        {loading ? (
          <div className="rounded-[10px] border border-dashed border-[var(--input)] px-3 py-8 text-center text-[12.5px] text-[var(--text-2)]">
            Cargando tareas…
          </div>
        ) : vista === "tablero" ? (
          <TareasBoard tareas={tarjetas} onMover={(id, col) => void mover(id, col)} onToggle={(id) => void marcar(id)} onAbrir={setSel} />
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

      <Sheet open={Boolean(seleccionada)} onOpenChange={(open) => !open && setSel(null)} variant="side" side="right" showCloseButton>
        {seleccionada ? (
          <div className="px-5 pb-8 pt-[max(3.5rem,calc(env(safe-area-inset-top)+2.75rem))]">
            <h2 className="pr-8 text-[18px] font-semibold leading-snug">{seleccionada.titulo}</h2>
            <p className="mt-2 text-[13px] text-[var(--text-2)]">
              {etiquetaVence(seleccionada.vence, hoy).label}
              {seleccionada.hora ? ` · ${seleccionada.hora.slice(0, 5)}` : ""}
            </p>
            {seleccionada.propiedades ? (
              <Link href={`/propiedades/${seleccionada.propiedad_id}`} className="mt-3 block text-[13px] text-accent">
                {[seleccionada.propiedades.referencia, seleccionada.propiedades.titulo].filter(Boolean).join(" · ")}
              </Link>
            ) : null}
            {seleccionada.finca_reference ? (
              <Link href={rutaFincaPersistida(seleccionada.finca_reference)} className="mt-2 block font-mono text-[12px] text-accent">
                {seleccionada.finca_reference}
              </Link>
            ) : null}
            {seleccionada.cliente_id ? (
              <Link href={`/clientes/${seleccionada.cliente_id}`} className="mt-2 block text-[13px] text-accent">
                {seleccionada.clientes?.nombre ?? "Cliente"}
              </Link>
            ) : null}
            <div className="mt-6 space-y-2">
              {COLUMNAS_TAREA.filter((c) => c.id !== columnaDeTarea(seleccionada.vence, hoy, seleccionada.estado)).map((col) => (
                <Button
                  key={col.id}
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    void mover(seleccionada.id, col.id);
                    setSel(null);
                  }}
                >
                  Mover a {col.label}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
