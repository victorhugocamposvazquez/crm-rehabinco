"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  MAX_ASIGNACION_LOTE,
  type AsignacionFinca,
  type ComercialAsignable,
} from "@/lib/catastro-host/finca-assignment";
import { cn } from "@/lib/utils";

type Props = {
  fincaReference?: string;
  fincaReferences?: string[];
  comerciales: ComercialAsignable[];
  asignacion?: AsignacionFinca | null;
  compacto?: boolean;
  disabled?: boolean;
  etiquetaVacia?: string;
  onCambio?: (asignacion: AsignacionFinca | null) => void;
  onCambioLote?: (input: {
    refs: string[];
    comercialId: string | null;
    nombre: string | null;
  }) => void;
};

export async function guardarAsignacionFinca(
  fincaReference: string,
  comercialId: string | null
): Promise<AsignacionFinca | null> {
  const resultado = await guardarAsignacionFincas([fincaReference], comercialId);
  return resultado[0] ?? null;
}

export async function guardarAsignacionFincas(
  fincaReferences: string[],
  comercialId: string | null
): Promise<Array<AsignacionFinca | null>> {
  const refs = [...new Set(fincaReferences.map((item) => item.trim()).filter(Boolean))];
  if (refs.length === 0) throw new Error("No hay fincas para asignar.");
  if (refs.length > MAX_ASIGNACION_LOTE) {
    throw new Error(`Como máximo ${MAX_ASIGNACION_LOTE} fincas de una vez.`);
  }
  const respuesta = await fetch("/api/catastro/assignments", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fincaReference: refs[0],
      fincaReferences: refs,
      comercialId,
    }),
  });
  const json = (await respuesta.json()) as {
    ok?: boolean;
    assignment?: AsignacionFinca | null;
    assignments?: Array<AsignacionFinca | null>;
    error?: string;
  };
  if (!respuesta.ok || !json.ok) {
    throw new Error(json.error ?? "No se ha podido asignar.");
  }
  if (json.assignments) return json.assignments;
  return refs.map(() => json.assignment ?? null);
}

export function AsignacionFincaSelect({
  fincaReference,
  fincaReferences,
  comerciales,
  asignacion = null,
  compacto = false,
  disabled = false,
  etiquetaVacia = "Sin asignar",
  onCambio,
  onCambioLote,
}: Props) {
  const refs = fincaReferences?.length ? fincaReferences : fincaReference ? [fincaReference] : [];
  const lote = refs.length > 1;
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const etiqueta = lote ? etiquetaVacia : asignacion?.nombre ?? etiquetaVacia;

  useEffect(() => {
    if (!abierto) return;
    const onClick = (evento: MouseEvent) => {
      if (!menuRef.current?.contains(evento.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [abierto]);

  const guardar = async (comercialId: string) => {
    setAbierto(false);
    setGuardando(true);
    try {
      const assignments = await guardarAsignacionFincas(refs, comercialId || null);
      const comercial = comerciales.find((item) => item.id === comercialId);
      if (lote) {
        onCambioLote?.({
          refs,
          comercialId: comercialId || null,
          nombre: comercial?.nombre ?? null,
        });
        toast.success(
          comercialId
            ? `${refs.length} fincas asignadas a ${comercial?.nombre ?? "comercial"}.`
            : `${refs.length} fincas sin comercial.`
        );
      } else {
        const siguiente = assignments[0] ?? null;
        onCambio?.(siguiente);
        toast.success(siguiente ? `Asignada a ${siguiente.nombre}.` : "Sin comercial asignado.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se ha podido asignar.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div ref={menuRef} className="relative min-w-0">
      <button
        type="button"
        disabled={disabled || guardando || refs.length === 0}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-label={lote ? etiquetaVacia : asignacion ? `Asignada a ${asignacion.nombre}` : etiquetaVacia}
        onClick={(evento) => {
          evento.stopPropagation();
          setAbierto((prev) => !prev);
        }}
        onPointerDown={(evento) => evento.stopPropagation()}
        onKeyDown={(evento) => evento.stopPropagation()}
        className={cn(
          "inline-flex w-full items-center justify-between gap-1 rounded-lg border border-[#DAD6CE] bg-white font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7461] disabled:opacity-60",
          compacto ? "h-[29px] max-w-[168px] px-2 text-[11.5px]" : "mt-2 h-9 px-2.5 text-[13px]",
          !lote && asignacion ? "text-[#0B7461]" : "text-[#5D6B67]"
        )}
      >
        <span className="min-w-0 truncate">{guardando ? "Guardando…" : etiqueta}</span>
        <ChevronDown className="h-3 w-3 shrink-0 opacity-50" aria-hidden />
      </button>
      {abierto ? (
        <ul
          role="listbox"
          className="absolute right-0 z-30 mt-1 max-h-56 min-w-[11.5rem] overflow-auto rounded-xl border border-[#E6E3DD] bg-white p-1 shadow-lg"
        >
          <li>
            <button
              type="button"
              role="option"
              className="w-full rounded-lg px-2.5 py-1.5 text-left text-[12px] text-[#5D6B67] hover:bg-[#F6F5F1]"
              onClick={(evento) => {
                evento.stopPropagation();
                void guardar("");
              }}
            >
              Sin asignar
            </button>
          </li>
          {comerciales.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                role="option"
                className={cn(
                  "w-full rounded-lg px-2.5 py-1.5 text-left text-[12px] hover:bg-[#F6F5F1]",
                  !lote && asignacion?.comercialId === item.id
                    ? "font-semibold text-[#0B7461]"
                    : "text-[#131C1A]"
                )}
                onClick={(evento) => {
                  evento.stopPropagation();
                  void guardar(item.id);
                }}
              >
                {item.nombre}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
