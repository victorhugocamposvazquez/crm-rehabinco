"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ClienteCardProps {
  id: string;
  nombre: string;
  email?: string | null;
  telefono?: string | null;
  activo: boolean;
}

export function ClienteCard({ id, nombre, email, telefono, activo }: ClienteCardProps) {
  return (
    <Link href={`/clientes/${id}`} className="block">
      <Card className="cursor-pointer bg-white/95">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
            Cliente
          </span>
          <Badge variant={activo ? "activo" : "inactivo"}>
            {activo ? "Activo" : "Inactivo"}
          </Badge>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-semibold text-foreground">{nombre}</p>
            {(email || telefono) && (
              <p className="mt-1 truncate text-sm text-neutral-500">
                {email ?? telefono ?? "—"}
              </p>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
