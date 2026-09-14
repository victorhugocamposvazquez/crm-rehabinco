"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { AsignacionFinca, ComercialAsignable } from "@/lib/catastro-host/finca-assignment";
import { cn } from "@/lib/utils";

type Props = {
  fincaReference: string;
  comerciales: ComercialAsignable[];
  asignacion: AsignacionFinca | null;
  compacto?: boolean;
  disabled?: boolean;
  onCambio?: (asignacion: AsignacionFinca | null) => void;
};

export async function guardarAsignacionFinca(
  fincaReference: string,
  comercialId: string | null
): Promise<AsignacionFinca | null> {
  const respuesta = await fetch("/api/catastro/assignments", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fincaReference, comercialId }),
  });
  const json = (await respuesta.json()) as {
    ok?: boolean;
    assignment?: AsignacionFinca | null;
    error?: string;
  };
  if (!respuesta.ok || !json.ok) {
    throw new Error(json.error ?? "No se ha podido asignar.");
  }
  return json.assignment ?? null;
}

export function AsignacionFincaSelect({
  fincaReference,
  comerciales,
  asignacion,
  compacto = false,
  disabled = false,
  onCambio,
}: Props) {
  const [pendiente, setPendiente] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const valor = pendiente ?? asignacion?.comercialId ?? "";

  useEffect(() => {
    setPendiente(null);
  }, [asignacion?.comercialId, fincaReference]);

  const guardar = async (comercialId: string) => {
    setPendiente(comercialId);
    setGuardando(true);
    try {
      const siguiente = await guardarAsignacionFinca(fincaReference, comercialId || null);
      onCambio?.(siguiente);
      toast.success(siguiente ? `Asignada a ${siguiente.nombre}.` : "Sin comercial asignado.");
    } catch (error) {
      setPendiente(null);
      toast.error(error instanceof Error ? error.message : "No se ha podido asignar.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <select
      value={valor}
      disabled={disabled || guardando}
      aria-label={asignacion ? `Asignada a ${asignacion.nombre}` : "Sin asignar"}
      onClick={(evento) => evento.stopPropagation()}
      onPointerDown={(evento) => evento.stopPropagation()}
      onKeyDown={(evento) => evento.stopPropagation()}
      onChange={(evento) => void guardar(evento.target.value)}
      className={cn(
        "rounded-[10px] border border-[#DAD6CE] bg-white text-[#131C1A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7461] disabled:opacity-60",
        compacto
          ? "h-[29px] w-full max-w-[168px] px-2 text-[12px]"
          : "mt-2 h-11 w-full px-3 text-[13.5px]"
      )}
    >
      <option value="">Sin asignar</option>
      {comerciales.map((item) => (
        <option key={item.id} value={item.id}>
          {item.nombre}
        </option>
      ))}
    </select>
  );
}
