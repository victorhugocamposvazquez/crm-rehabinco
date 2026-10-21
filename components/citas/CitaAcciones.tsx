"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Selector } from "@/components/ui/selector";
import { puedeHacerParte, rutaNuevaVisitaDesdeCita, type EstadoCita } from "@/lib/citas/citas";

export type CitaAccionable = {
  id: string;
  tipo: string;
  estado: string;
  propiedad_id: string | null;
};

type EstadoGestion = Extract<EstadoCita, "prevista" | "hecha" | "cancelada">;

export function CitaAcciones({
  cita,
  onEstado,
  onEditar,
  compact = false,
}: {
  cita: CitaAccionable;
  onEstado: (id: string, estado: EstadoGestion) => void;
  onEditar?: (id: string) => void;
  compact?: boolean;
}) {
  if (cita.estado !== "prevista" && cita.estado !== "hecha" && cita.estado !== "no_asistio") {
    return null;
  }

  const valorSelect = cita.estado === "no_asistio" ? "prevista" : (cita.estado as EstadoGestion);

  const cambiarEstado = (siguiente: string) => {
    if (siguiente === valorSelect) return;
    if (siguiente === "cancelada") {
      if (!window.confirm("¿Anular esta entrada? Dejará de aparecer en el calendario.")) return;
    }
    onEstado(cita.id, siguiente as EstadoGestion);
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      {puedeHacerParte(cita) && cita.estado === "prevista" ? (
        <Button asChild size="sm">
          <Link href={rutaNuevaVisitaDesdeCita({ id: cita.id, propiedadId: cita.propiedad_id })}>
            {compact ? "Parte" : "Hacer parte"}
          </Link>
        </Button>
      ) : null}
      <label className="flex min-w-[9.5rem] flex-col gap-1 text-[12px]">
        <span className="font-medium text-[var(--text-3)]">Estado</span>
        <Selector
          value={valorSelect}
          onChange={(e) => cambiarEstado(e.target.value)}
          className="h-10 w-full min-w-[11rem] rounded-[9px] border border-[var(--input)] bg-white px-3 text-[13.5px] font-medium"
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
  );
}
