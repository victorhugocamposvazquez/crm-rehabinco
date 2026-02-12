"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { MoreVertical, Eye, Pencil, Trash2 } from "lucide-react";

interface PropiedadCardProps {
  id: string;
  titulo: string | null;
  direccion: string | null;
  localidad: string | null;
  tipo_operacion: string;
  precio_venta: number | null;
  precio_alquiler: number | null;
  estado: string;
  ofertanteNombre: string;
}

export function PropiedadCard({
  id,
  titulo,
  direccion,
  localidad,
  tipo_operacion,
  precio_venta,
  precio_alquiler,
  estado,
  ofertanteNombre,
}: PropiedadCardProps) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const closeActions = () => setActionsOpen(false);

  useEffect(() => {
    if (!actionsOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeActions();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [actionsOpen]);

  const handleViewDetail = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    closeActions();
    router.push(`/propiedades/${id}`);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    closeActions();
    router.push(`/propiedades/${id}/editar`);
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
    const { error } = await supabase.from("propiedades").delete().eq("id", id);
    setDeleting(false);
    setShowDeleteConfirm(false);
    if (!error) {
      router.refresh();
    }
  };

  const formatPrecio = (p: number | null) =>
    p != null
      ? p.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
      : "—";

  const subtitulo = [direccion, localidad].filter(Boolean).join(", ") || ofertanteNombre;
  const precio =
    (tipo_operacion === "venta" || tipo_operacion === "ambos") && precio_venta
      ? `Venta: ${formatPrecio(precio_venta)}`
      : (tipo_operacion === "alquiler" || tipo_operacion === "ambos") && precio_alquiler
        ? `Alq: ${formatPrecio(precio_alquiler)}/mes`
        : "";

  const cardRect = actionsOpen && cardRef.current ? cardRef.current.getBoundingClientRect() : null;

  return (
    <>
      <Card ref={cardRef} className={cn("relative overflow-visible bg-white/95 py-0", actionsOpen && "z-[200]")}>
        <div className="relative flex items-center justify-between gap-4 py-4">
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => actionsOpen && (e.preventDefault(), closeActions())}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && actionsOpen && (e.preventDefault(), closeActions())}
            className="min-w-0 flex-1 cursor-pointer"
          >
            <Link
              href={`/propiedades/${id}`}
              onClick={(e) => actionsOpen && e.preventDefault()}
              className="block"
            >
              <p className="font-semibold text-foreground">{titulo || direccion || "Sin título"}</p>
              <p className="truncate text-sm text-neutral-500">{subtitulo}</p>
              {precio && (
                <p className="mt-0.5 text-sm font-medium text-emerald-700">{precio}</p>
              )}
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <Badge variant="default">{estado}</Badge>
          </div>
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

        {actionsOpen &&
          typeof document !== "undefined" &&
          cardRect &&
          createPortal(
            <>
              <div
                className="fixed inset-0 z-[9998] bg-black/[0.04]"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  closeActions();
                }}
                aria-hidden
              />
              <div
                className="fixed z-[9999] flex flex-row items-center gap-0.5 rounded-l-lg border-l border-y border-border bg-white px-1.5 py-1 shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                style={{
                  top: cardRect.top + 4,
                  right: window.innerWidth - cardRect.right + 4,
                  height: cardRect.height - 8,
                  animation: "slideInFromRight 0.2s ease-out",
                }}
                role="dialog"
                aria-label="Acciones"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={handleViewDetail}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-blue-600 transition-colors hover:bg-blue-50"
                  aria-label="Ver detalle"
                >
                  <Eye className="h-4 w-4" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={handleEdit}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-600 transition-colors hover:bg-neutral-100"
                  aria-label="Editar"
                >
                  <Pencil className="h-4 w-4" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-red-600 transition-colors hover:bg-red-50"
                  aria-label="Eliminar"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
            </>,
            document.body
          )}
      </Card>

      <AlertDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="¿Eliminar esta propiedad?"
        description="Esta acción no se puede deshacer."
        confirmLabel={deleting ? "Eliminando…" : "Eliminar"}
        onConfirm={handleDeleteConfirm}
        loading={deleting}
        variant="destructive"
      />
    </>
  );
}
