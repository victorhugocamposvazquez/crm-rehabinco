"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleChip } from "@/components/ui/toggle-chip";
import {
  TIPOS_ALTA_CALENDARIO,
  TIPO_CITA_LABEL,
  type TipoAltaCalendario,
} from "@/lib/citas/citas";

export function NuevaEntradaCalendario({
  open,
  onOpenChange,
  dia,
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
  hora: string;
  onHora: (hora: string) => void;
  propiedades: Array<{ id: string; titulo: string | null; direccion: string | null; referencia: string | null }>;
  clientes: Array<{ id: string; nombre: string }>;
  propiedadId: string;
  clienteId: string;
  onPropiedad: (id: string) => void;
  onCliente: (id: string) => void;
  saving: boolean;
  onCrear: (tipo: TipoAltaCalendario, titulo: string) => void;
}) {
  const [tipo, setTipo] = useState<TipoAltaCalendario>("evento");
  const [titulo, setTitulo] = useState("");

  useEffect(() => {
    if (open) {
      setTitulo("");
      setTipo("evento");
    }
  }, [open, dia, hora]);

  const etiquetaDia = new Date(`${dia}T12:00:00`).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange} showCloseButton>
      <form
        className="flex flex-col gap-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          onCrear(tipo, titulo);
        }}
      >
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight">Nueva entrada</h2>
          <p className="mt-1 text-[13px] capitalize text-[var(--text-2)]">
            {etiquetaDia} · {hora}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {TIPOS_ALTA_CALENDARIO.map((item) => (
            <ToggleChip key={item} on={tipo === item} onClick={() => setTipo(item)}>
              {TIPO_CITA_LABEL[item]}
            </ToggleChip>
          ))}
        </div>
        <div>
          <Label>Título</Label>
          <Input
            autoFocus
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder={`${TIPO_CITA_LABEL[tipo]} a las ${hora}`}
            className="mt-1"
          />
        </div>
        <div>
          <Label>Hora</Label>
          <Input type="time" value={hora} onChange={(e) => onHora(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Inmueble (opcional)</Label>
          <select
            value={propiedadId}
            onChange={(e) => onPropiedad(e.target.value)}
            className="mt-1 flex h-10 w-full rounded-lg border border-border px-3 text-sm"
          >
            <option value="">Sin inmueble</option>
            {propiedades.map((p) => (
              <option key={p.id} value={p.id}>
                {[p.referencia, p.titulo || p.direccion].filter(Boolean).join(" · ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Cliente (opcional)</Label>
          <select
            value={clienteId}
            onChange={(e) => onCliente(e.target.value)}
            className="mt-1 flex h-10 w-full rounded-lg border border-border px-3 text-sm"
          >
            <option value="">Sin cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? "Creando…" : `Crear ${TIPO_CITA_LABEL[tipo].toLowerCase()}`}
        </Button>
      </form>
    </Sheet>
  );
}
