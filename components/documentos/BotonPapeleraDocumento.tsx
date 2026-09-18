"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { eliminarDocumentos } from "@/lib/actions/papelera";
import { useAuth } from "@/lib/auth/auth-context";
import { isSuperAdmin } from "@/lib/auth/roles";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type TipoDocumentoPapelera = "parte_visita" | "contrato_arras";

export function BotonPapeleraDocumento({
  id,
  tipo,
  onEliminado,
  className,
}: {
  id: string;
  tipo: TipoDocumentoPapelera;
  onEliminado?: (id: string) => void;
  className?: string;
}) {
  const { user } = useAuth();
  const superadmin = isSuperAdmin(user?.role);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const etiqueta = tipo === "parte_visita" ? "parte de visita" : "contrato de arras";

  const confirmar = async () => {
    setLoading(true);
    const result = await eliminarDocumentos(tipo, [id]);
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setOpen(false);
    onEliminado?.(id);
    toast.success(result.message ?? "Enviado a la papelera.");
  };

  return (
    <>
      <button
        type="button"
        aria-label={`Eliminar ${etiqueta}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--text-3)] hover:bg-red-50 hover:text-red-600",
          className
        )}
      >
        <Trash2 className="h-4 w-4" strokeWidth={1.5} />
      </button>
      <AlertDialog
        open={open}
        onOpenChange={setOpen}
        title={`¿Eliminar este ${etiqueta}?`}
        description={
          superadmin
            ? "Se borrará de forma permanente."
            : "Irá a la papelera del superadministrador para confirmar el borrado definitivo."
        }
        confirmLabel={loading ? "Eliminando…" : superadmin ? "Eliminar" : "Enviar a papelera"}
        onConfirm={() => void confirmar()}
        loading={loading}
        variant="destructive"
      />
    </>
  );
}
