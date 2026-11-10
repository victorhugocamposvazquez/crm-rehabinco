"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import {
  activoDe,
  hrefsConPermisos,
  type FilaPermiso,
  type PermisoId,
} from "@/lib/auth/permisos";

type Valor = {
  filas: FilaPermiso[] | null;
  cargado: boolean;
  tiene: (id: PermisoId) => boolean;
  recargar: () => void;
};

const Ctx = createContext<Valor | null>(null);

export function PermisosProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [filas, setFilas] = useState<FilaPermiso[] | null>(null);
  const [cargado, setCargado] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user) {
      setFilas(null);
      setCargado(true);
      return;
    }
    let vivo = true;
    setCargado(false);
    const supabase = createClient();
    void supabase
      .from("role_permisos")
      .select("role, permiso, activo")
      .then(({ data, error }) => {
        if (!vivo) return;
        setFilas(error ? null : ((data ?? []) as FilaPermiso[]));
        setCargado(true);
      });
    return () => {
      vivo = false;
    };
  }, [user?.id, tick]);

  const valor = useMemo<Valor>(() => {
    const tiene = (id: PermisoId) => activoDe(user?.role ?? "comercial", id, filas);
    return { filas, cargado, tiene, recargar: () => setTick((n) => n + 1) };
  }, [filas, cargado, user?.role]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function usePermisos() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    return {
      filas: null as FilaPermiso[] | null,
      cargado: true,
      tiene: (_id: PermisoId) => false,
      recargar: () => undefined,
    };
  }
  return ctx;
}

export function useHrefsNav(variant: "desktop" | "mobile" | "top") {
  const { user } = useAuth();
  const { filas } = usePermisos();
  return hrefsConPermisos(user?.role, variant, filas);
}
