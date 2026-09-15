"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { puedeHacerParte, rutaNuevaVisitaDesdeCita } from "@/lib/citas/citas";

export type CitaAccionable = {
  id: string;
  tipo: string;
  estado: string;
  propiedad_id: string | null;
};

export function CitaAcciones({
  cita,
  onEstado,
  onEditar,
  compact = false,
}: {
  cita: CitaAccionable;
  onEstado: (id: string, estado: "hecha" | "cancelada") => void;
  onEditar?: (id: string) => void;
  compact?: boolean;
}) {
  if (cita.estado !== "prevista") return null;
  return (
    <div className="flex flex-wrap gap-1">
      {puedeHacerParte(cita) ? (
        <Button asChild size="sm">
          <Link href={rutaNuevaVisitaDesdeCita({ id: cita.id, propiedadId: cita.propiedad_id })}>
            {compact ? "Parte" : "Hacer parte"}
          </Link>
        </Button>
      ) : null}
      <Button type="button" size="sm" variant="secondary" onClick={() => onEstado(cita.id, "hecha")}>
        Hecha
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => onEstado(cita.id, "cancelada")}>
        Cancelar
      </Button>
      {onEditar ? (
        <Button type="button" size="sm" variant="ghost" onClick={() => onEditar(cita.id)}>
          Editar
        </Button>
      ) : null}
    </div>
  );
}
