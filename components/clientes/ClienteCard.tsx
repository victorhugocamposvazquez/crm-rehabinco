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
      <Card className="bg-white/95 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4 sm:flex-nowrap">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">{nombre}</p>
            {(email || telefono) && (
              <p className="truncate text-sm text-neutral-500">
                {email ?? telefono ?? "—"}
              </p>
            )}
          </div>
          <Badge variant={activo ? "activo" : "inactivo"} className="shrink-0">
            {activo ? "Activo" : "Inactivo"}
          </Badge>
        </div>
      </Card>
    </Link>
  );
}
