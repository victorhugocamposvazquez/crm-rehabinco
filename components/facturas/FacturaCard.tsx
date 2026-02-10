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
    <Link href={`/facturas/${id}`} className="block transition-opacity hover:opacity-90">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">{numero}</p>
            <p className="mt-0.5 truncate text-sm text-neutral-500">
              {clienteNombre}
            </p>
            <p className="mt-1 text-base font-semibold">{importe}</p>
          </div>
          <Badge variant={estadoVariant[estado]}>
            {estado.charAt(0).toUpperCase() + estado.slice(1)}
          </Badge>
        </div>
      </Card>
    </Link>
  );
}
