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
  mapInmuebleCalendario,
  minutosDesdeHora,
  minutosDesdeOffsetY,
  minutosLocalesDeCita,
  moverCitaADiaHora,
  moverSemana,
  relacionUno,
  SELECT_INMUEBLE_CALENDARIO,
  semanaDesde,
  TIPO_CITA_LABEL,
  type EstadoCita,
  type InmuebleCalendario,
  type TipoAltaCalendario,
  type TipoCita,
} from "@/lib/citas/citas";
import { FiltroComercial, type ComercialFiltro } from "@/components/captacion/FiltroComercial";
import { useFiltroComercial } from "@/lib/ui/filtro-comercial";
import { CitaAcciones } from "@/components/citas/CitaAcciones";
import { CalendarioSemana } from "@/components/citas/CalendarioSemana";
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
  estado: string;
  lugar?: string | null;
  tarea_id?: string | null;
  profiles?: { nombre_completo?: string | null; color?: string | null } | null;
  propiedades?: { titulo?: string | null; direccion?: string | null; localidad?: string | null; referencia?: string | null } | null;
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
  const [lugar, setLugar] = useState("");
  const [editando, setEditando] = useState<CitaRow | null>(null);
  const [propiedades, setPropiedades] = useState<InmuebleCalendario[]>([]);
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
        "id, comercial_id, tipo, titulo, empieza, termina, propiedad_id, cliente_id, estado, tarea_id, lugar, profiles:comercial_id(nombre_completo, color), propiedades:propiedad_id(titulo, direccion, localidad, referencia)"
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
  }, [user, admin, dia]);

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

  const abrirHueco = (diaDestino: string, minutos: number) => {
    setEditando(null);
    setPropiedadId("");
    setClienteId("");
    setLugar("");
    setDia(diaDestino);
    setHora(horaDesdeMinutos(minutos));
    setSheetOpen(true);
  };

  const abrirEdicion = (id: string) => {
    const cita = citas.find((item) => item.id === id);
    if (!cita || cita.estado === "cancelada") return;
    setEditando(cita);
    setDia(cita.empieza.slice(0, 10));
    setHora(horaCita(cita.empieza));
    setPropiedadId(cita.propiedad_id ?? "");
    setClienteId(cita.cliente_id ?? "");
    setLugar(cita.lugar?.trim() || direccionDeInmueble(cita.propiedades ?? {}));
    if (cita.propiedad_id) mezclarInmueble(cita.propiedad_id);
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
        description="Pulsa un hueco para crear. Pulsa un evento para editarlo. Arrastra para mover; puedes deshacer desde el aviso."
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
          onEditar={abrirEdicion}
        />
      </div>

      <CalendarioSemana
        semana={semana}
        hoy={hoy}
        porDia={porDia}
        onPickDia={setDia}
        onMover={(id, destino, opts) => void moverCita(id, destino, opts)}
        onEditar={abrirEdicion}
        onCrearHueco={abrirHueco}
      />

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
        lugar={lugar}
        onPropiedad={setPropiedadId}
        onCliente={setClienteId}
        onLugar={setLugar}
        saving={saving}
        edicion={editando ? { id: editando.id, tipo: editando.tipo, titulo: editando.titulo } : null}
        onGuardar={(tipo, titulo) => void guardar(tipo, titulo)}
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
                  {mapsConsulta ? (
                    <p className="mt-1 text-xs">
                      <EnlaceMaps consulta={mapsConsulta} />
                    </p>
                  ) : null}
                </div>
              </div>
              <CitaAcciones cita={cita} onEstado={cambiarEstado} onEditar={abrirEdicion} />
            </li>
          );
        })}
        {delDia.length === 0 ? <li className="text-sm text-[#5D6B67]">No hay citas este día.</li> : null}
      </ul>
    </div>
  );
}
