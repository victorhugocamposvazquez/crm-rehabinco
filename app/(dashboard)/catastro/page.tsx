import type { Metadata } from "next";
import { Suspense } from "react";
import { CatastroExplorerEntrada } from "@/components/catastro/CatastroExplorerEntrada";

export const metadata: Metadata = {
  title: "Catastro",
};

function BuscarFallback() {
  return (
    <div className="rounded-2xl border border-border bg-white px-5 py-10 text-center">
      <p className="text-sm text-neutral-500">Cargando…</p>
    </div>
  );
}

export default function CatastroExplorerPage() {
  return (
    <Suspense fallback={<BuscarFallback />}>
      <CatastroExplorerEntrada />
    </Suspense>
  );
}
