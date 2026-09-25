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
import { AvatarComercial } from "@/components/ui/avatar-comercial";
import {
  citasAgrupadasPorDia,
  citasDelDia,
  direccionDeInmueble,
  ESTADO_CITA_LABEL,
  horaCita,
  horaDesdeMinutos,
  puedeGestionarCita,
  mapInmuebleCalendario,
  minutosDesdeHora,
  minutosDesdeOffsetY,
  minutosLocalesDeCita,
  moverCitaADiaHora,
  etiquetaMes,
  moverMes,
  moverSemana,
  relacionUno,
  rangoGrillaMes,
  SELECT_INMUEBLE_CALENDARIO,
  semanaDesde,
  TIPO_CITA_LABEL,
  type VistaCalendario,
  type EstadoCita,
  type InmuebleCalendario,
  type TipoAltaCalendario,
  type TipoCita,
} from "@/lib/citas/citas";
import { FiltroComercial, type ComercialFiltro } from "@/components/captacion/FiltroComercial";
import { useFiltroComercial } from "@/lib/ui/filtro-comercial";
import { CitaAcciones } from "@/components/citas/CitaAcciones";
import { CalendarioSemana } from "@/components/citas/CalendarioSemana";
import { CalendarioMes } from "@/components/citas/CalendarioMes";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { EnlaceMaps } from "@/components/citas/InmueblePreviewCita";
import { FichaLink } from "@/components/crm/FichaPeek";
import { CalendarioMovil } from "@/components/citas/CalendarioMovil";
import { NuevaEntradaCalendario } from "@/components/citas/NuevaEntradaCalendario";
import { syncEstadoTareaDesdeCita, syncTareaDesdeCita } from "@/lib/tareas/sync-cita";

type CitaRow = {
  id: string;
  comercial_id: string;
  tipo: string;
  titulo: string;
  empieza: string;
  termina: string;
  propiedad_id: string | null;
  cliente_id: string | null;
  clientes_extra_ids?: string[] | null;
  notas?: string | null;
  estado: string;
  lugar?: string | null;
  tarea_id?: string | null;
  clientes?: { nombre?: string | null } | null;
  profiles?: { nombre_completo?: string | null; color?: string | null } | null;
  propiedades?: { titulo?: string | null; direccion?: string | null; localidad?: string | null; referencia?: string | null } | null;
};

export default function CalendarioPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const admin = isAdmin(user?.role);
  const hoy = new Date().toISOString().slice(0, 10);
  const [dia, setDia] = useState(() => hoy);
  const [vista, setVista] = useState<VistaCalendario>("semana");
  const [citas, setCitas] = useState<CitaRow[]>([]);
  const [hora, setHora] = useState("10:00");
  const [sheetOpen, setSheetOpen] = useState(() => Boolean(searchParams.get("propiedad") || searchParams.get("cliente")));
  const [saving, setSaving] = useState(false);
  const [propiedadId, setPropiedadId] = useState(searchParams.get("propiedad") ?? "");
  const [clienteId, setClienteId] = useState(searchParams.get("cliente") ?? "");
  const [clientesExtraIds, setClientesExtraIds] = useState<string[]>([]);
  const [notas, setNotas] = useState("");
  const [lugar, setLugar] = useState("");
  const [editando, setEditando] = useState<CitaRow | null>(null);
  const [propiedades, setPropiedades] = useState<InmuebleCalendario[]>([]);
  const [clientes, setClientes] = useState<Array<{ id: string; nombre: string; telefono: string | null }>>([]);
  const [comerciales, setComerciales] = useState<ComercialFiltro[]>([]);
  const { comercialId: filtroComercial, setComercialId: setFiltroComercial } = useFiltroComercial();
  const semana = useMemo(() => semanaDesde(dia), [dia]);
  const grillaMes = useMemo(() => rangoGrillaMes(dia), [dia]);
  const etiquetaSemana = `${new Date(`${semana[0]}T12:00:00`).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  })} – ${new Date(`${semana[6]}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`;
  const etiquetaPeriodo = vista === "mes" ? etiquetaMes(dia) : etiquetaSemana;
  const diasVista = vista === "mes" ? grillaMes.dias : semana;

  const cargar = () => {
    if (!user) return;
    const supabase = createClient();
    const rango = vista === "mes" ? grillaMes : { inicio: `${semana[0]}T00:00:00`, fin: `${semana[6]}T23:59:59` };
    const inicio = rango.inicio;
    const fin = rango.fin;
    const q = supabase
      .from("citas")
      .select(
        "id, comercial_id, tipo, titulo, empieza, termina, propiedad_id, cliente_id, clientes_extra_ids, notas, estado, tarea_id, lugar, profiles:comercial_id(nombre_completo, color), propiedades:propiedad_id(titulo, direccion, localidad, referencia), clientes:cliente_id(nombre)"
      )
      .gte("empieza", inicio)
      .lte("empieza", fin)
      .neq("estado", "cancelada")
      .order("empieza");
    void q.then(({ data }) => {
      const filas = ((data ?? []) as Array<
        CitaRow & {
          profiles?: CitaRow["profiles"] | CitaRow["profiles"][];
          propiedades?: CitaRow["propiedades"] | CitaRow["propiedades"][];
        }
      >).map((row) => ({
        ...row,
        profiles: relacionUno(row.profiles),
        propiedades: relacionUno(row.propiedades),
        clientes: relacionUno(row.clientes as CitaRow["clientes"] | CitaRow["clientes"][] | null),
        clientes_extra_ids: row.clientes_extra_ids ?? [],
      }));
      setCitas(filas);
      const extraIds = [...new Set(filas.flatMap((row) => row.clientes_extra_ids ?? []).filter(Boolean))];
      if (extraIds.length === 0) return;
      void supabase
        .from("clientes")
        .select("id, nombre, telefono")
        .in("id", extraIds)
        .then(({ data: extras }) => {
          if (!extras?.length) return;
          setClientes((prev) => {
            const byId = new Map(prev.map((c) => [c.id, c] as const));
            for (const c of extras) {
              if (!byId.has(c.id)) byId.set(c.id, c);
            }
            return [...byId.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
          });
        });
    });
  };

  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("propiedades")
      .select(SELECT_INMUEBLE_CALENDARIO)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (error) {
          toast.error("No se han podido cargar los inmuebles.");
          return;
        }
        setPropiedades((data ?? []).map((row) => mapInmuebleCalendario(row)));
      });
    void supabase
      .from("clientes")
      .select("id, nombre, telefono")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => setClientes(data ?? []));
  }, []);

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
            nombre: item.nombre_completo || item.email || "Comercial",
            color: item.color,
          }))
        )
      );
  }, [user]);

  const mezclarInmueble = (id: string) => {
    if (!id || propiedades.some((p) => p.id === id)) return;
    const supabase = createClient();
    void supabase
      .from("propiedades")
      .select(SELECT_INMUEBLE_CALENDARIO)
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setPropiedades((prev) => (prev.some((p) => p.id === data.id) ? prev : [mapInmuebleCalendario(data), ...prev]));
      });
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, dia, vista]);

  useEffect(() => {
    if (propiedadId) mezclarInmueble(propiedadId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propiedadId]);

  useEffect(() => {
    if (!propiedadId || lugar.trim()) return;
    const p = propiedades.find((item) => item.id === propiedadId);
    const dir = p ? direccionDeInmueble(p) : "";
    if (dir) setLugar(dir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propiedadId, propiedades]);

  const mezclarCliente = (id: string, nombre?: string | null) => {
    if (!id || clientes.some((c) => c.id === id)) return;
    setClientes((prev) => [...prev, { id, nombre: nombre?.trim() || "Cliente", telefono: null }].sort((a, b) => a.nombre.localeCompare(b.nombre)));
  };

  const abrirHueco = (diaDestino: string, minutos: number) => {
    setEditando(null);
    setPropiedadId("");
    setClienteId("");
    setClientesExtraIds([]);
    setNotas("");
    setLugar("");
    setDia(diaDestino);
    setHora(horaDesdeMinutos(minutos));
    setSheetOpen(true);
  };

  const gestiona = (comercialId: string) => puedeGestionarCita(comercialId, user?.id, admin);

  const abrirEdicion = (id: string) => {
    const cita = citas.find((item) => item.id === id);
    if (!cita || cita.estado === "cancelada") return;
    if (!gestiona(cita.comercial_id)) {
      toast.message("Solo puedes editar tus propias entradas.");
      return;
    }
    setEditando(cita);
    setDia(cita.empieza.slice(0, 10));
    setHora(horaCita(cita.empieza));
    setPropiedadId(cita.propiedad_id ?? "");
    setClienteId(cita.cliente_id ?? "");
    setClientesExtraIds(cita.clientes_extra_ids ?? []);
    setNotas(cita.notas?.trim() ?? "");
    setLugar(cita.lugar?.trim() || direccionDeInmueble(cita.propiedades ?? {}));
    if (cita.propiedad_id) mezclarInmueble(cita.propiedad_id);
    if (cita.cliente_id) mezclarCliente(cita.cliente_id, cita.clientes?.nombre);
    for (const id of cita.clientes_extra_ids ?? []) mezclarCliente(id);
    setSheetOpen(true);
  };

  const guardar = async (tipo: TipoAltaCalendario, titulo: string) => {
    if (!user) return;
    const inmueble = propiedades.find((p) => p.id === propiedadId);
    const tituloFinal =
      titulo.trim() ||
      (inmueble
        ? `${TIPO_CITA_LABEL[tipo]} ${inmueble.referencia || inmueble.direccion || ""}`.trim()
        : TIPO_CITA_LABEL[tipo]);
    const lugarFinal = lugar.trim() || (inmueble ? direccionDeInmueble(inmueble) : "") || null;
    const notasFinal = tipo === "evento" ? notas.trim() || null : null;
    const clientesExtraFinal =
      tipo === "evento" ? clientesExtraIds.filter((id) => id && id !== clienteId) : [];
    setSaving(true);
    const supabase = createClient();

    if (editando) {
      const patch = moverCitaADiaHora({
        empieza: editando.empieza,
        termina: editando.termina,
        dia,
        minutos: minutosDesdeHora(hora),
      });
      const tipoFinal = editando.tipo === "tarea" ? "tarea" : tipo;
      const { error } = await supabase
        .from("citas")
        .update({
          tipo: tipoFinal,
          titulo: tituloFinal,
          empieza: patch.empieza,
          termina: patch.termina,
          propiedad_id: propiedadId || null,
          cliente_id: clienteId || null,
          clientes_extra_ids: tipoFinal === "evento" ? clientesExtraFinal : [],
          notas: tipoFinal === "evento" ? notasFinal : null,
          lugar: lugarFinal,
        })
        .eq("id", editando.id);
      if (error) {
        setSaving(false);
        toast.error("No se ha podido guardar la entrada.");
        return;
      }
      try {
        await syncTareaDesdeCita(
          supabase,
          {
            id: editando.id,
            comercial_id: editando.comercial_id,
            tipo: tipoFinal,
            titulo: tituloFinal,
            empieza: patch.empieza,
            propiedad_id: propiedadId || null,
            cliente_id: clienteId || null,
            estado: editando.estado,
            tarea_id: editando.tarea_id,
          },
          { creadoPor: user.id }
        );
      } catch {
        toast.error("Cita guardada, pero no se pudo sincronizar con Tareas.");
      }
      setSaving(false);
      setSheetOpen(false);
      setEditando(null);
      toast.success("Entrada actualizada.");
      cargar();
      return;
    }

    const empieza = new Date(`${dia}T${hora}:00`);
    const termina = new Date(empieza.getTime() + 60 * 60 * 1000);
    const tipoCita = tipo === "tarea" ? "tarea" : tipo;
    const { data: cita, error } = await supabase
      .from("citas")
      .insert({
        comercial_id: user.id,
        tipo: tipoCita,
        titulo: tituloFinal,
        empieza: empieza.toISOString(),
        termina: termina.toISOString(),
        propiedad_id: propiedadId || null,
        cliente_id: clienteId || null,
        clientes_extra_ids: tipoCita === "evento" ? clientesExtraFinal : [],
        notas: tipoCita === "evento" ? notasFinal : null,
        lugar: lugarFinal,
      })
      .select("id, comercial_id, tipo, titulo, empieza, propiedad_id, cliente_id, estado, tarea_id")
      .single();
    if (error || !cita) {
      setSaving(false);
      toast.error("No se ha podido crear la entrada.");
      return;
    }
    try {
      await syncTareaDesdeCita(supabase, cita, { creadoPor: user.id });
    } catch {
      toast.error("Entrada creada en calendario, pero no pasó al tablero de Tareas.");
    }
    setSaving(false);
    setSheetOpen(false);
    toast.success(`${TIPO_CITA_LABEL[tipo]} creado.`);
    cargar();
  };

  const revertirMovimiento = async (snapshot: {
    id: string;
    empieza: string;
    termina: string;
    tarea_id?: string | null;
    vence: string;
    hora: string;
  }) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("citas")
      .update({ empieza: snapshot.empieza, termina: snapshot.termina })
      .eq("id", snapshot.id);
    if (error) {
      toast.error("No se ha podido deshacer el movimiento.");
      return;
    }
    if (snapshot.tarea_id) {
      const original = citas.find((item) => item.id === snapshot.id);
      if (original) {
        await syncTareaDesdeCita(supabase, {
          ...original,
          empieza: snapshot.empieza,
          tarea_id: snapshot.tarea_id,
        });
      }
    }
    setCitas((prev) =>
      prev.map((item) =>
        item.id === snapshot.id ? { ...item, empieza: snapshot.empieza, termina: snapshot.termina } : item
      )
    );
    setDia(snapshot.empieza.slice(0, 10));
    toast.success(`Cita devuelta a ${snapshot.hora}.`);
  };

  const moverCita = async (id: string, diaDestino: string, opts?: { minutos?: number; offsetY?: number | null }) => {
    const cita = citas.find((item) => item.id === id);
    if (!cita || cita.estado === "hecha" || cita.estado === "cancelada") return;
    if (!gestiona(cita.comercial_id)) {
      toast.message("Solo puedes mover tus propias entradas.");
      return;
    }
    const minutos =
      opts?.minutos != null
        ? opts.minutos
        : opts?.offsetY == null || opts.offsetY < 8
          ? minutosLocalesDeCita(cita.empieza)
          : minutosDesdeOffsetY(opts.offsetY);
    const diaCita = cita.empieza.slice(0, 10);
    if (diaDestino === diaCita && minutos === minutosLocalesDeCita(cita.empieza)) return;
    const snapshot = {
      id,
      empieza: cita.empieza,
      termina: cita.termina,
      tarea_id: cita.tarea_id,
      vence: diaCita,
      hora: horaCita(cita.empieza),
    };
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
    try {
      await syncTareaDesdeCita(supabase, {
        ...cita,
        empieza: patch.empieza,
      });
    } catch {
      toast.error("Cita movida, pero no se actualizó en Tareas.");
    }
    setCitas((prev) =>
      prev.map((item) => (item.id === id ? { ...item, empieza: patch.empieza, termina: patch.termina } : item))
    );
    setDia(diaDestino);
    toast.success(`Cita pasada a ${patch.hora}.`, {
      duration: 8000,
      action: {
        label: "Deshacer",
        onClick: () => void revertirMovimiento(snapshot),
      },
    });
  };

  const cambiarEstado = async (id: string, estado: "hecha" | "cancelada") => {
    const cita = citas.find((item) => item.id === id);
    if (cita && !gestiona(cita.comercial_id)) {
      toast.message("Solo puedes cambiar el estado de tus propias entradas.");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from("citas").update({ estado }).eq("id", id);
    if (error) {
      toast.error("No se ha podido actualizar la cita.");
      return;
    }
    if (cita) {
      try {
        await syncEstadoTareaDesdeCita(supabase, cita, estado);
      } catch {
        /* la cita ya cambió; el tablero se refrescará en la próxima visita */
      }
    }
    toast.success(estado === "hecha" ? "Entrada marcada como hecha." : "Entrada cancelada.");
    if (estado === "cancelada") {
      setSheetOpen(false);
      setEditando(null);
    }
    cargar();
  };

  const cancelarEntrada = () => {
    if (!editando || editando.estado !== "prevista") return;
    if (!window.confirm("¿Cancelar esta entrada? Dejará de aparecer en el calendario.")) return;
    void cambiarEstado(editando.id, "cancelada");
  };

  const visibles = filtroComercial ? citas.filter((item) => item.comercial_id === filtroComercial) : citas;
  const porDia = useMemo(() => citasAgrupadasPorDia(visibles, diasVista), [visibles, diasVista]);
  const delDia = citasDelDia(visibles, dia);

  const irAnterior = () => setDia(vista === "mes" ? moverMes(dia, -1) : moverSemana(dia, -1));
  const irSiguiente = () => setDia(vista === "mes" ? moverMes(dia, 1) : moverSemana(dia, 1));

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Calendario" }]}
        title="Calendario"
        description="Agenda de todo el equipo. Pulsa un hueco para crear; solo puedes editar o mover tus propias entradas."
      />
      <div className="mt-4">
        <FiltroComercial comerciales={comerciales} valor={filtroComercial} onChange={setFiltroComercial} />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-full border border-[var(--border)] bg-white p-0.5">
            <ToggleChip on={vista === "semana"} onClick={() => setVista("semana")}>
              Semana
            </ToggleChip>
            <ToggleChip on={vista === "mes"} onClick={() => setVista("mes")}>
              Mes
            </ToggleChip>
          </div>
          <Button type="button" size="sm" variant="secondary" onClick={irAnterior} aria-label={vista === "mes" ? "Mes anterior" : "Semana anterior"}>
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
          </Button>
          <p className="min-w-[9rem] text-center text-sm font-semibold capitalize">{etiquetaPeriodo}</p>
          <Button type="button" size="sm" variant="secondary" onClick={irSiguiente} aria-label={vista === "mes" ? "Mes siguiente" : "Semana siguiente"}>
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

      {vista === "mes" ? (
        <CalendarioMes
          dia={dia}
          hoy={hoy}
          porDia={porDia}
          puedeGestionar={gestiona}
          onPickDia={setDia}
          onEditar={abrirEdicion}
          onCrearHueco={abrirHueco}
        />
      ) : (
        <>
          <div className="mt-4">
            <CalendarioMovil
              semana={semana}
              dia={dia}
              hoy={hoy}
              citas={delDia}
              porDia={porDia}
              userId={user?.id}
              puedeGestionar={gestiona}
              onPickDia={setDia}
              onMover={(id, destino) => void moverCita(id, destino)}
              onEstado={cambiarEstado}
              onCambiarHora={(id, horaNueva) => void moverCita(id, dia, { minutos: minutosDesdeHora(horaNueva) })}
              onCrearHueco={(minutos) => abrirHueco(dia, minutos)}
              onEditar={abrirEdicion}
            />
          </div>

          <CalendarioSemana
            semana={semana}
            hoy={hoy}
            porDia={porDia}
            puedeGestionar={gestiona}
            onPickDia={setDia}
            onMover={(id, destino, opts) => void moverCita(id, destino, opts)}
            onEditar={abrirEdicion}
            onCrearHueco={abrirHueco}
          />
        </>
      )}

      {vista === "mes" ? (
        <div className="mt-4 min-[820px]:hidden">
          <CalendarioMovil
            semana={semana}
            dia={dia}
            hoy={hoy}
            citas={delDia}
            porDia={porDia}
            userId={user?.id}
            puedeGestionar={gestiona}
            soloLista
            onPickDia={setDia}
            onMover={(id, destino) => void moverCita(id, destino)}
            onEstado={cambiarEstado}
            onCambiarHora={(id, horaNueva) => void moverCita(id, dia, { minutos: minutosDesdeHora(horaNueva) })}
            onEditar={abrirEdicion}
          />
        </div>
      ) : null}

      <NuevaEntradaCalendario
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setEditando(null);
        }}
        dia={dia}
        onDia={setDia}
        hora={hora}
        onHora={setHora}
        propiedades={propiedades}
        clientes={clientes}
        propiedadId={propiedadId}
        clienteId={clienteId}
        clientesExtraIds={clientesExtraIds}
        notas={notas}
        lugar={lugar}
        onPropiedad={setPropiedadId}
        onCliente={setClienteId}
        onClientesExtra={setClientesExtraIds}
        onNotas={setNotas}
        onLugar={setLugar}
        saving={saving}
        edicion={
          editando
            ? {
                id: editando.id,
                tipo: editando.tipo,
                titulo: editando.titulo,
                estado: editando.estado,
                notas: editando.notas,
              }
            : null
        }
        onGuardar={(tipo, titulo) => void guardar(tipo, titulo)}
        onCancelar={cancelarEntrada}
      />

      <h2 className="mt-8 hidden text-[15px] font-semibold capitalize min-[820px]:block">
        {new Date(`${dia}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
      </h2>
      <ul className="mt-3 hidden space-y-2 min-[820px]:block">
        {delDia.map((cita) => {
          const mapsConsulta = cita.lugar?.trim() || direccionDeInmueble(cita.propiedades ?? {});
          return (
            <li
              key={cita.id}
              className={`flex flex-col gap-3 rounded-2xl border border-[#E6E3DD] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                cita.estado !== "prevista" ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <AvatarComercial
                  id={cita.comercial_id}
                  nombre={cita.profiles?.nombre_completo}
                  color={cita.profiles?.color}
                  size={28}
                  className="mt-0.5"
                />
                <div>
                  <p className="font-medium">{cita.titulo}</p>
                  <p className="text-xs text-[#5D6B67]">
                    {horaCita(cita.empieza)}
                    {cita.profiles?.nombre_completo && cita.comercial_id !== user?.id
                      ? ` · ${cita.profiles.nombre_completo}`
                      : ""}{" "}
                    ·{" "}
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
                  {mapsConsulta ? (
                    <p className="mt-1 text-xs">
                      <EnlaceMaps consulta={mapsConsulta} />
                    </p>
                  ) : null}
                  {cita.tipo === "evento" &&
                  (cita.clientes?.nombre || (cita.clientes_extra_ids?.length ?? 0) > 0) ? (
                    <p className="mt-1 text-xs text-[#5D6B67]">
                      {[
                        cita.clientes?.nombre,
                        ...(cita.clientes_extra_ids ?? []).map((id) => {
                          const nombre = clientes.find((c) => c.id === id)?.nombre;
                          return nombre ? `+ ${nombre}` : null;
                        }),
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    </p>
                  ) : null}
                  {cita.notas?.trim() ? (
                    <p className="mt-1 text-xs italic text-[#5D6B67]">{cita.notas.trim()}</p>
                  ) : null}
                </div>
              </div>
              {gestiona(cita.comercial_id) ? (
                <CitaAcciones cita={cita} onEstado={cambiarEstado} onEditar={abrirEdicion} />
              ) : null}
            </li>
          );
        })}
        {delDia.length === 0 ? <li className="text-sm text-[#5D6B67]">No hay citas este día.</li> : null}
      </ul>
    </div>
  );
}
