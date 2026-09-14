"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { AsignacionFinca, ComercialAsignable } from "@/lib/catastro-host/finca-assignment";
import { AsignacionFincaSelect } from "./AsignacionFincaSelect";

type Props = {
  fincaReference: string;
  vinculada?: boolean;
  comerciales?: ComercialAsignable[];
  asignacion?: AsignacionFinca | null;
  onCambio?: (asignacion: AsignacionFinca | null) => void;
};

export function AsignarComercial({
  fincaReference,
  vinculada = false,
  comerciales: comercialesProp,
  asignacion: asignacionProp,
  onCambio,
}: Props) {
  const controlado = comercialesProp !== undefined;
  const [comerciales, setComerciales] = useState<ComercialAsignable[]>(comercialesProp ?? []);
  const [asignacion, setAsignacion] = useState<AsignacionFinca | null>(asignacionProp ?? null);
  const [estado, setEstado] = useState<"cargando" | "idle">(controlado ? "idle" : "cargando");

  useEffect(() => {
    if (controlado) {
      setComerciales(comercialesProp ?? []);
      setAsignacion(asignacionProp ?? null);
    }
  }, [controlado, comercialesProp, asignacionProp]);

  useEffect(() => {
    if (controlado) return;
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
        const actual =
          json.assignments?.find((item) => item.fincaReference === fincaReference) ?? null;
        setComerciales(json.comerciales ?? []);
        setAsignacion(actual);
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
  }, [controlado, fincaReference]);

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
      <AsignacionFincaSelect
        fincaReference={fincaReference}
        comerciales={comerciales}
        asignacion={asignacion}
        disabled={estado !== "idle"}
        onCambio={(siguiente) => {
          setAsignacion(siguiente);
          onCambio?.(siguiente);
        }}
      />
    </section>
  );
}
