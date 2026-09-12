"use client";

import { AlertDialog } from "@/components/ui/alert-dialog";
import {
  TEXTO_CONFIRMAR_ELIMINAR,
  TEXTO_CONFIRMAR_ELIMINAR_TITULO,
} from "@/lib/catastro/explorer/history-ui";

export function ConfirmacionEliminarBusqueda({
  abierta,
  cargando,
  onCancelar,
  onConfirmar,
}: {
  abierta: boolean;
  cargando?: boolean;
  onCancelar: () => void;
  onConfirmar: () => void | Promise<void>;
}) {
  return (
    <AlertDialog
      open={abierta}
      onOpenChange={(open) => {
        if (!open) onCancelar();
      }}
      title={TEXTO_CONFIRMAR_ELIMINAR_TITULO}
      description={TEXTO_CONFIRMAR_ELIMINAR}
      confirmLabel="Eliminar"
      cancelLabel="Cancelar"
      variant="destructive"
      loading={cargando}
      onConfirm={onConfirmar}
    />
  );
}
