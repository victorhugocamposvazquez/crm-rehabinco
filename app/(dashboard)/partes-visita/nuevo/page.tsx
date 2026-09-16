"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ParteVisitaEditor } from "@/components/partes-visita/ParteVisitaEditor";

function NuevoParteInner() {
  const search = useSearchParams();
  return (
    <ParteVisitaEditor
      propiedadIdInicial={search.get("propiedad") ?? undefined}
      citaIdInicial={search.get("cita") ?? undefined}
    />
  );
}

export default function NuevoPartePage() {
  return (
    <Suspense>
      <NuevoParteInner />
    </Suspense>
  );
}
