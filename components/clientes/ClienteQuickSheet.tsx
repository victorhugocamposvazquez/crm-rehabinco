"use client";

import { NuevoClientePanel } from "@/components/clientes/NuevoClientePanel";

export interface ClienteQuickData {
  id: string;
  nombre: string;
}

interface ClienteQuickSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (cliente: ClienteQuickData) => void;
}

export function ClienteQuickSheet({
  open,
  onOpenChange,
  onSuccess,
}: ClienteQuickSheetProps) {
  return (
    <NuevoClientePanel
      open={open}
      onOpenChange={onOpenChange}
      elevated
      ambito="quick"
      onCreado={(id, extra) => {
        onSuccess({ id, nombre: extra?.nombre ?? "Cliente" });
      }}
    />
  );
}
