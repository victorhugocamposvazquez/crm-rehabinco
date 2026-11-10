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
        onSuccess({ id, nombre: extra?.nombre ?? nombreInicial?.trim() || "Cliente", telefono: extra?.telefono ?? null });
      }}
    />
  );
}
