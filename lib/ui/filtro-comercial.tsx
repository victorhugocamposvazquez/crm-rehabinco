"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type Ctx = { comercialId: string; setComercialId: (id: string) => void };

const FiltroComercialContext = createContext<Ctx | null>(null);

export function FiltroComercialProvider({ children }: { children: ReactNode }) {
  const [comercialId, setComercialId] = useState("");
  const value = useMemo(() => ({ comercialId, setComercialId }), [comercialId]);
  return <FiltroComercialContext.Provider value={value}>{children}</FiltroComercialContext.Provider>;
}

export function useFiltroComercial() {
  const ctx = useContext(FiltroComercialContext);
  if (!ctx) return { comercialId: "", setComercialId: (_id: string) => undefined };
  return ctx;
}
