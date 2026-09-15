"use client";

import { useEffect, useMemo, useState } from "react";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { AltaField, AltaPersona, AltaSection, AltaShell, altaControl, type PersonaOpcion } from "@/components/ui/alta-form";
import { NuevoClientePanel } from "@/components/clientes/NuevoClientePanel";
import { EnlaceMaps, InmueblePreviewCita } from "@/components/citas/InmueblePreviewCita";
import {
  direccionDeInmueble,
  TIPOS_ALTA_CALENDARIO,
  TIPO_CITA_LABEL,
  type InmuebleCalendario,
  type TipoAltaCalendario,
} from "@/lib/citas/citas";

export type EdicionCalendario = {
  id: string;
  tipo: string;
  titulo: string;
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
  lugar,
  onPropiedad,
  onCliente,
  onLugar,
  saving,
  edicion,
  onGuardar,
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
  lugar: string;
  onPropiedad: (id: string) => void;
  onCliente: (id: string) => void;
  onLugar: (lugar: string) => void;
  saving: boolean;
  edicion?: EdicionCalendario | null;
  onGuardar: (tipo: TipoAltaCalendario, titulo: string) => void;
}) {
  const [tipo, setTipo] = useState<TipoAltaCalendario>("evento");
  const [titulo, setTitulo] = useState("");
  const [qCliente, setQCliente] = useState("");
  const [agenda, setAgenda] = useState<PersonaOpcion[]>(clientes);
  const [altaClienteOpen, setAltaClienteOpen] = useState(false);
  const [altaClienteNombre, setAltaClienteNombre] = useState("");

  useEffect(() => {
    if (!open) return;
    setQCliente("");
    if (edicion) {
      setTitulo(edicion.titulo);
      setTipo(TIPOS_ALTA_CALENDARIO.includes(edicion.tipo as TipoAltaCalendario) ? (edicion.tipo as TipoAltaCalendario) : "evento");
      return;
    }
    setTitulo("");
    setTipo("evento");
  }, [open, edicion]);

  useEffect(() => {
    setAgenda((prev) => {
      const byId = new Map(clientes.map((c) => [c.id, c] as const));
      for (const c of prev) {
        if (!byId.has(c.id)) byId.set(c.id, c);
      }
      return [...byId.values()];
    });
  }, [clientes]);

  const etiquetaDia = new Date(`${dia}T12:00:00`).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const clienteSel = agenda.find((c) => c.id === clienteId);
  const inmuebleSel = propiedades.find((p) => p.id === propiedadId);
  const tipos = edicion?.tipo === "tarea" ? (["tarea"] as const) : TIPOS_ALTA_CALENDARIO.filter((item) => item !== "tarea" || !edicion);
  const mapsConsulta = lugar.trim() || (inmuebleSel ? direccionDeInmueble(inmuebleSel) : "");
  const sugeridos = useMemo(() => {
    const q = qCliente.trim().toLowerCase();
    if (!q) return [];
    return agenda.filter((c) => `${c.nombre} ${c.telefono ?? ""}`.toLowerCase().includes(q)).slice(0, 6);
  }, [agenda, qCliente]);

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
              <input type="time" value={hora} onChange={(e) => onHora(e.target.value)} className={altaControl} />
            </AltaField>
          </div>
        </AltaSection>

        <AltaSection wide title="Cliente" hint="Opcional. Si no está en la agenda, abre la misma ficha completa de Clientes.">
          <AltaPersona
            permitirNinguno
            seleccionado={clienteSel}
            onSeleccionar={(persona) => onCliente(persona.id)}
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

        <AltaSection wide title="Inmueble y visita" hint="Si el inmueble ya está en el CRM, verás una ficha corta y el enlace a Maps.">
          <AltaField label="Inmueble" optional>
            <select
              value={propiedadId}
              onChange={(e) => {
                const id = e.target.value;
                const prev = inmuebleSel ? direccionDeInmueble(inmuebleSel) : "";
                const next = propiedades.find((p) => p.id === id);
                onPropiedad(id);
                const siguiente = next ? direccionDeInmueble(next) : "";
                if (!lugar.trim() || lugar.trim() === prev) onLugar(siguiente);
              }}
              className={altaControl}
            >
              <option value="">Sin inmueble</option>
              {propiedades.map((p) => (
                <option key={p.id} value={p.id}>
                  {[p.referencia, p.titulo || p.direccion].filter(Boolean).join(" · ")}
                </option>
              ))}
            </select>
          </AltaField>
          {inmuebleSel ? <InmueblePreviewCita inmueble={inmuebleSel} /> : null}
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
    </>
  );
}
