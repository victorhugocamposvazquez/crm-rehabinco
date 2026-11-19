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
  const [pidiendo, setPidiendo] = useState(false);
  const [busy, setBusy] = useState<"aprobada" | "rectificar" | null>(null);
  const cerrada = estado === "aprobada" || estado === "rectificar";

  const enviar = async (decision: "aprobada" | "rectificar") => {
    const limpio = decision === "rectificar" ? texto.trim() : "";
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
    setPidiendo(false);
    toast.success(decision === "aprobada" ? "Diseño aprobado." : "Rectificación enviada.");
    router.refresh();
  };

  return (
    <section className="shrink-0 pt-2">
      {cerrada ? (
        <p className="mb-3 text-center text-[14px]">
          <span className="font-semibold">{etiquetaEstado(estado)}.</span>
          {motivo.trim() ? <span className="text-[var(--text-2)]"> {motivo.trim()}</span> : null}
        </p>
      ) : null}
      {puedeDecidir && pidiendo ? (
        <div>
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
            className="mt-2 w-full resize-none rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[16px] text-[var(--foreground)] outline-none"
          />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPidiendo(false)}
              disabled={busy !== null}
              className="h-14 rounded-2xl border border-[var(--border)] text-[16px] font-semibold disabled:opacity-50"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={() => enviar("rectificar")}
              disabled={busy !== null}
              className="h-14 rounded-2xl bg-[var(--foreground)] text-[16px] font-semibold text-[var(--background)] disabled:opacity-50"
            >
              {busy === "rectificar" ? "Enviando…" : "Enviar"}
            </button>
          </div>
        </div>
      ) : null}
      {puedeDecidir && !pidiendo ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => enviar("aprobada")}
            disabled={busy !== null}
            className="h-14 rounded-2xl bg-[var(--green)] text-[16px] font-semibold text-[var(--on-green)] disabled:opacity-50"
          >
            {busy === "aprobada" ? "Aprobando…" : "Aprobar"}
          </button>
          <button
            type="button"
            onClick={() => setPidiendo(true)}
            disabled={busy !== null}
            className="h-14 rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[16px] font-semibold disabled:opacity-50"
          >
            Rectificar
          </button>
        </div>
      ) : null}
    </section>
  );
}
