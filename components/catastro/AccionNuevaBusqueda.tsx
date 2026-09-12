"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RUTA_NUEVA_BUSQUEDA } from "@/lib/catastro/explorer/history-ui";

export function AccionNuevaBusqueda({ size = "default" }: { size?: "default" | "sm" }) {
  return (
    <Button asChild size={size}>
      <Link href={RUTA_NUEVA_BUSQUEDA} className="gap-2">
        <Plus className="h-4 w-4" aria-hidden />
        Nueva búsqueda
      </Link>
    </Button>
  );
}
