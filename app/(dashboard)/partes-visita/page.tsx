"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { eliminarDocumentos } from "@/lib/actions/papelera";
import { useAuth } from "@/lib/auth/auth-context";
import { isSuperAdmin } from "@/lib/auth/roles";
import { PageHeader } from "@/components/layout/PageHeader";
import { Fab } from "@/components/ui/fab";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { ListChecks, Plus, Trash2 } from "lucide-react";
import { AgendaVisitas } from "@/components/citas/AgendaVisitas";
import { ESTADO_PARTE_LABELS, buildPublicFirmaUrl } from "@/lib/partes-visita";
import { colorEstado } from "@/lib/ui/estados-vista";
import { extraAlta } from "@/lib/ui/alta-panel";
import { useHayAltaBorrador } from "@/lib/ui/use-alta-borrador";
import { cn } from "@/lib/utils";

type ParteRow = {
  id: string;
  visitante_nombre: string | null;
  inmueble_direccion: string | null;
  fecha_visita: string | null;
  hora_visita: string | null;
  estado: "borrador" | "pendiente_firma" | "firmado";
  agente_nombre: string | null;
  token: string | null;
};

export default function PartesVisitaPage() {
  const { user } = useAuth();
  const superadmin = isSuperAdmin(user?.role);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [filterEstado, setFilterEstado] = useState<"todos" | ParteRow["estado"]>("todos");
  const [partes, setPartes] = useState<ParteRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const hayBorrador = useHayAltaBorrador("parte");

  useEffect(() => {
    const extra = extraAlta(searchParams);
    if (!extra) return;
    const q = extra.toString();
    router.replace(q ? `/partes-visita/nuevo?${q}` : "/partes-visita/nuevo");
  }, [searchParams, router]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("partes_visita")
      .select("id, visitante_nombre, inmueble_direccion, fecha_visita, hora_visita, estado, agente_nombre, token")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message);
          setPartes([]);
        } else {
          setPartes((data ?? []) as ParteRow[]);
        }
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    return partes.filter((p) => filterEstado === "todos" || p.estado === filterEstado);
  }, [partes, filterEstado]);

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
    const result = await eliminarDocumentos("parte_visita", ids);
    setBulkDeleting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setPartes((prev) => prev.filter((p) => !ids.includes(p.id)));
    exitSelectionMode();
    setBulkDeleteOpen(false);
    toast.success(result.message ?? (ids.length === 1 ? "1 parte eliminado" : `${ids.length} partes eliminados`));
    router.refresh();
  };

  const copiarFirma = async (token: string) => {
    try {
      await navigator.clipboard.writeText(buildPublicFirmaUrl(token));
      toast.success("Enlace de firma copiado.");
    } catch {
      toast.error("No se ha podido copiar el enlace.");
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Herramientas", href: "/herramientas" },
          { label: "Visitas" },
        ]}
        title="Visitas"
        description="La agenda es la cita. El parte es el PDF que se rellena y firma."
        actions={
          <div className="flex flex-wrap gap-2">
            {!loading && partes.length > 0 ? (
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
            <Button asChild size="sm" variant="secondary">
              <Link href="/calendario">Concertar visita</Link>
            </Button>
            <Button asChild size="sm" className="hidden min-[820px]:inline-flex">
              <Link href="/partes-visita/nuevo" className="gap-2">
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                {hayBorrador ? "Continuar borrador" : "Nuevo parte"}
              </Link>
            </Button>
          </div>
        }
      />

      <div className="mt-5 flex flex-wrap items-start gap-4">
        <section className="min-w-0 flex-[1_1_380px] overflow-hidden rounded-[14px] border border-border bg-white">
          <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-4 py-3">
            <h2 className="text-[15px] font-semibold">Próximas visitas</h2>
            <span className="text-[12px] text-[var(--text-2)]">Esta semana</span>
          </div>
          <div className="px-0">
            <AgendaVisitas compact />
          </div>
        </section>

        <section className="min-w-0 flex-[1_1_420px] overflow-hidden rounded-[14px] border border-border bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-soft)] px-4 py-3">
            <h2 className="flex-1 text-[15px] font-semibold">Partes</h2>
            {(["todos", "pendiente_firma", "firmado", "borrador"] as const).map((e) => (
              <Chip key={e} active={filterEstado === e} onClick={() => setFilterEstado(e)}>
                {e === "todos" ? "Todos" : ESTADO_PARTE_LABELS[e]}
              </Chip>
            ))}
          </div>

          {!loading && partes.length > 0 && selectionMode ? (
            <div className="flex flex-col gap-2 border-b border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[var(--text-2)]">
                <span className="font-medium text-foreground">{selectedIds.size}</span> seleccionado
                {selectedIds.size !== 1 ? "s" : ""}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedIds(new Set(filtered.map((p) => p.id)))}
                  disabled={filtered.length === 0}
                >
                  Seleccionar visibles
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

          {error ? <p className="mx-4 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          {loading ? (
            <p className="px-4 py-8 text-center text-[12.5px] text-[var(--text-2)]">Cargando partes…</p>
          ) : filtered.length === 0 ? (
            <div>
              <p className="px-4 py-9 text-center text-[13.5px] text-[var(--text-2)]">
                {partes.length === 0 ? "Aún no hay partes de visita." : "No hay resultados con ese filtro."}
              </p>
              {partes.length === 0 ? (
                <div className="flex justify-center pb-6">
                  <Button asChild size="sm">
                    <Link href="/partes-visita/nuevo" className="gap-2">
                      <Plus className="h-4 w-4" strokeWidth={1.5} />
                      {hayBorrador ? "Continuar borrador" : "Nuevo parte"}
                    </Link>
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            filtered.map((p) => (
              <div
                key={p.id}
                className={cn(
                  "flex items-center gap-3 border-b border-[var(--border-row)] px-4 py-2.5 hover:bg-[var(--surface-soft)]",
                  selectionMode && selectedIds.has(p.id) && "bg-[var(--row-active)]"
                )}
              >
                {selectionMode ? (
                  <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelectId(p.id)} />
                ) : null}
                <Link href={`/partes-visita/${p.id}`} className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold">{p.visitante_nombre || "Visitante"}</div>
                  <div className="mt-0.5 truncate text-[12px] text-[var(--text-2)]">
                    {[p.inmueble_direccion, p.fecha_visita].filter(Boolean).join(" · ")}
                  </div>
                </Link>
                <div className="flex items-center gap-1.5 whitespace-nowrap text-[12.5px]" style={{ color: colorEstado(p.estado) }}>
                  <span className="h-[7px] w-[7px] rounded-full" style={{ background: colorEstado(p.estado) }} />
                  {ESTADO_PARTE_LABELS[p.estado]}
                </div>
                {!selectionMode && p.estado === "pendiente_firma" && p.token ? (
                  <button
                    type="button"
                    onClick={() => void copiarFirma(p.token!)}
                    className="h-[30px] whitespace-nowrap rounded-lg bg-accent px-2.5 text-[12px] font-semibold text-white hover:bg-accent-dark"
                  >
                    Enlace de firma
                  </button>
                ) : null}
              </div>
            ))
          )}
        </section>
      </div>

      <AlertDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`¿Eliminar ${selectedIds.size} parte${selectedIds.size !== 1 ? "s" : ""}?`}
        description={
          superadmin
            ? "Se borrarán de forma permanente, incluidas las firmas."
            : "Irán a la papelera del superadministrador para confirmar el borrado definitivo."
        }
        confirmLabel={bulkDeleting ? "Eliminando…" : superadmin ? "Eliminar definitivamente" : "Enviar a papelera"}
        onConfirm={() => void handleBulkDelete()}
        loading={bulkDeleting}
        variant="destructive"
      />

      <Fab href="/partes-visita/nuevo" label={hayBorrador ? "Continuar borrador" : "Nuevo parte"} />
    </div>
  );
}
