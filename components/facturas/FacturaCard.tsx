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
      <Card className="bg-white/95 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4 sm:flex-nowrap">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">{numero}</p>
            <p className="truncate text-sm text-neutral-500">{clienteNombre}</p>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <p className="text-lg font-semibold tracking-tight">{importe}</p>
            <Badge variant={estadoVariant[estado]}>
              {estado.charAt(0).toUpperCase() + estado.slice(1)}
            </Badge>
          </div>
        </div>
      </Card>
    </Link>
  );
}
