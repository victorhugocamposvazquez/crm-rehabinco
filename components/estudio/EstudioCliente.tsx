"use client";

import { toast } from "sonner";
import { EstudioWizard, type EstudioReviewPayload, type EstudioSavePayload } from "@/components/estudio/EstudioWizard";
import { useAuth } from "@/lib/auth/auth-context";
import { isAdmin, isMarketing } from "@/lib/auth/roles";
import type { InmuebleEstudio } from "@/lib/estudio/data";
import type { Publication } from "@/lib/estudio/publicacion";

export function EstudioCliente({
  inmuebles,
  initialInmuebleId,
  agencia,
  inicial,
}: {
  inmuebles: InmuebleEstudio[];
  initialInmuebleId?: string;
  agencia: { telefono: string; web: string; cta: string };
  inicial?: Publication;
}) {
  const { user } = useAuth();
  const puedeRevisar = isMarketing(user?.role);
  const guardar = async (payload: EstudioSavePayload) => {
    const cuerpo = new FormData();
    cuerpo.set("propiedadId", payload.inmuebleId);
    cuerpo.set("estado", JSON.stringify(payload.state));
    cuerpo.set("texto", payload.caption);
    for (const [formato, blob] of Object.entries(payload.files)) {
      if (blob) cuerpo.set(`png_${formato}`, blob, `${formato}.png`);
    }
    payload.piezas.forEach((blob, i) => cuerpo.set(`png_pieza_${i}`, blob, `pieza-${i}.png`));
    const respuesta = await fetch("/api/estudio/guardar", { method: "POST", body: cuerpo });
    const data = (await respuesta.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!respuesta.ok || !data?.ok) {
      toast.error(data?.error || "No se ha podido guardar la creatividad.");
      throw new Error(data?.error || "No se ha podido guardar la creatividad.");
    }
    toast.success("Creatividad guardada en el inmueble.");
  };

  const revisar = async (payload: EstudioReviewPayload) => {
    const respuesta = await fetch("/api/estudio/revision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propiedadId: payload.inmuebleId, state: payload.state, nota: payload.nota }),
    });
    const data = (await respuesta.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!respuesta.ok || !data?.ok) {
      toast.error(data?.error || "No se ha podido enviar la revisión.");
      throw new Error(data?.error || "No se ha podido enviar la revisión.");
    }
    toast.success("Revisión enviada. Dirección recibe el aviso.");
  };

  return (
    <EstudioWizard
      inmuebles={inmuebles}
      initialInmuebleId={initialInmuebleId}
      agencia={agencia}
      puedeRevisar={puedeRevisar}
      veRevisiones={puedeRevisar || isAdmin(user?.role)}
      onSave={guardar}
      onReview={revisar}
      inicial={inicial}
    />
  );
}
