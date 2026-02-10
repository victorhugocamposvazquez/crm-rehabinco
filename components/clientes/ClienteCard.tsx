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
    <Link href={`/clientes/${id}`} className="block transition-opacity hover:opacity-90">
      <Card className="cursor-pointer">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-medium text-foreground">{nombre}</p>
            {(email || telefono) && (
              <p className="mt-0.5 truncate text-sm text-neutral-500">
                {email ?? telefono ?? "—"}
              </p>
            )}
          </div>
          <Badge variant={activo ? "activo" : "inactivo"}>
            {activo ? "Activo" : "Inactivo"}
          </Badge>
        </div>
      </Card>
    </Link>
  );
}
