"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { isAdmin } from "@/lib/auth/roles";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  CAL_HORA_FIN,
  CAL_HORA_INICIO,
  CAL_PX_HORA,
  citasAgrupadasPorDia,
  citasDelDia,
  ESTADO_CITA_LABEL,
  horaCita,
  horaDesdeMinutos,
  minutosDesdeHora,
  minutosDesdeOffsetY,
  minutosLocalesDeCita,
  moverCitaADiaHora,
  moverSemana,
  posicionEventoCalendario,
  relacionUno,
  semanaDesde,
  TIPO_CITA_LABEL,
  type EstadoCita,
  type TipoAltaCalendario,
  type TipoCita,
} from "@/lib/citas/citas";
import { FiltroComercial, type ComercialFiltro } from "@/components/captacion/FiltroComercial";
import { useFiltroComercial } from "@/lib/ui/filtro-comercial";
import { CitaAcciones } from "@/components/citas/CitaAcciones";
import { FichaLink } from "@/components/crm/FichaPeek";
import { CalendarioMovil } from "@/components/citas/CalendarioMovil";
import { NuevaEntradaCalendario } from "@/components/citas/NuevaEntradaCalendario";

type CitaRow = {
  id: string;
  comercial_id: string;
  tipo: string;
  titulo: string;
  empieza: string;
  termina: string;
  propiedad_id: string | null;
  cliente_id: string | null;
  estado: string;
  tarea_id?: string | null;
  profiles?: { nombre_completo?: string | null; color?: string | null } | null;
  propiedades?: { titulo?: string | null; direccion?: string | null; referencia?: string | null } | null;
};

export default function CalendarioPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const admin = isAdmin(user?.role);
  const hoy = new Date().toISOString().slice(0, 10);
  const [dia, setDia] = useState(() => hoy);
  const [citas, setCitas] = useState<CitaRow[]>([]);
  const [hora, setHora] = useState("10:00");
  const [sheetOpen, setSheetOpen] = useState(() => Boolean(searchParams.get("propiedad") || searchParams.get("cliente")));
  const [saving, setSaving] = useState(false);
  const [propiedadId, setPropiedadId] = useState(searchParams.get("propiedad") ?? "");
  const [clienteId, setClienteId] = useState(searchParams.get("cliente") ?? "");
  const [propiedades, setPropiedades] = useState<Array<{ id: string; titulo: string | null; direccion: string | null; referencia: string | null }>>([]);
  const [clientes, setClientes] = useState<Array<{ id: string; nombre: string; telefono: string | null }>>([]);
  const [comerciales, setComerciales] = useState<ComercialFiltro[]>([]);
  const { comercialId: filtroComercial, setComercialId: setFiltroComercial } = useFiltroComercial();
  const semana = useMemo(() => semanaDesde(dia), [dia]);
  const etiquetaSemana = `${new Date(`${semana[0]}T12:00:00`).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  })} – ${new Date(`${semana[6]}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`;

  const cargar = () => {
    if (!user) return;
    const supabase = createClient();
    const inicio = `${semana[0]}T00:00:00`;
    const fin = `${semana[6]}T23:59:59`;
    let q = supabase
      .from("citas")
      .select(
        "id, comercial_id, tipo, titulo, empieza, termina, propiedad_id, cliente_id, estado, tarea_id, profiles:comercial_id(nombre_completo, color), propiedades:propiedad_id(titulo, direccion, referencia)"
      )
      .gte("empieza", inicio)
      .lte("empieza", fin)
      .neq("estado", "cancelada")
      .order("empieza");
    if (!admin) q = q.eq("comercial_id", user.id);
    void q.then(({ data }) =>
      setCitas(
        ((data ?? []) as Array<
          CitaRow & {
            profiles?: CitaRow["profiles"] | CitaRow["profiles"][];
            propiedades?: CitaRow["propiedades"] | CitaRow["propiedades"][];
          }
        >).map((row) => ({
          ...row,
          profiles: relacionUno(row.profiles),
          propiedades: relacionUno(row.propiedades),
        }))
      )
    );
  };

  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("propiedades")
      .select("id, titulo, direccion, referencia")
      .eq("estado", "disponible")
      .order("created_at", { ascending: false })
      .limit(80)
      .then(({ data }) => setPropiedades(data ?? []));
    void supabase
      .from("clientes")
      .select("id, nombre, telefono")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => setClientes(data ?? []));
  }, []);

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
  }, [user, admin, dia]);

  const crear = async (tipo: TipoAltaCalendario, titulo: string) => {
    if (!user) return;
    const tituloFinal =
      titulo.trim() ||
      (propiedadId
        ? `${TIPO_CITA_LABEL[tipo]} ${propiedades.find((p) => p.id === propiedadId)?.referencia || propiedades.find((p) => p.id === propiedadId)?.direccion || ""}`.trim()
        : TIPO_CITA_LABEL[tipo]);
    const empieza = new Date(`${dia}T${hora}:00`);
    const termina = new Date(empieza.getTime() + 60 * 60 * 1000);
    setSaving(true);
    const supabase = createClient();
    if (tipo === "tarea") {
      const { data: tarea, error: errorTarea } = await supabase
        .from("tareas")
        .insert({
          comercial_id: user.id,
          creado_por: user.id,
          titulo: tituloFinal,
          vence: dia,
          hora,
          estado: "pendiente",
          propiedad_id: propiedadId || null,
          cliente_id: clienteId || null,
        })
        .select("id")
        .single();
      if (errorTarea || !tarea) {
        setSaving(false);
        toast.error("No se ha podido crear la tarea.");
        return;
      }
      const { data: cita, error } = await supabase
        .from("citas")
        .insert({
          comercial_id: user.id,
          tipo: "tarea",
          titulo: tituloFinal,
          empieza: empieza.toISOString(),
          termina: termina.toISOString(),
          propiedad_id: propiedadId || null,
          cliente_id: clienteId || null,
          tarea_id: tarea.id,
        })
        .select("id")
        .single();
      if (error) {
        setSaving(false);
        toast.error("La tarea está creada, pero no ha pasado al calendario.");
        return;
      }
      if (cita?.id) {
        await supabase.from("tareas").update({ cita_id: cita.id }).eq("id", tarea.id);
      }
    } else {
      const { error } = await supabase.from("citas").insert({
        comercial_id: user.id,
        tipo,
        titulo: tituloFinal,
        empieza: empieza.toISOString(),
        termina: termina.toISOString(),
        propiedad_id: propiedadId || null,
        cliente_id: clienteId || null,
      });
      if (error) {
        setSaving(false);
        toast.error("No se ha podido crear la entrada.");
        return;
      }
    }
    setSaving(false);
    setSheetOpen(false);
    toast.success(`${TIPO_CITA_LABEL[tipo]} creado.`);
    cargar();
  };

  const abrirHueco = (diaDestino: string, minutos: number) => {
    setDia(diaDestino);
    setHora(horaDesdeMinutos(minutos));
    setSheetOpen(true);
  };

  const moverCita = async (id: string, diaDestino: string, opts?: { minutos?: number; offsetY?: number | null }) => {
    const cita = citas.find((item) => item.id === id);
    if (!cita || cita.estado === "hecha" || cita.estado === "cancelada") return;
    const minutos =
      opts?.minutos != null
        ? opts.minutos
        : opts?.offsetY == null || opts.offsetY < 8
          ? minutosLocalesDeCita(cita.empieza)
          : minutosDesdeOffsetY(opts.offsetY);
    const diaCita = cita.empieza.slice(0, 10);
    if (diaDestino === diaCita && minutos === minutosLocalesDeCita(cita.empieza)) return;
    const patch = moverCitaADiaHora({
      empieza: cita.empieza,
      termina: cita.termina,
      dia: diaDestino,
      minutos,
    });
    const supabase = createClient();
    const { error } = await supabase
      .from("citas")
      .update({ empieza: patch.empieza, termina: patch.termina })
      .eq("id", id);
    if (error) {
      toast.error("No se ha podido mover la cita.");
      return;
    }
    if (cita.tarea_id) {
      await supabase.from("tareas").update({ vence: patch.vence, hora: patch.hora }).eq("id", cita.tarea_id);
    }
    setCitas((prev) =>
      prev.map((item) => (item.id === id ? { ...item, empieza: patch.empieza, termina: patch.termina } : item))
    );
    setDia(diaDestino);
    toast.success(`Cita pasada a ${patch.hora}.`);
  };

  const cambiarEstado = async (id: string, estado: "hecha" | "cancelada") => {
    const supabase = createClient();
    const { error } = await supabase.from("citas").update({ estado }).eq("id", id);
    if (error) {
      toast.error("No se ha podido actualizar la cita.");
      return;
    }
    toast.success(estado === "hecha" ? "Cita marcada como hecha." : "Cita cancelada.");
    cargar();
  };

  const visibles = filtroComercial ? citas.filter((item) => item.comercial_id === filtroComercial) : citas;
  const porDia = useMemo(() => citasAgrupadasPorDia(visibles, semana), [visibles, semana]);
  const delDia = citasDelDia(visibles, dia);

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Calendario" }]}
        title="Calendario"
        description="Pulsa un hueco de día y hora para crear un evento, un recordatorio o una tarea. Arrastra para mover."
      />
      {admin ? (
        <div className="mt-4">
          <FiltroComercial comerciales={comerciales} valor={filtroComercial} onChange={setFiltroComercial} />
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => setDia(moverSemana(dia, -1))} aria-label="Semana anterior">
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
          </Button>
          <p className="min-w-[9rem] text-center text-sm font-semibold capitalize">{etiquetaSemana}</p>
          <Button type="button" size="sm" variant="secondary" onClick={() => setDia(moverSemana(dia, 1))} aria-label="Semana siguiente">
            <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => setDia(hoy)}>
            Hoy
          </Button>
          <Button type="button" size="sm" onClick={() => abrirHueco(dia, minutosDesdeHora(hora))}>
            Nueva
          </Button>
        </div>
      </div>

      <div className="mt-4">
        <CalendarioMovil
          semana={semana}
          dia={dia}
          hoy={hoy}
          citas={delDia}
          porDia={porDia}
          admin={admin}
          onPickDia={setDia}
          onMover={(id, destino) => void moverCita(id, destino)}
          onEstado={cambiarEstado}
          onCambiarHora={(id, horaNueva) => void moverCita(id, dia, { minutos: minutosDesdeHora(horaNueva) })}
          onCrearHueco={(minutos) => abrirHueco(dia, minutos)}
        />
      </div>

      <div className="mt-4 hidden overflow-hidden rounded-[14px] border border-border bg-white min-[820px]:block">
        <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))] border-b border-[var(--border-soft)]">
          <div />
          {semana.map((d) => {
            const esHoy = d === hoy;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDia(d)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/cita");
                  if (id) void moverCita(id, d);
                }}
                className="h-[52px] border-l border-[var(--border-soft)] text-center"
              >
                <p className="text-[11px] uppercase text-[var(--label)]">
                  {new Date(`${d}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short" })}
                </p>
                <span className={`inline-grid h-7 w-7 place-items-center rounded-full text-[13px] font-semibold ${esHoy ? "bg-accent text-white" : ""}`}>
                  {new Date(`${d}T12:00:00`).getDate()}
                </span>
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))]">
          <div className="relative" style={{ height: (CAL_HORA_FIN - CAL_HORA_INICIO + 1) * CAL_PX_HORA }}>
            {Array.from({ length: CAL_HORA_FIN - CAL_HORA_INICIO + 1 }, (_, i) => CAL_HORA_INICIO + i).map((h, i) => (
              <div key={h} className="absolute right-1 font-mono text-[11px] text-[var(--text-3)]" style={{ top: i * CAL_PX_HORA }}>
                {h}:00
              </div>
            ))}
          </div>
          {semana.map((d) => {
            const lista = porDia.get(d) ?? [];
            const esHoy = d === hoy;
            return (
              <div
                key={d}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("[data-cal-evento]")) return;
                  const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
                  abrirHueco(d, minutosDesdeOffsetY(y));
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/cita");
                  if (!id) return;
                  const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
                  void moverCita(id, d, { offsetY: y });
                }}
                className="relative cursor-pointer border-l border-[var(--border-soft)]"
                style={{ height: (CAL_HORA_FIN - CAL_HORA_INICIO + 1) * CAL_PX_HORA, background: esHoy ? "#FBFBF9" : "#fff" }}
              >
                {Array.from({ length: CAL_HORA_FIN - CAL_HORA_INICIO + 1 }).map((_, i) => (
                  <div key={i} className="absolute inset-x-0 border-t border-[var(--border-row)]" style={{ top: i * CAL_PX_HORA }} />
                ))}
                {lista.map((cita) => {
                  const { top, height } = posicionEventoCalendario(cita.empieza, cita.termina);
                  const color = cita.profiles?.color || "#3A6A82";
                  return (
                    <button
                      key={cita.id}
                      type="button"
                      data-cal-evento
                      draggable={cita.estado === "prevista"}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/cita", cita.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDia(d);
                      }}
                      className="absolute inset-x-1 cursor-grab overflow-hidden rounded-[6px] px-1.5 py-0.5 text-left active:cursor-grabbing"
                      style={{
                        top,
                        height,
                        background: `${color}1A`,
                        borderLeft: `3px solid ${color}`,
                      }}
                    >
                      <p className="text-[11px] font-semibold" style={{ color }}>
                        {horaCita(cita.empieza)} · {TIPO_CITA_LABEL[(cita.tipo as TipoCita) ?? "otro"] ?? cita.tipo}
                      </p>
                      <p className="truncate text-[12px] font-medium">{cita.titulo}</p>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <NuevaEntradaCalendario
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        dia={dia}
        onDia={setDia}
        hora={hora}
        onHora={setHora}
        propiedades={propiedades}
        clientes={clientes}
        propiedadId={propiedadId}
        clienteId={clienteId}
        onPropiedad={setPropiedadId}
        onCliente={setClienteId}
        saving={saving}
        onCrear={(tipo, titulo) => void crear(tipo, titulo)}
      />

      <h2 className="mt-8 hidden text-[15px] font-semibold capitalize min-[820px]:block">
        {new Date(`${dia}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
      </h2>
      <ul className="mt-3 hidden space-y-2 min-[820px]:block">
        {delDia.map((cita) => (
          <li
            key={cita.id}
            className={`flex flex-col gap-3 rounded-2xl border border-[#E6E3DD] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
              cita.estado !== "prevista" ? "opacity-60" : ""
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: cita.profiles?.color || "#3A6A82" }} />
              <div>
                <p className="font-medium">{cita.titulo}</p>
                <p className="text-xs text-[#5D6B67]">
                  {horaCita(cita.empieza)}
                  {admin && cita.profiles?.nombre_completo ? ` · ${cita.profiles.nombre_completo}` : ""} ·{" "}
                  {TIPO_CITA_LABEL[(cita.tipo as TipoCita) ?? "otro"] ?? cita.tipo} ·{" "}
                  {ESTADO_CITA_LABEL[(cita.estado as EstadoCita) ?? "prevista"] ?? cita.estado}
                </p>
                {cita.propiedad_id ? (
                  <FichaLink tipo="propiedad" id={cita.propiedad_id} className="mt-1 inline-block text-xs">
                    {[cita.propiedades?.referencia, cita.propiedades?.titulo || cita.propiedades?.direccion]
                      .filter(Boolean)
                      .join(" · ") || "Ver inmueble"}
                  </FichaLink>
                ) : null}
              </div>
            </div>
            <CitaAcciones cita={cita} onEstado={cambiarEstado} />
          </li>
        ))}
        {delDia.length === 0 ? <li className="text-sm text-[#5D6B67]">No hay citas este día.</li> : null}
      </ul>
    </div>
  );
}
