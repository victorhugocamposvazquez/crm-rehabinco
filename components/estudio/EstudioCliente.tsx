"use client";

import { toast } from "sonner";
import { EstudioWizard, type EstudioSavePayload } from "@/components/estudio/EstudioWizard";
import type { InmuebleEstudio } from "@/lib/estudio/data";

export function EstudioCliente({
  inmuebles,
  initialInmuebleId,
  agencia,
}: {
  inmuebles: InmuebleEstudio[];
  initialInmuebleId?: string;
  agencia: { telefono: string; web: string; cta: string };
}) {
  const guardar = async (payload: EstudioSavePayload) => {
    const cuerpo = new FormData();
    cuerpo.set("propiedadId", payload.inmuebleId);
    cuerpo.set("estado", JSON.stringify(payload.state));
    cuerpo.set("texto", payload.caption);
    for (const [formato, blob] of Object.entries(payload.files)) {
      if (blob) cuerpo.set(`png_${formato}`, blob, `${formato}.png`);
    }
    const respuesta = await fetch("/api/estudio/guardar", { method: "POST", body: cuerpo });
    const data = (await respuesta.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!respuesta.ok || !data?.ok) {
      toast.error(data?.error || "No se ha podido guardar la creatividad.");
      return;
    }
    toast.success("Creatividad guardada en el inmueble.");
  };

  return <EstudioWizard inmuebles={inmuebles} initialInmuebleId={initialInmuebleId} agencia={agencia} onSave={guardar} />;
}
