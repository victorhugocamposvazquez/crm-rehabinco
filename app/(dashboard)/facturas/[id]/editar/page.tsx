"use client";

import { useParams } from "next/navigation";
import { FacturaWizard } from "@/components/facturas/FacturaWizard";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export default function EditarFacturaPage() {
  const params = useParams();
  const id = params.id as string;

  return (
    <div className="animate-[fadeIn_0.3s_ease-out]">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/facturas/${id}`} aria-label="Volver a la factura">
            <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Editar factura
        </h1>
      </div>
      <FacturaWizard facturaId={id} />
    </div>
  );
}
