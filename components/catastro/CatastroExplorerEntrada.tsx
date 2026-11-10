"use client";

import { useAuth } from "@/lib/auth/auth-context";
import { isCatastroUser, isComercial } from "@/lib/auth/roles";
import { BuscarInmuebles } from "./BuscarInmuebles";
import { FincasAsignadasComercial } from "./FincasAsignadasComercial";
import { EncargosPagina } from "@/components/captacion/EncargosPagina";

export function CatastroExplorerEntrada() {
  const { user, isLoading } = useAuth();

  if (isLoading || !user) {
    return (
      <div className="rounded-2xl border border-border bg-[var(--surface)] px-5 py-10 text-center">
        <p className="text-sm text-neutral-500">Cargando…</p>
      </div>
    );
  }

  if (isComercial(user.role)) {
    return <FincasAsignadasComercial />;
  }

  if (isCatastroUser(user.role)) {
    return (
      <div className="space-y-10">
        <EncargosPagina embebida />
        <BuscarInmuebles />
      </div>
    );
  }

  return <BuscarInmuebles />;
}
