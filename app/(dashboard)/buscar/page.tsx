import type { Metadata } from "next";
import { Suspense } from "react";
import { BuscarInmuebles } from "@/components/catastro/BuscarInmuebles";

export const metadata: Metadata = {
  title: "Nueva búsqueda · Catastro Explorer",
};

function BuscarFallback() {
  return (
    <div className="rounded-2xl border border-border bg-white px-5 py-10 text-center">
      <p className="text-sm text-neutral-500">Cargando búsqueda…</p>
    </div>
  );
}

export default function BuscarPage() {
  return (
    <Suspense fallback={<BuscarFallback />}>
      <BuscarInmuebles />
    </Suspense>
  );
}
