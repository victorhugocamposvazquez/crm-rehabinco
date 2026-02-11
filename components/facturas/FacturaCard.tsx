"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type EstadoFactura = "borrador" | "emitida" | "pagada";

interface FacturaCardProps {
  id: string;
  numero: string;
  clienteNombre: string;
  importe: string;
  estado: EstadoFactura;
}

const estadoVariant: Record<EstadoFactura, "borrador" | "emitida" | "pagada"> = {
  borrador: "borrador",
  emitida: "emitida",
  pagada: "pagada",
};

export function FacturaCard({
  id,
  numero,
  clienteNombre,
  importe,
  estado,
}: FacturaCardProps) {
  return (
    <Link href={`/facturas/${id}`} className="block">
      <Card className="bg-white/95">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
            Factura
          </span>
          <Badge variant={estadoVariant[estado]}>
            {estado.charAt(0).toUpperCase() + estado.slice(1)}
          </Badge>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">{numero}</p>
            <p className="mt-1 truncate text-sm text-neutral-500">
              {clienteNombre}
            </p>
            <p className="mt-3 text-xl font-semibold tracking-tight">{importe}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
