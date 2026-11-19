"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { etiquetaEstado } from "@/lib/estudio/revision";

export function DecisionRevision({
  id,
  estado,
  motivo,
  puedeDecidir,
}: {
  id: string;
  estado: string;
  motivo: string;
  puedeDecidir: boolean;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState(motivo);
  const [busy, setBusy] = useState<"aprobada" | "rectificar" | null>(null);
  const cerrada = estado === "aprobada" || estado === "rectificar";

  const enviar = async (decision: "aprobada" | "rectificar") => {
    const limpio = texto.trim();
    if (decision === "rectificar" && !limpio) {
      toast.error("Escribe el motivo de la rectificación.");
      return;
    }
    setBusy(decision);
    const respuesta = await fetch("/api/estudio/revision", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, decision, motivo: limpio }),
    });
    const data = (await respuesta.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    setBusy(null);
    if (!respuesta.ok || !data?.ok) {
      toast.error(data?.error || "No se ha podido guardar la decisión.");
      return;
    }
    toast.success(decision === "aprobada" ? "Diseño aprobado." : "Rectificación enviada.");
    router.refresh();
  };

  return (
    <section className="mt-8 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4">
      {cerrada ? (
        <p className="text-[14px]">
          <span className="font-semibold">{etiquetaEstado(estado)}.</span>
          {motivo.trim() ? <span className="text-[var(--text-2)]"> {motivo.trim()}</span> : null}
        </p>
      ) : (
        <p className="text-[14px] font-semibold">Pendiente de revisión</p>
      )}
      {puedeDecidir ? (
        <div className="mt-4">
          <label htmlFor="motivo-revision" className="text-[13px] font-semibold text-[var(--text-2)]">
            Motivo
          </label>
          <textarea
            id="motivo-revision"
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Indica qué hay que cambiar."
            className="mt-2 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[14px] text-[var(--foreground)] outline-none"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => enviar("aprobada")}
              disabled={busy !== null}
              className="h-10 rounded-lg bg-[var(--accent)] px-4 text-[14px] font-semibold text-[var(--accent-foreground)] disabled:opacity-50"
            >
              {busy === "aprobada" ? "Aprobando…" : "Aprobar"}
            </button>
            <button
              type="button"
              onClick={() => enviar("rectificar")}
              disabled={busy !== null}
              className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 text-[14px] font-semibold disabled:opacity-50"
            >
              {busy === "rectificar" ? "Enviando…" : "Rectificar"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
