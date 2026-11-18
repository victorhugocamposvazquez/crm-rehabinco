"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export function MarcarRevisionVista({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const marcar = async () => {
    setBusy(true);
    const respuesta = await fetch("/api/estudio/revision", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = (await respuesta.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    setBusy(false);
    if (!respuesta.ok || !data?.ok) {
      toast.error(data?.error || "No se ha podido marcar.");
      return;
    }
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={marcar}
      disabled={busy}
      className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] font-semibold text-[var(--foreground)] disabled:opacity-50"
    >
      {busy ? "Marcando…" : "Marcar como vista"}
    </button>
  );
}
