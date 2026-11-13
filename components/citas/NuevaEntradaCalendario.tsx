"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { AltaField, AltaPersona, AltaSection, AltaShell, altaControl, type PersonaOpcion } from "@/components/ui/alta-form";
import { TimeInput } from "@/components/ui/time-input";
import { FechaInput } from "@/components/ui/fecha-hora";
import { Selector } from "@/components/ui/selector";
import { AvatarComercial } from "@/components/ui/avatar-comercial";
import { NuevoClientePanel } from "@/components/clientes/NuevoClientePanel";
import { BuscadorInmuebleCalendario } from "@/components/citas/BuscadorInmuebleCalendario";
import { CitaAcciones } from "@/components/citas/CitaAcciones";
import { NotasTareaFecha } from "@/components/tareas/NotasTareaFecha";
import { EnlaceMaps } from "@/components/citas/InmueblePreviewCita";
import { TextoConEnlaces } from "@/components/ui/TextoConEnlaces";
import { createClient } from "@/lib/supabase/client";
import { nombreYApellido } from "@/lib/ui/tokens";
import {
  direccionDeInmueble,
  entradaConAsistentes,
  entradaConNotas,
  mapInmuebleCalendario,
  horaCita,
  SELECT_INMUEBLE_CALENDARIO,
  TIPOS_ALTA_CALENDARIO,
  TIPO_CITA_LABEL,
  type InmuebleCalendario,
  type TipoAltaCalendario,
} from "@/lib/citas/citas";
import { coincideTelefonoBusqueda } from "@/lib/ui/busqueda";

type ComercialOpcion = { id: string; nombre: string; color: string | null };

export type EdicionCalendario = {
  id: string;
  tipo: string;
  titulo: string;
  estado: string;
  notas?: string | null;
  motivo_anulacion?: string | null;
  tarea_id?: string | null;
  empieza?: string | null;
};

export type NotaPreviaCalendario = {
  id: string;
  texto: string;
  created_at: string | null;
  autor?: string | null;
};

export type DatosGuardarEntradaCalendario = {
  tipo: TipoAltaCalendario;
  titulo: string;
  /** Id del inmueble elegido en el buscador (fuente de verdad al guardar). */
  propiedadId: string;
};

export function NuevaEntradaCalendario({
  open,
  onOpenChange,
  dia,
  onDia,
  hora,
  onHora,
  propiedades,
  clientes,
  propiedadId,
  clienteId,
  clientesExtraIds,
  notas,
  lugar,
  onPropiedad,
  onCliente,
  onClientesExtra,
  onNotas,
  onLugar,
  comerciales,
  comercialId,
  onComercial,
  saving,
  edicion,
  onGuardar,
  onCambiarEstado,
  onTareaId,
  notasPrevias = [],
  tickNotas = 0,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dia: string;
  onDia: (dia: string) => void;
  hora: string;
  onHora: (hora: string) => void;
  propiedades: InmuebleCalendario[];
  clientes: PersonaOpcion[];
  propiedadId: string;
  clienteId: string;
  clientesExtraIds: string[];
  notas: string;
  lugar: string;
  onPropiedad: (id: string) => void;
  onCliente: (id: string) => void;
  onClientesExtra: (ids: string[]) => void;
  onNotas: (notas: string) => void;
  onLugar: (lugar: string) => void;
  comerciales?: ComercialOpcion[];
  comercialId?: string;
  onComercial?: (id: string) => void;
  saving: boolean;
  edicion?: EdicionCalendario | null;
  onGuardar: (datos: DatosGuardarEntradaCalendario) => void;
  onCambiarEstado?: (estado: "prevista" | "hecha" | "cancelada", motivoAnulacion?: string | null) => void;
  onTareaId?: (tareaId: string) => void;
  notasPrevias?: NotaPreviaCalendario[];
  tickNotas?: number;
}) {
  const equipo = comerciales ?? [];
  const comercialSel = equipo.find((c) => c.id === comercialId) ?? null;
  const [tipo, setTipo] = useState<TipoAltaCalendario>("evento");
  const [titulo, setTitulo] = useState("");
  const [qCliente, setQCliente] = useState("");
  const [qClienteExtra, setQClienteExtra] = useState("");
  const [agenda, setAgenda] = useState<PersonaOpcion[]>(clientes);
  const [altaClienteOpen, setAltaClienteOpen] = useState(false);
  const [altaClienteNombre, setAltaClienteNombre] = useState("");
  const [altaClienteExtraOpen, setAltaClienteExtraOpen] = useState(false);
  const [altaClienteExtraNombre, setAltaClienteExtraNombre] = useState("");
  const [anadiendoClienteExtra, setAnadiendoClienteExtra] = useState(false);
  const [inmuebleSel, setInmuebleSel] = useState<InmuebleCalendario | null>(null);
  const sesionFormulario = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      sesionFormulario.current = null;
      return;
    }
    // `edicion` es un objeto nuevo en cada render del calendario. Si el efecto
    // se reinicia con él, cada tecla en Notas vuelve al texto guardado.
    const clave = edicion?.id ?? "nueva";
    if (sesionFormulario.current === clave) return;
    sesionFormulario.current = clave;
    setQCliente("");
    setQClienteExtra("");
    setAnadiendoClienteExtra(false);
    if (edicion) {
      setTitulo(edicion.titulo);
      setTipo(TIPOS_ALTA_CALENDARIO.includes(edicion.tipo as TipoAltaCalendario) ? (edicion.tipo as TipoAltaCalendario) : "evento");
      onNotas(edicion.notas?.trim() ?? "");
      return;
    }
    setTitulo("");
    setTipo("evento");
    onNotas("");
    onClientesExtra([]);
  }, [open, edicion, onNotas, onClientesExtra]);

  useEffect(() => {
    setAgenda((prev) => {
      const byId = new Map(clientes.map((c) => [c.id, c] as const));
      for (const c of prev) {
        if (!byId.has(c.id)) byId.set(c.id, c);
      }
      return [...byId.values()];
    });
  }, [clientes]);

  useEffect(() => {
    if (!open) return;
    if (!propiedadId) {
      setInmuebleSel(null);
      return;
    }
    const local = propiedades.find((p) => p.id === propiedadId);
    if (local) setInmuebleSel(local);

    const supabase = createClient();
    void supabase
      .from("propiedades")
      .select(`${SELECT_INMUEBLE_CALENDARIO}, inmueble_media(url, portada, tipo)`)
      .eq("id", propiedadId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setInmuebleSel(mapInmuebleCalendario(data));
      });
  }, [open, propiedadId, propiedades]);

  const etiquetaDia = new Date(`${dia}T12:00:00`).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const diaGuardado = edicion?.empieza?.slice(0, 10) ?? "";
  const horaGuardada = edicion?.empieza ? horaCita(edicion.empieza) : "";
  const fechaCambiada = Boolean(edicion?.empieza && (dia !== diaGuardado || hora.slice(0, 5) !== horaGuardada));
  const etiquetaGuardada = edicion?.empieza
    ? `${new Date(`${diaGuardado}T12:00:00`).toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })} a las ${horaGuardada}`
    : "";
  const clienteSel = agenda.find((c) => c.id === clienteId);
  const esEvento = entradaConAsistentes(tipo);
  const conNotas = entradaConNotas(tipo);
  const tipos = edicion?.tipo === "tarea" ? (["tarea"] as const) : TIPOS_ALTA_CALENDARIO.filter((item) => item !== "tarea" || !edicion);
  const mapsConsulta = lugar.trim() || (inmuebleSel ? direccionDeInmueble(inmuebleSel) : "");
  const sugeridos = useMemo(() => {
    const q = qCliente.trim().toLowerCase();
    if (!q) return [];
    return agenda
      .filter((c) => c.nombre.toLowerCase().includes(q) || coincideTelefonoBusqueda(c.telefono, qCliente))
      .slice(0, 6);
  }, [agenda, qCliente]);
  const sugeridosExtra = useMemo(() => {
    const q = qClienteExtra.trim().toLowerCase();
    if (!q) return [];
    const excluir = new Set([clienteId, ...clientesExtraIds]);
    return agenda
      .filter(
        (c) =>
          !excluir.has(c.id) &&
          (c.nombre.toLowerCase().includes(q) || coincideTelefonoBusqueda(c.telefono, qClienteExtra))
      )
      .slice(0, 6);
  }, [agenda, qClienteExtra, clienteId, clientesExtraIds]);
  const citaParaNotas = useMemo(() => {
    if (!edicion || !comercialId) return null;
    return {
      id: edicion.id,
      comercial_id: comercialId,
      tipo: edicion.tipo,
      titulo: edicion.titulo,
      empieza: `${dia}T${hora}:00`,
      propiedad_id: propiedadId || null,
      cliente_id: clienteId || null,
      estado: edicion.estado,
      tarea_id: edicion.tarea_id ?? null,
    };
  }, [edicion, comercialId, dia, hora, propiedadId, clienteId]);
  const bloqueNotas = !conNotas ? null : edicion ? (
    <AltaSection
      wide
      title="Notas"
      hint="Para ahora se guarda al momento. Ya guardado es el historial: no se borra al reabrir ni al cambiar la hora."
    >
      <NotasTareaFecha
        tareaId={edicion.tarea_id}
        notaLegacy={edicion.notas}
        cita={citaParaNotas}
        onTareaId={onTareaId}
        tick={tickNotas}
      />
    </AltaSection>
  ) : (
    <AltaSection
      wide
      title="Notas"
      hint="Para ahora se guarda al crear la entrada. Ya guardado son las notas del contacto, con su fecha."
    >
      <div className="mb-3">
        <p className="mb-2 text-[13px] font-semibold text-foreground">Para ahora</p>
        <textarea
          value={notas}
          onChange={(e) => onNotas(e.target.value)}
          placeholder="Qué hay que hacer ahora…"
          rows={3}
          className="min-h-[5rem] w-full resize-y rounded-[9px] border border-[var(--input)] bg-white px-3 py-2.5 text-[13.5px] outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/15 max-[819px]:text-base"
        />
      </div>
      {notasPrevias.length > 0 ? (
        <div>
          <p className="mb-2 text-[12.5px] font-medium text-[var(--text-3)]">Ya guardado</p>
          <ul className="space-y-2">
            {notasPrevias.map((n) => (
              <li key={n.id} className="rounded-[10px] border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3.5 py-2.5">
                <p className="text-[11px] font-medium text-[var(--text-3)]">
                  {n.created_at
                    ? new Date(n.created_at).toLocaleString("es-ES", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Sin fecha"}
                  {n.autor ? ` · ${n.autor}` : " · nota del contacto"}
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[var(--text-2)]">
                  <TextoConEnlaces texto={n.texto} />
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </AltaSection>
  );

  const elegirInmueble = (inmueble: InmuebleCalendario) => {
    const prev = inmuebleSel ? direccionDeInmueble(inmuebleSel) : "";
    setInmuebleSel(inmueble);
    onPropiedad(inmueble.id);
    const siguiente = direccionDeInmueble(inmueble);
    if (!lugar.trim() || lugar.trim() === prev) onLugar(siguiente);
  };

  const quitarInmueble = () => {
    setInmuebleSel(null);
    onPropiedad("");
    onLugar("");
  };

  const quitarClienteExtra = (id: string) => {
    onClientesExtra(clientesExtraIds.filter((item) => item !== id));
  };

  const anadirClienteExtra = (id: string) => {
    if (!id || id === clienteId || clientesExtraIds.includes(id)) return;
    onClientesExtra([...clientesExtraIds, id]);
    setQClienteExtra("");
    setAnadiendoClienteExtra(false);
  };

  return (
    <>
      <AltaShell
        open={open}
        onOpenChange={onOpenChange}
        title={edicion ? "Editar entrada" : "Nueva entrada"}
        hint={
          edicion
            ? fechaCambiada
              ? `Nueva fecha: ${etiquetaDia} a las ${hora}. La anterior queda en Ya guardado.`
              : `Fecha de ahora: ${etiquetaDia} a las ${hora}. Si la cambias, esa será la nueva.`
            : `Esta será la fecha: ${etiquetaDia} a las ${hora}. Cámbiala si el hueco no encaja.`
        }
        primaryLabel={edicion ? "Guardar cambios" : `Crear ${TIPO_CITA_LABEL[tipo].toLowerCase()}`}
        saving={saving}
        footerHint={
          edicion
            ? "Guardar cambios no cierra este panel. Cierra con la X o pulsando fuera cuando hayas terminado."
            : "Cerrar no crea nada. La hora sale del hueco que has pulsado y se puede cambiar aquí."
        }
        footerLeading={
          edicion && onCambiarEstado ? (
            <CitaAcciones
              enPie
              cita={{
                id: edicion.id,
                tipo: edicion.tipo,
                estado: edicion.estado,
                propiedad_id: propiedadId || null,
                motivo_anulacion: edicion.motivo_anulacion,
              }}
              onEstado={(_, estado, motivo) => onCambiarEstado(estado, motivo)}
            />
          ) : null
        }
        onSubmit={() =>
          onGuardar({
            tipo,
            titulo,
            propiedadId: inmuebleSel?.id ?? propiedadId,
          })
        }
      >
        {edicion?.estado === "hecha" && onCambiarEstado ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 min-[820px]:col-span-2">
            <div>
              <p className="text-[13.5px] font-medium text-foreground">Finalizada</p>
              <p className="text-[12.5px] text-[var(--text-2)]">Reabrir la deja prevista. Lo escrito sigue en Ya guardado.</p>
            </div>
            <button
              type="button"
              onClick={() => onCambiarEstado("prevista", null)}
              className="inline-flex h-9 items-center justify-center rounded-[8px] bg-[var(--green)] px-3.5 text-[13px] font-medium text-[var(--on-green)]"
            >
              Reabrir
            </button>
          </div>
        ) : null}
        <AltaSection
          wide
          title="Cliente"
          hint={
            tipo === "llamada"
              ? "Busca al cliente o créalo aquí mismo si aún no está en la agenda."
              : "Opcional. Busca en la agenda o créalo aquí mismo si no está."
          }
        >
          <AltaPersona
            permitirNinguno
            seleccionado={clienteSel}
            onSeleccionar={(persona) => {
              onCliente(persona.id);
              if (clientesExtraIds.includes(persona.id)) {
                onClientesExtra(clientesExtraIds.filter((id) => id !== persona.id));
              }
            }}
            onLimpiar={() => onCliente("")}
            q={qCliente}
            setQ={setQCliente}
            sugeridos={sugeridos}
            onAltaNueva={(nombreSugerido) => {
              setAltaClienteNombre(nombreSugerido ?? "");
              setAltaClienteOpen(true);
            }}
          />
        </AltaSection>

        {esEvento ? (
          <AltaSection wide title="Más clientes" hint={tipo === "captacion" ? "Opcional. Añade todos los que vengan a la captación." : "Opcional. Añade todos los que vengan al evento."}>
            <div className="flex flex-col gap-3">
              {clientesExtraIds.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {clientesExtraIds.map((id) => {
                    const persona = agenda.find((c) => c.id === id);
                    return (
                      <li
                        key={id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-1.5 text-[13px]"
                      >
                        <span className="font-medium">{persona?.nombre ?? "Cliente"}</span>
                        <button
                          type="button"
                          onClick={() => quitarClienteExtra(id)}
                          className="text-[var(--text-3)] hover:text-[var(--text-1)]"
                          aria-label={`Quitar ${persona?.nombre ?? "cliente"}`}
                        >
                          ×
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              {anadiendoClienteExtra ? (
                <div>
                  <AltaPersona
                    permitirNinguno
                    seleccionado={undefined}
                    onSeleccionar={(persona) => anadirClienteExtra(persona.id)}
                    onLimpiar={() => {
                      setAnadiendoClienteExtra(false);
                      setQClienteExtra("");
                    }}
                    q={qClienteExtra}
                    setQ={setQClienteExtra}
                    sugeridos={sugeridosExtra}
                    onAltaNueva={(nombreSugerido) => {
                      setAltaClienteExtraNombre(nombreSugerido ?? "");
                      setAltaClienteExtraOpen(true);
                    }}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAnadiendoClienteExtra(true)}
                  className="inline-flex items-center gap-1.5 self-start rounded-[9px] border border-dashed border-[var(--border)] px-3 py-2 text-[13px] font-semibold text-accent hover:border-accent/40 hover:bg-accent/5"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Añadir cliente
                </button>
              )}
            </div>
          </AltaSection>
        ) : null}

        {edicion ? bloqueNotas : null}
        <AltaSection
          title="Qué"
          hint="Visita, llamada, firma, tasación, evento, captación, recordatorio o tarea. El título es lo que verás en la rejilla."
        >
          <div className="flex flex-wrap gap-2">
            {tipos.map((item) => (
              <ToggleChip key={item} on={tipo === item} onClick={() => setTipo(item)}>
                {TIPO_CITA_LABEL[item]}
              </ToggleChip>
            ))}
          </div>
        </AltaSection>

        <AltaSection
          title="Nueva fecha"
          hint={
            !edicion
              ? "Esta será la fecha de la entrada."
              : fechaCambiada
                ? `Antes: ${etiquetaGuardada}. Al guardar, queda la de aquí.`
                : "Es la de ahora. Si cambias el día o la hora, al guardar esta pasa a ser la nueva y la anterior queda en Ya guardado."
          }
        >
          <div className="grid grid-cols-2 gap-3">
            <AltaField label="Día">
              <FechaInput value={dia} onChange={onDia} className={altaControl} />
            </AltaField>
            <AltaField label="Hora">
              <TimeInput value={hora} onChange={onHora} className={altaControl} />
            </AltaField>
          </div>
        </AltaSection>

        <div className="min-w-0">
          <AltaField label="Título" optional>
            <input
              autoFocus={!edicion}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder={`${TIPO_CITA_LABEL[tipo]} a las ${hora}`}
              className={altaControl}
            />
          </AltaField>
        </div>

        {equipo.length > 0 && onComercial && comercialId ? (
          <AltaSection
            title="Comercial"
            hint="Quién aparece asignado a esta entrada. Puedes crearla a nombre de otra persona del equipo."
          >
            <div className="flex items-center gap-2">
              <AvatarComercial
                nombre={comercialSel?.nombre}
                color={comercialSel?.color}
                size={28}
              />
              <Selector
                value={comercialId}
                onChange={(e) => onComercial(e.target.value)}
                className="min-w-0 flex-1"
                aria-label="Comercial asignado"
              >
                {equipo.some((c) => c.id === comercialId) ? null : (
                  <option value={comercialId}>{comercialSel?.nombre ?? "Comercial"}</option>
                )}
                {equipo.map((c) => (
                  <option key={c.id} value={c.id}>
                    {nombreYApellido(c.nombre) || c.nombre}
                  </option>
                ))}
              </Selector>
            </div>
          </AltaSection>
        ) : null}

        {!edicion ? bloqueNotas : null}

        <AltaSection
          wide
          title={tipo === "llamada" ? "Inmueble (opcional)" : "Inmueble y visita"}
          hint="Busca por referencia, calle o localidad. Solo entonces verás coincidencias; al elegir una aparece la ficha y Maps."
        >
          <AltaField label="Inmueble" optional>
            <BuscadorInmuebleCalendario inmueble={inmuebleSel} onElegir={elegirInmueble} onQuitar={quitarInmueble} />
          </AltaField>
          <div className="mt-4">
            <AltaField label={tipo === "visita" ? "Dirección de la visita" : "Dirección"} optional>
              <input
                value={lugar}
                onChange={(e) => onLugar(e.target.value)}
                placeholder={inmuebleSel ? direccionDeInmueble(inmuebleSel) || "Calle, número, localidad" : "Calle, número, localidad"}
                className={altaControl}
              />
            </AltaField>
            {mapsConsulta ? (
              <p className="mt-2 text-[12.5px]">
                <EnlaceMaps consulta={mapsConsulta} lat={inmuebleSel?.lat} lng={inmuebleSel?.lng} />
              </p>
            ) : (
              <p className="mt-2 text-[12.5px] text-[var(--text-3)]">Escribe una dirección o elige un inmueble para abrir Maps.</p>
            )}
          </div>
        </AltaSection>
      </AltaShell>
      <NuevoClientePanel
        open={altaClienteOpen}
        onOpenChange={setAltaClienteOpen}
        elevated
        nombreInicial={altaClienteNombre}
        ambito="desde-calendario"
        onCreado={(id, extra) => {
          setAgenda((prev) => {
            if (prev.some((c) => c.id === id)) return prev;
            return [...prev, { id, nombre: extra?.nombre ?? "Cliente", telefono: extra?.telefono ?? null }].sort((a, b) =>
              a.nombre.localeCompare(b.nombre)
            );
          });
          onCliente(id);
        }}
      />
      <NuevoClientePanel
        open={altaClienteExtraOpen}
        onOpenChange={setAltaClienteExtraOpen}
        elevated
        nombreInicial={altaClienteExtraNombre}
        ambito="desde-calendario"
        onCreado={(id, extra) => {
          setAgenda((prev) => {
            if (prev.some((c) => c.id === id)) return prev;
            return [...prev, { id, nombre: extra?.nombre ?? "Cliente", telefono: extra?.telefono ?? null }].sort((a, b) =>
              a.nombre.localeCompare(b.nombre)
            );
          });
          anadirClienteExtra(id);
        }}
      />
    </>
  );
}
