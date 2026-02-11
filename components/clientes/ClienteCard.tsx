"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { MoreVertical, Eye, FileText, Trash2, X } from "lucide-react";

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

  useEffect(() => {
    if (!actionsOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [actionsOpen]);

  const handleViewDetail = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    closeActions();
    router.push(`/clientes/${id}`);
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
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
              if (actionsOpen) {
                e.preventDefault();
                closeActions();
              }
            }}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && actionsOpen) {
                e.preventDefault();
                closeActions();
              }
            }}
            className="min-w-0 flex-1 cursor-pointer"
          >
            <Link
              href={`/clientes/${id}`}
              onClick={(e) => actionsOpen && e.preventDefault()}
              className="block"
            >
            <p className="font-semibold text-foreground">{nombre}</p>
            {(email || telefono) && (
              <p className="truncate text-sm text-neutral-500">
                {email ?? telefono ?? "—"}
              </p>
            )}
            </Link>
          </div>
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

        {/* Overlay de acciones: renderizado en portal para evitar saltos del layout */}
        {actionsOpen &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              className="fixed inset-0 z-[200] flex justify-end"
              style={{ isolation: "isolate" }}
            >
              <div
                role="button"
                tabIndex={-1}
                className="absolute inset-0 bg-black/30"
                onClick={(e) => {
                  e.stopPropagation();
                  closeActions();
                }}
                onKeyDown={(e) => e.key === "Escape" && closeActions()}
                aria-hidden
              />
              <div
                className="relative flex w-[200px] shrink-0 flex-col rounded-l-xl border-l border-y border-border bg-white shadow-[-8px_0_24px_rgba(0,0,0,0.15)]"
                style={{ animation: "slideInFromRight 0.25s ease-out" }}
                role="dialog"
                aria-label="Acciones"
              >
                <button
                  type="button"
                  onClick={closeActions}
                  className="absolute right-2 top-2 rounded p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-foreground"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" strokeWidth={2} />
                </button>
                <div className="flex flex-col gap-0.5 py-4 pr-10 pl-3">
                  <button
                    type="button"
                    onClick={handleViewDetail}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-neutral-700 transition-colors hover:bg-blue-50 hover:text-blue-600"
                    aria-label="Ver detalle"
                  >
                    <Eye className="h-5 w-5 shrink-0 text-blue-600" strokeWidth={2} />
                    <span>Ver detalle</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateFactura}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-neutral-700 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                    aria-label="Crear factura"
                  >
                    <FileText className="h-5 w-5 shrink-0 text-emerald-600" strokeWidth={2} />
                    <span>Crear factura</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteClick}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-neutral-700 transition-colors hover:bg-red-50 hover:text-red-600"
                    aria-label="Eliminar"
                  >
                    <Trash2 className="h-5 w-5 shrink-0 text-red-600" strokeWidth={2} />
                    <span>Borrar</span>
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
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
