"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { MoreVertical, Pencil, FileText, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClienteCardProps {
  id: string;
  nombre: string;
  email?: string | null;
  telefono?: string | null;
  activo: boolean;
  onDeleted?: () => void;
}

export function ClienteCard({ id, nombre, email, telefono, activo, onDeleted }: ClienteCardProps) {
  const router = useRouter();
  const [actionsOpen, setActionsOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const closeActions = () => setActionsOpen(false);

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    closeActions();
    router.push(`/clientes/${id}/editar`);
  };

  const handleCreateFactura = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    closeActions();
    router.push(`/facturas/nueva?cliente=${id}&from=cliente`);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    closeActions();
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { error } = await supabase.from("clientes").delete().eq("id", id);
    setDeleting(false);
    setShowDeleteConfirm(false);
    if (!error) {
      onDeleted?.();
      router.refresh();
    }
  };

  return (
    <>
      <Card className="relative overflow-hidden bg-white/95 py-0">
        {/* Contenido principal */}
        <div className="relative flex items-center justify-between gap-4 py-4">
          <Link
            href={`/clientes/${id}`}
            className="min-w-0 flex-1"
            onClick={closeActions}
          >
            <p className="font-semibold text-foreground">{nombre}</p>
            {(email || telefono) && (
              <p className="truncate text-sm text-neutral-500">
                {email ?? telefono ?? "—"}
              </p>
            )}
          </Link>
          <Badge variant={activo ? "activo" : "inactivo"} className="shrink-0">
            {activo ? "Activo" : "Inactivo"}
          </Badge>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setActionsOpen((v) => !v);
            }}
            className="flex shrink-0 items-center justify-center rounded-full p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-foreground"
            aria-label="Abrir acciones"
            aria-expanded={actionsOpen}
          >
            <MoreVertical className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Overlay de acciones: aparece por encima con transición suave de derecha a izquierda */}
        <div
          className={cn(
            "absolute inset-y-0 right-0 z-10 flex items-stretch overflow-hidden transition-transform duration-300 ease-out",
            actionsOpen ? "translate-x-0" : "translate-x-full"
          )}
          aria-hidden={!actionsOpen}
        >
          <div
            className="absolute inset-0 bg-black/20"
            onClick={closeActions}
            aria-hidden
          />
          <div className="relative flex w-[180px] shrink-0 items-stretch rounded-l-xl border-l border-y border-border bg-white shadow-[-8px_0_24px_rgba(0,0,0,0.08)]">
            <button
              type="button"
              onClick={closeActions}
              className="absolute right-2 top-2 rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-foreground"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <div className="flex flex-1 flex-col justify-center gap-1 py-4 pr-10 pl-3">
              <button
                type="button"
                onClick={handleEdit}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-neutral-700 transition-colors hover:bg-blue-50 hover:text-blue-700"
                aria-label="Editar"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <Pencil className="h-4 w-4" strokeWidth={1.5} />
                </span>
                Editar
              </button>
              <button
                type="button"
                onClick={handleCreateFactura}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-neutral-700 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
                aria-label="Crear factura"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                  <FileText className="h-4 w-4" strokeWidth={1.5} />
                </span>
                Crear factura
              </button>
              <button
                type="button"
                onClick={handleDeleteClick}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-neutral-700 transition-colors hover:bg-red-50 hover:text-red-600"
                aria-label="Eliminar"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 text-red-600">
                  <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                </span>
                Borrar
              </button>
            </div>
          </div>
        </div>
      </Card>

      <AlertDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={`¿Eliminar ${nombre}?`}
        description="Esta acción no se puede deshacer."
        confirmLabel={deleting ? "Eliminando…" : "Eliminar"}
        onConfirm={handleDeleteConfirm}
        loading={deleting}
        variant="destructive"
      />
    </>
  );
}
