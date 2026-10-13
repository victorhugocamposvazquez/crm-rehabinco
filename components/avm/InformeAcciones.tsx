"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { InformePdfMenu } from "@/components/avm/InformePdfMenu";

export function InformeAcciones({ className, valuationId }: { className?: string; valuationId?: string }) {
  return (
    <div className={`flex flex-wrap gap-2 print:hidden ${className ?? ""}`} data-testid="informe-acciones">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() =>
          toast.message("Marcar zona", {
            description: "La marca se guarda con fecha, motivo y evidencia; solo avisa, no cambia el precio. Disponible en fase 2.",
          })
        }
      >
        Marcar zona
      </Button>
      {valuationId ? <InformePdfMenu valuationId={valuationId} /> : null}
      <Button
        type="button"
        size="sm"
        onClick={() =>
          toast.message("Enviar al propietario", {
            description: "Se enviará la versión para propietario con la marca de la agencia (fase 2).",
          })
        }
      >
        Enviar al propietario
      </Button>
    </div>
  );
}
