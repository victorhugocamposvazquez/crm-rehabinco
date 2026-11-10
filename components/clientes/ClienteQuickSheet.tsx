"use client";

import { NuevoClientePanel } from "@/components/clientes/NuevoClientePanel";

export interface ClienteQuickData {
  id: string;
  nombre: string;
  telefono?: string | null;
}

interface ClienteQuickSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (cliente: ClienteQuickData) => void;
  nombreInicial?: string;
}

export function ClienteQuickSheet({
  open,
  onOpenChange,
  onSuccess,
  nombreInicial,
}: ClienteQuickSheetProps) {
  return (
    <NuevoClientePanel
      open={open}
      onOpenChange={onOpenChange}
      elevated
      ambito="quick"
      nombreInicial={nombreInicial}
      onCreado={(id, extra) => {
        const nombre = (extra?.nombre ?? nombreInicial?.trim()) || "Cliente";
        onSuccess({ id, nombre, telefono: extra?.telefono ?? null });
      }}
    />
  );
}
