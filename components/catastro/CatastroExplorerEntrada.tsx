"use client";

import { useAuth } from "@/lib/auth/auth-context";
import { isComercial } from "@/lib/auth/roles";
import { BuscarInmuebles } from "./BuscarInmuebles";
import { FincasAsignadasComercial } from "./FincasAsignadasComercial";

export function CatastroExplorerEntrada() {
  const { user, isLoading } = useAuth();

  if (isLoading || !user) {
    return (
      <div className="rounded-2xl border border-border bg-white px-5 py-10 text-center">
        <p className="text-sm text-neutral-500">Cargando…</p>
      </div>
    );
  }

  if (isComercial(user.role)) {
    return <FincasAsignadasComercial />;
  }

  return <BuscarInmuebles />;
}
