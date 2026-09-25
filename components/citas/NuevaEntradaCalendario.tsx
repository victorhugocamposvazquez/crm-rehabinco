"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { AltaField, AltaPersona, AltaSection, AltaShell, altaControl, type PersonaOpcion } from "@/components/ui/alta-form";
import { TimeInput } from "@/components/ui/time-input";
import { NuevoClientePanel } from "@/components/clientes/NuevoClientePanel";
import { BuscadorInmuebleCalendario } from "@/components/citas/BuscadorInmuebleCalendario";
import { EnlaceMaps } from "@/components/citas/InmueblePreviewCita";
import { createClient } from "@/lib/supabase/client";
import {
  direccionDeInmueble,
  mapInmuebleCalendario,
  SELECT_INMUEBLE_CALENDARIO,
  TIPOS_ALTA_CALENDARIO,
  TIPO_CITA_LABEL,
  type InmuebleCalendario,
  type TipoAltaCalendario,
} from "@/lib/citas/citas";

export type EdicionCalendario = {
  id: string;
  tipo: string;
  titulo: string;
  estado?: string;
  notas?: string | null;
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
  saving,
  edicion,
  onGuardar,
  onCancelar,
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
  saving: boolean;
  edicion?: EdicionCalendario | null;
  onGuardar: (tipo: TipoAltaCalendario, titulo: string) => void;
  onCancelar?: () => void;
}) {
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

  useEffect(() => {
    if (!open) return;
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
  const clienteSel = agenda.find((c) => c.id === clienteId);
  const esEvento = tipo === "evento";
  const tipos = edicion?.tipo === "tarea" ? (["tarea"] as const) : TIPOS_ALTA_CALENDARIO.filter((item) => item !== "tarea" || !edicion);
  const mapsConsulta = lugar.trim() || (inmuebleSel ? direccionDeInmueble(inmuebleSel) : "");
  const sugeridos = useMemo(() => {
    const q = qCliente.trim().toLowerCase();
    if (!q) return [];
    return agenda.filter((c) => `${c.nombre} ${c.telefono ?? ""}`.toLowerCase().includes(q)).slice(0, 6);
  }, [agenda, qCliente]);
  const sugeridosExtra = useMemo(() => {
    const q = qClienteExtra.trim().toLowerCase();
    if (!q) return [];
    const excluir = new Set([clienteId, ...clientesExtraIds]);
    return agenda
      .filter((c) => !excluir.has(c.id) && `${c.nombre} ${c.telefono ?? ""}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [agenda, qClienteExtra, clienteId, clientesExtraIds]);
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
            ? `Cambia hora, inmueble o dirección. Se guarda sobre el ${etiquetaDia} a las ${hora}.`
            : `Hueco del ${etiquetaDia} a las ${hora}. Elige tipo, ajusta la hora y crea.`
        }
        primaryLabel={edicion ? "Guardar cambios" : `Crear ${TIPO_CITA_LABEL[tipo].toLowerCase()}`}
        saving={saving}
        footerHint={
          edicion
            ? "Cerrar descarta los cambios no guardados. Arrastrar en la rejilla también mueve la hora."
            : "Cerrar no crea nada. La hora sale del hueco que has pulsado y se puede cambiar aquí."
        }
        onSubmit={() => onGuardar(tipo, titulo)}
        dangerAction={
          edicion && edicion.estado === "prevista" && onCancelar
            ? {
                label: "Cancelar entrada (desaparece del calendario)",
                onClick: onCancelar,
                disabled: saving,
              }
            : undefined
        }
      >
        <AltaSection title="Qué" hint="Evento, recordatorio, tarea o visita. El título es lo que verás en la rejilla.">
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap gap-2">
              {tipos.map((item) => (
                <ToggleChip key={item} on={tipo === item} onClick={() => setTipo(item)}>
                  {TIPO_CITA_LABEL[item]}
                </ToggleChip>
              ))}
            </div>
            <AltaField label="Título" optional>
              <input
                autoFocus
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder={`${TIPO_CITA_LABEL[tipo]} a las ${hora}`}
                className={altaControl}
              />
            </AltaField>
          </div>
        </AltaSection>

        <AltaSection title="Cuándo" hint="Sale del hueco pulsado. Cámbialo si no encaja.">
          <div className="grid grid-cols-2 gap-3">
            <AltaField label="Día">
              <input type="date" value={dia} onChange={(e) => onDia(e.target.value)} className={altaControl} />
            </AltaField>
            <AltaField label="Hora">
              <TimeInput value={hora} onChange={onHora} className={altaControl} />
            </AltaField>
          </div>
        </AltaSection>

        <AltaSection wide title="Cliente" hint="Opcional. Si no está en la agenda, abre la misma ficha completa de Clientes.">
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
          <AltaSection wide title="Más clientes" hint="Opcional. Añade todos los que vengan al evento.">
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

        {esEvento ? (
          <AltaSection title="Notas" hint="Observaciones internas. No salen en el título del calendario.">
            <textarea
              value={notas}
              onChange={(e) => onNotas(e.target.value)}
              placeholder="Detalles, acuerdos, recordatorios…"
              rows={3}
              className="min-h-[5rem] w-full resize-y rounded-[9px] border border-[var(--input)] bg-white px-3 py-2.5 text-[13.5px] outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/15 max-[819px]:text-base"
            />
          </AltaSection>
        ) : null}

        <AltaSection wide title="Inmueble y visita" hint="Busca por referencia, calle o localidad. Solo entonces verás coincidencias; al elegir una aparece la ficha y Maps.">
          <AltaField label="Inmueble" optional>
            <BuscadorInmuebleCalendario inmueble={inmuebleSel} onElegir={elegirInmueble} onQuitar={quitarInmueble} />
          </AltaField>
          <div className="mt-4">
            <AltaField label="Dirección de la visita" optional>
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
