"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { MoreVertical, Pencil, FileText, Trash2 } from "lucide-react";

interface ClienteCardProps {
  id: string;
  nombre: string;
  email?: string | null;
  telefono?: string | null;
  activo: boolean;
  onDeleted?: () => void;
}

const SWIPE_THRESHOLD = 60;
const ACTION_WIDTH = 140;

export function ClienteCard({ id, nombre, email, telefono, activo, onDeleted }: ClienteCardProps) {
  const router = useRouter();
  const [dragX, setDragX] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const startX = useRef(0);
  const startDragX = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startDragX.current = dragX;
  }, [dragX]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const delta = e.touches[0].clientX - startX.current;
    const next = startDragX.current + delta;
    setDragX(Math.min(0, Math.max(-ACTION_WIDTH, next)));
  }, []);

  const handleTouchEnd = useCallback(() => {
    setDragX((prev) => (prev < -SWIPE_THRESHOLD ? -ACTION_WIDTH : 0));
  }, []);

  const toggleReveal = useCallback(() => {
    setDragX((prev) => (prev < -SWIPE_THRESHOLD ? 0 : -ACTION_WIDTH));
  }, []);

  const resetReveal = useCallback(() => {
    setDragX(0);
  }, []);

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resetReveal();
    router.push(`/clientes/${id}/editar`);
  };

  const handleCreateFactura = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resetReveal();
    router.push(`/facturas/nueva?cliente=${id}`);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resetReveal();
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
      <Card className="overflow-hidden bg-white/95 py-0">
        <div className="relative flex">
          {/* Acciones (swipe de derecha a izquierda) */}
          <div
            className="absolute right-0 top-0 flex h-full shrink-0 items-stretch"
            style={{ width: ACTION_WIDTH }}
          >
            <button
              type="button"
              onClick={handleEdit}
              className="flex flex-1 items-center justify-center gap-1 bg-blue-100 text-blue-700 transition-colors active:bg-blue-200"
              aria-label="Editar"
            >
              <Pencil className="h-4 w-4" strokeWidth={1.5} />
              <span className="text-xs font-medium">Editar</span>
            </button>
            <button
              type="button"
              onClick={handleCreateFactura}
              className="flex flex-1 items-center justify-center gap-1 bg-emerald-100 text-emerald-700 transition-colors active:bg-emerald-200"
              aria-label="Crear factura"
            >
              <FileText className="h-4 w-4" strokeWidth={1.5} />
              <span className="text-xs font-medium">Factura</span>
            </button>
            <button
              type="button"
              onClick={handleDeleteClick}
              className="flex flex-1 items-center justify-center gap-1 bg-red-100 text-red-700 transition-colors active:bg-red-200"
              aria-label="Eliminar"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
              <span className="text-xs font-medium">Borrar</span>
            </button>
          </div>

          {/* Contenido principal (swipeable) */}
          <div
            className="relative flex min-w-full shrink-0 items-center justify-between gap-4 bg-white py-4 transition-transform duration-200 ease-out sm:flex-nowrap"
            style={{ transform: `translateX(${dragX}px)` }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <Link
              href={`/clientes/${id}`}
              className="min-w-0 flex-1"
              onClick={resetReveal}
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
                toggleReveal();
              }}
              className="flex shrink-0 items-center justify-center rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-foreground"
              aria-label="Abrir acciones"
            >
              <MoreVertical className="h-5 w-5" strokeWidth={1.5} />
            </button>
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
