"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Selector } from "@/components/ui/selector";
import { DialogoAnularCita } from "@/components/citas/DialogoAnularCita";
import { puedeHacerParte, rutaNuevaVisitaDesdeCita, type EstadoCita } from "@/lib/citas/citas";

export type CitaAccionable = {
  id: string;
  tipo: string;
  estado: string;
  propiedad_id: string | null;
  motivo_anulacion?: string | null;
};

type EstadoGestion = Extract<EstadoCita, "prevista" | "hecha" | "cancelada">;

export function CitaAcciones({
  cita,
  onEstado,
  onEditar,
  compact = false,
  enPie = false,
}: {
  cita: CitaAccionable;
  onEstado: (id: string, estado: EstadoGestion, motivoAnulacion?: string | null) => void;
  onEditar?: (id: string) => void;
  compact?: boolean;
  enPie?: boolean;
}) {
  const [anularOpen, setAnularOpen] = useState(false);
  const [anulando, setAnulando] = useState(false);

  if (cita.estado === "cancelada") {
    return cita.motivo_anulacion?.trim() ? (
      <p className="text-[12.5px] text-[var(--text-2)]">
        Anulada · {cita.motivo_anulacion.trim()}
      </p>
    ) : (
      <p className="text-[12.5px] text-[var(--text-2)]">Anulada</p>
    );
  }

  if (cita.estado !== "prevista" && cita.estado !== "hecha" && cita.estado !== "no_asistio") {
    return null;
  }

  const valorSelect = cita.estado === "no_asistio" ? "prevista" : (cita.estado as EstadoGestion);

  const cambiarEstado = (siguiente: string) => {
    if (siguiente === valorSelect) return;
    if (siguiente === "cancelada") {
      setAnularOpen(true);
      return;
    }
    onEstado(cita.id, siguiente as EstadoGestion, null);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {puedeHacerParte(cita) && cita.estado === "prevista" ? (
          <Button asChild size="sm">
            <Link href={rutaNuevaVisitaDesdeCita({ id: cita.id, propiedadId: cita.propiedad_id })}>
              {compact ? "Parte" : "Hacer parte"}
            </Link>
          </Button>
        ) : null}
        <label className="min-w-[8.5rem]">
          <Selector
            value={valorSelect}
            onChange={(e) => cambiarEstado(e.target.value)}
            className={
              enPie
                ? "h-11 w-[11.5rem] rounded-[10px] border border-[var(--input)] bg-[var(--field)] px-3 text-[14px] font-medium"
                : "h-8 w-full min-w-[8.5rem] rounded-[9px] border border-[var(--input)] bg-[var(--field)] px-2.5 text-[13px] font-medium"
            }
            aria-label="Estado de la entrada"
          >
            <option value="prevista">Prevista</option>
            <option value="hecha">Finalizada</option>
            <option value="cancelada">Anulada</option>
          </Selector>
        </label>
        {onEditar && cita.estado === "prevista" ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => onEditar(cita.id)}>
            Editar
          </Button>
        ) : null}
      </div>
      <DialogoAnularCita
        open={anularOpen}
        onOpenChange={setAnularOpen}
        loading={anulando}
        onConfirmar={async (motivo) => {
          setAnulando(true);
          try {
            await onEstado(cita.id, "cancelada", motivo);
            setAnularOpen(false);
          } finally {
            setAnulando(false);
          }
        }}
      />
    </>
  );
}
