"use client";

import { useEffect, useMemo, useState } from "react";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { AltaField, AltaPersona, AltaSection, AltaShell, altaControl, type PersonaOpcion } from "@/components/ui/alta-form";
import { NuevoClientePanel } from "@/components/clientes/NuevoClientePanel";
import {
  TIPOS_ALTA_CALENDARIO,
  TIPO_CITA_LABEL,
  type TipoAltaCalendario,
} from "@/lib/citas/citas";

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
  onPropiedad,
  onCliente,
  saving,
  onCrear,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dia: string;
  onDia: (dia: string) => void;
  hora: string;
  onHora: (hora: string) => void;
  propiedades: Array<{ id: string; titulo: string | null; direccion: string | null; referencia: string | null }>;
  clientes: PersonaOpcion[];
  propiedadId: string;
  clienteId: string;
  onPropiedad: (id: string) => void;
  onCliente: (id: string) => void;
  saving: boolean;
  onCrear: (tipo: TipoAltaCalendario, titulo: string) => void;
}) {
  const [tipo, setTipo] = useState<TipoAltaCalendario>("evento");
  const [titulo, setTitulo] = useState("");
  const [qCliente, setQCliente] = useState("");
  const [agenda, setAgenda] = useState<PersonaOpcion[]>(clientes);
  const [altaClienteOpen, setAltaClienteOpen] = useState(false);
  const [altaClienteNombre, setAltaClienteNombre] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitulo("");
    setTipo("evento");
    setQCliente("");
  }, [open]);

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
        title="Nueva entrada"
        hint={`Hueco del ${etiquetaDia} a las ${hora}. Elige tipo, ajusta la hora y crea.`}
        primaryLabel={`Crear ${TIPO_CITA_LABEL[tipo].toLowerCase()}`}
        saving={saving}
        footerHint="Cerrar no crea nada. La hora sale del hueco que has pulsado y se puede cambiar aquí."
        onSubmit={() => onCrear(tipo, titulo)}
      >
        <AltaSection title="Qué" hint="Evento, recordatorio, tarea o visita. El título es lo que verás en la rejilla.">
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap gap-2">
              {TIPOS_ALTA_CALENDARIO.map((item) => (
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

        <AltaSection title="Inmueble" hint="Opcional. Sirve para ir al parte o a la ficha desde la cita.">
          <AltaField label="Inmueble" optional>
            <select value={propiedadId} onChange={(e) => onPropiedad(e.target.value)} className={altaControl}>
              <option value="">Sin inmueble</option>
              {propiedades.map((p) => (
                <option key={p.id} value={p.id}>
                  {[p.referencia, p.titulo || p.direccion].filter(Boolean).join(" · ")}
                </option>
              ))}
            </select>
          </AltaField>
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
