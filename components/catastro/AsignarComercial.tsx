"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { AsignacionFinca, ComercialAsignable } from "@/lib/catastro-host/finca-assignment";

type Props = {
  fincaReference: string;
  vinculada?: boolean;
};

export function AsignarComercial({ fincaReference, vinculada = false }: Props) {
  const [comerciales, setComerciales] = useState<ComercialAsignable[]>([]);
  const [asignacion, setAsignacion] = useState<AsignacionFinca | null>(null);
  const [valor, setValor] = useState("");
  const [estado, setEstado] = useState<"cargando" | "idle" | "guardando">("cargando");

  useEffect(() => {
    let vivo = true;
    setEstado("cargando");
    void fetch(`/api/catastro/assignments?refs=${encodeURIComponent(fincaReference)}`)
      .then(async (respuesta) => {
        const json = (await respuesta.json()) as {
          ok?: boolean;
          comerciales?: ComercialAsignable[];
          assignments?: AsignacionFinca[];
          error?: string;
        };
        if (!vivo) return;
        if (!respuesta.ok || !json.ok) {
          toast.error(json.error ?? "No se han podido cargar los comerciales.");
          setEstado("idle");
          return;
        }
        const actual = json.assignments?.find((item) => item.fincaReference === fincaReference) ?? null;
        setComerciales(json.comerciales ?? []);
        setAsignacion(actual);
        setValor(actual?.comercialId ?? "");
        setEstado("idle");
      })
      .catch(() => {
        if (!vivo) return;
        toast.error("No se han podido cargar los comerciales.");
        setEstado("idle");
      });
    return () => {
      vivo = false;
    };
  }, [fincaReference]);

  const guardar = async (comercialId: string) => {
    setValor(comercialId);
    setEstado("guardando");
    try {
      const respuesta = await fetch("/api/catastro/assignments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fincaReference, comercialId: comercialId || null }),
      });
      const json = (await respuesta.json()) as {
        ok?: boolean;
        assignment?: AsignacionFinca | null;
        error?: string;
      };
      if (!respuesta.ok || !json.ok) {
        toast.error(json.error ?? "No se ha podido asignar.");
        return;
      }
      setAsignacion(json.assignment ?? null);
      toast.success(json.assignment ? `Asignada a ${json.assignment.nombre}.` : "Sin comercial asignado.");
    } catch {
      toast.error("No se ha podido asignar.");
    } finally {
      setEstado("idle");
    }
  };

  return (
    <section className="mt-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-[#131C1A]">Comercial</h3>
        <p className="text-[11.5px] text-[#6B7A76]">
          {asignacion ? asignacion.nombre : "Sin asignar"}
        </p>
      </div>
      <p className="mt-1 text-[12.5px] text-[#5D6B67]">
        {vinculada
          ? "Hará las visitas desde la propiedad. Aquí no se crea la visita."
          : "Así queda en su lista. La visita se crea cuando exista la propiedad."}
      </p>
      <select
        value={valor}
        disabled={estado !== "idle"}
        onChange={(evento) => void guardar(evento.target.value)}
        aria-label="Asignar comercial"
        className="mt-2 h-11 w-full rounded-[10px] border border-[#DAD6CE] bg-white px-3 text-[13.5px] text-[#131C1A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7461] disabled:opacity-60"
      >
        <option value="">Sin asignar</option>
        {comerciales.map((item) => (
          <option key={item.id} value={item.id}>
            {item.nombre}
          </option>
        ))}
      </select>
    </section>
  );
}
