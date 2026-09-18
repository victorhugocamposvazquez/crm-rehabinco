"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListChecks, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { eliminarDocumentos } from "@/lib/actions/papelera";
import { useAuth } from "@/lib/auth/auth-context";
import { isSuperAdmin } from "@/lib/auth/roles";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Fab } from "@/components/ui/fab";
import { listarPersonasArras, parsePersonasArras } from "@/lib/contrato-arras";
import { useHayAltaBorrador } from "@/lib/ui/use-alta-borrador";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  fecha: string | null;
  estado: "borrador" | "cerrado";
  finca_descripcion: string | null;
  precio: number | null;
  arras: number | null;
  compradores: unknown;
  vendedores: unknown;
};

export default function ContratosArrasPage() {
  const { user } = useAuth();
  const superadmin = isSuperAdmin(user?.role);
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const hayBorrador = useHayAltaBorrador("arras");

  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("contratos_arras")
      .select("id, fecha, estado, finca_descripcion, precio, arras, compradores, vendedores")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setRows((data ?? []) as Row[]);
        setLoading(false);
      });
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelectId = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkDeleting(true);
    const result = await eliminarDocumentos("contrato_arras", ids);
    setBulkDeleting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setRows((prev) => prev.filter((r) => !ids.includes(r.id)));
    exitSelectionMode();
    setBulkDeleteOpen(false);
    toast.success(result.message ?? (ids.length === 1 ? "1 contrato eliminado" : `${ids.length} contratos eliminados`));
    router.refresh();
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Herramientas", href: "/herramientas" },
          { label: "Contratos de arras" },
        ]}
        title="Contratos de arras"
        description="Histórico de contratos. Cada uno se rellena en el CRM y se descarga en PDF."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {!loading && rows.length > 0 ? (
              <Button
                type="button"
                variant={selectionMode ? "default" : "secondary"}
                size="sm"
                onClick={() => (selectionMode ? exitSelectionMode() : setSelectionMode(true))}
                className="gap-2"
              >
                <ListChecks className="h-4 w-4" strokeWidth={1.5} />
                {selectionMode ? "Cancelar selección" : "Seleccionar"}
              </Button>
            ) : null}
            <Button asChild size="sm" className="hidden min-[820px]:inline-flex">
              <Link href="/contratos-arras/nuevo" className="gap-2">
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                {hayBorrador ? "Continuar borrador" : "Nuevo contrato"}
              </Link>
            </Button>
          </div>
        }
      />

      {!loading && rows.length > 0 && selectionMode ? (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border bg-[var(--surface-soft)] p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--text-2)]">
            <span className="font-medium text-foreground">{selectedIds.size}</span> seleccionado
            {selectedIds.size !== 1 ? "s" : ""}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setSelectedIds(new Set(rows.map((r) => r.id)))}
              disabled={rows.length === 0}
            >
              Seleccionar todos
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setSelectedIds(new Set())} disabled={selectedIds.size === 0}>
              Quitar selección
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setBulkDeleteOpen(true)}
              disabled={selectedIds.size === 0}
              className="gap-1.5 border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
              Eliminar
            </Button>
          </div>
        </div>
      ) : null}

      <section className="mt-5 overflow-hidden rounded-[14px] border border-border bg-white">
        {loading ? (
          <p className="px-4 py-8 text-center text-[12.5px] text-[var(--text-2)]">Cargando…</p>
        ) : rows.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[13.5px] text-[var(--text-2)]">Aún no hay contratos de arras.</p>
            <Button asChild size="sm" className="mt-4">
              <Link href="/contratos-arras/nuevo">Nuevo contrato</Link>
            </Button>
          </div>
        ) : (
          rows.map((row) => {
            const compradores = listarPersonasArras(parsePersonasArras(row.compradores));
            const contenido = (
              <>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold">{compradores || "Compradores pendientes"}</div>
                  <div className="mt-0.5 truncate text-[12px] text-[var(--text-2)]">
                    {[row.finca_descripcion, row.fecha, row.precio != null ? `${row.precio.toLocaleString("es-ES")} €` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <span className="text-[12.5px] text-[var(--text-2)]">{row.estado === "cerrado" ? "Cerrado" : "Borrador"}</span>
              </>
            );
            return selectionMode ? (
              <label
                key={row.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 border-b border-[var(--border-row)] px-4 py-2.5 hover:bg-[var(--surface-soft)]",
                  selectedIds.has(row.id) && "bg-[var(--row-active)]"
                )}
              >
                <input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => toggleSelectId(row.id)} />
                {contenido}
              </label>
            ) : (
              <Link
                key={row.id}
                href={`/contratos-arras/${row.id}`}
                className="flex items-center gap-3 border-b border-[var(--border-row)] px-4 py-2.5 hover:bg-[var(--surface-soft)]"
              >
                {contenido}
              </Link>
            );
          })
        )}
      </section>

      <AlertDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`¿Eliminar ${selectedIds.size} contrato${selectedIds.size !== 1 ? "s" : ""}?`}
        description={
          superadmin
            ? "Se borrarán de forma permanente."
            : "Irán a la papelera del superadministrador para confirmar el borrado definitivo."
        }
        confirmLabel={bulkDeleting ? "Eliminando…" : superadmin ? "Eliminar definitivamente" : "Enviar a papelera"}
        onConfirm={() => void handleBulkDelete()}
        loading={bulkDeleting}
        variant="destructive"
      />

      <Fab href="/contratos-arras/nuevo" label={hayBorrador ? "Continuar borrador" : "Nuevo contrato"} />
    </div>
  );
}
