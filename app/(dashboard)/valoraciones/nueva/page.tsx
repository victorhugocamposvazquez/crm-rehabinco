"use client";

import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ValoracionesNav } from "@/components/avm/ValoracionesNav";
import { NuevaValoracionWizard } from "@/components/avm/NuevaValoracionWizard";

export default function NuevaValoracionPage() {
  return (
    <div>
      <PageHeader title="Nueva valoración" />
      <ValoracionesNav actual="/valoraciones/nueva" />
      <Suspense fallback={<p className="text-[13px] text-[var(--text-3)]">Cargando…</p>}>
        <NuevaValoracionWizard />
      </Suspense>
    </div>
  );
}
