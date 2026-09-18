"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardPenLine, FileSignature, ListChecks, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { eliminarDocumentos } from "@/lib/actions/papelera";
import { useAuth } from "@/lib/auth/auth-context";
import { isAdmin, isSuperAdmin } from "@/lib/auth/roles";
import { relacionUno } from "@/lib/citas/citas";
import { PageHeader } from "@/components/layout/PageHeader";
import { CreadorDocumento } from "@/components/documentos/CreadorDocumento";
import { Button } from "@/components/ui/button";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { ESTADO_PARTE_LABELS } from "@/lib/partes-visita";
import { colorEstado } from "@/lib/ui/estados-vista";
import { useHayAltaBorrador } from "@/lib/ui/use-alta-borrador";
import { cn } from "@/lib/utils";

type ParteRow = {
  id: string;
  user_id: string;
  comercial_id: string | null;
  visitante_nombre: string | null;
  inmueble_direccion: string | null;
  fecha_visita: string | null;
  estado: "borrador" | "pendiente_firma" | "firmado";
  creador?: { nombre_completo?: string | null; color?: string | null; email?: string | null } | null;
};

type ArrasRow = {
  id: string;
  user_id: string;
  comercial_id: string | null;
  fecha: string | null;
  estado: "borrador" | "cerrado";
  finca_descripcion: string | null;
  compradores: unknown;
  vendedores: unknown;
  creador?: { nombre_completo?: string | null; color?: string | null; email?: string | null } | null;
};

function nombrePersona(raw: unknown): string {
  if (!Array.isArray(raw) || raw.length === 0) return "";
  const first = raw[0];
  if (!first || typeof first !== "object") return "";
  return String((first as { nombre?: string }).nombre ?? "").trim();
}

export default function HerramientasPage() {
  const { user } = useAuth();
  const router = useRouter();
  const admin = isAdmin(user?.role);
  const superadmin = isSuperAdmin(user?.role);
  const [partes, setPartes] = useState<ParteRow[]>([]);
  const [arras, setArras] = useState<ArrasRow[]>([]);
  const [loading, setLoading] = useState(true);
  const hayParte = useHayAltaBorrador("parte");
  const hayArras = useHayAltaBorrador("arras");

  const [selPartes, setSelPartes] = useState(false);
  const [selArras, setSelArras] = useState(false);
  const [idsPartes, setIdsPartes] = useState<Set<string>>(() => new Set());
  const [idsArras, setIdsArras] = useState<Set<string>>(() => new Set());
  const [deleteTarget, setDeleteTarget] = useState<"parte" | "arras" | null>(null);
  const [deleting, setDeleting] = useState(false);

  const cargar = useCallback(() => {
    const supabase = createClient();
    void Promise.all([
      supabase
        .from("partes_visita")
        .select(
          "id, user_id, comercial_id, visitante_nombre, inmueble_direccion, fecha_visita, estado, creador:comercial_id(nombre_completo, color, email)"
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("contratos_arras")
        .select(
          "id, user_id, comercial_id, fecha, estado, finca_descripcion, compradores, vendedores, creador:comercial_id(nombre_completo, color, email)"
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(8),
    ]).then(([p, a]) => {
      setPartes(
        ((p.data ?? []) as Array<ParteRow & { creador?: ParteRow["creador"] | ParteRow["creador"][] }>).map((row) => ({
          ...row,
          creador: relacionUno(row.creador),
        }))
      );
      setArras(
        ((a.data ?? []) as Array<ArrasRow & { creador?: ArrasRow["creador"] | ArrasRow["creador"][] }>).map((row) => ({
          ...row,
          creador: relacionUno(row.creador),
        }))
      );
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const toggleId = (tipo: "parte" | "arras", id: string) => {
    const setter = tipo === "parte" ? setIdsPartes : setIdsArras;
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelPartes = () => {
    setSelPartes(false);
    setIdsPartes(new Set());
  };

  const exitSelArras = () => {
    setSelArras(false);
    setIdsArras(new Set());
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const ids = deleteTarget === "parte" ? [...idsPartes] : [...idsArras];
    if (ids.length === 0) return;
    setDeleting(true);
    const result = await eliminarDocumentos(deleteTarget === "parte" ? "parte_visita" : "contrato_arras", ids);
    setDeleting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (deleteTarget === "parte") {
      setPartes((prev) => prev.filter((p) => !ids.includes(p.id)));
      exitSelPartes();
    } else {
      setArras((prev) => prev.filter((r) => !ids.includes(r.id)));
      exitSelArras();
    }
    setDeleteTarget(null);
    toast.success(result.message ?? "Eliminado.");
    router.refresh();
  };

  const deleteCount = deleteTarget === "parte" ? idsPartes.size : deleteTarget === "arras" ? idsArras.size : 0;
  const deleteLabel =
    deleteTarget === "parte"
      ? `parte${deleteCount !== 1 ? "s" : ""}`
      : deleteTarget === "arras"
        ? `contrato${deleteCount !== 1 ? "s" : ""}`
        : "";

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Herramientas" }]}
        title="Herramientas"
        description={
          admin
            ? "Partes y contratos de todo el equipo. Pulsa Seleccionar para borrar varios sin entrar al detalle."
            : "Tus partes de visita y contratos de arras. Pulsa Seleccionar para borrar varios."
        }
      />

      <div className="mt-5 grid items-start gap-4 min-[820px]:grid-cols-2">
        <Zona
          icon={ClipboardPenLine}
          title="Partes de visita"
          hint="Cuartilla con franja horaria, inmuebles visitados y LOPD de Rehabinco."
          nuevoHref="/partes-visita/nuevo"
          nuevoLabel={hayParte ? "Continuar borrador" : "Nuevo parte"}
          historicoHref="/partes-visita"
          historicoLabel="Agenda e histórico"
          loading={loading}
          vacio="Aún no hay partes."
          puedeSeleccionar={partes.length > 0}
          selectionMode={selPartes}
          onToggleSelection={() => (selPartes ? exitSelPartes() : setSelPartes(true))}
          selectedCount={idsPartes.size}
          onSelectAll={() => setIdsPartes(new Set(partes.map((p) => p.id)))}
          onClearSelection={() => setIdsPartes(new Set())}
          onDelete={() => setDeleteTarget("parte")}
        >
          {partes.map((p) => {
            const contenido = (
              <>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold">{p.visitante_nombre || "Visitante"}</div>
                  <div className="mt-0.5 truncate text-[12px] text-[var(--text-2)]">
                    {[p.inmueble_direccion, p.fecha_visita].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <CreadorDocumento
                  userId={p.user_id}
                  comercialId={p.comercial_id}
                  creador={p.creador}
                  viewerId={user?.id}
                  admin={admin}
                />
                <span className="whitespace-nowrap text-[12.5px]" style={{ color: colorEstado(p.estado) }}>
                  {ESTADO_PARTE_LABELS[p.estado]}
                </span>
              </>
            );
            if (selPartes) {
              return (
                <label
                  key={p.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 border-b border-[var(--border-row)] px-4 py-2.5 hover:bg-[var(--surface-soft)]",
                    idsPartes.has(p.id) && "bg-[var(--row-active)]"
                  )}
                >
                  <input type="checkbox" checked={idsPartes.has(p.id)} onChange={() => toggleId("parte", p.id)} />
                  {contenido}
                </label>
              );
            }
            return (
              <Link
                key={p.id}
                href={`/partes-visita/${p.id}`}
                className="flex items-center gap-3 border-b border-[var(--border-row)] px-4 py-2.5 hover:bg-[var(--surface-soft)]"
              >
                {contenido}
              </Link>
            );
          })}
        </Zona>

        <Zona
          icon={FileSignature}
          title="Contrato de arras"
          hint="Vendedores, compradores, finca y arras. La cláusula de datos es de Rehabinco, año 2026."
          nuevoHref="/contratos-arras/nuevo"
          nuevoLabel={hayArras ? "Continuar borrador" : "Nuevo contrato"}
          historicoHref="/contratos-arras"
          historicoLabel="Ver histórico"
          loading={loading}
          vacio="Aún no hay contratos de arras."
          puedeSeleccionar={arras.length > 0}
          selectionMode={selArras}
          onToggleSelection={() => (selArras ? exitSelArras() : setSelArras(true))}
          selectedCount={idsArras.size}
          onSelectAll={() => setIdsArras(new Set(arras.map((r) => r.id)))}
          onClearSelection={() => setIdsArras(new Set())}
          onDelete={() => setDeleteTarget("arras")}
        >
          {arras.map((c) => {
            const quien = nombrePersona(c.compradores) || nombrePersona(c.vendedores) || "Contrato";
            const contenido = (
              <>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold">{quien}</div>
                  <div className="mt-0.5 truncate text-[12px] text-[var(--text-2)]">
                    {[c.finca_descripcion, c.fecha].filter(Boolean).join(" · ") || "Sin finca"}
                  </div>
                </div>
                <CreadorDocumento
                  userId={c.user_id}
                  comercialId={c.comercial_id}
                  creador={c.creador}
                  viewerId={user?.id}
                  admin={admin}
                />
                <span className="whitespace-nowrap text-[12.5px] text-[var(--text-2)]">
                  {c.estado === "cerrado" ? "Cerrado" : "Borrador"}
                </span>
              </>
            );
            if (selArras) {
              return (
                <label
                  key={c.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 border-b border-[var(--border-row)] px-4 py-2.5 hover:bg-[var(--surface-soft)]",
                    idsArras.has(c.id) && "bg-[var(--row-active)]"
                  )}
                >
                  <input type="checkbox" checked={idsArras.has(c.id)} onChange={() => toggleId("arras", c.id)} />
                  {contenido}
                </label>
              );
            }
            return (
              <Link
                key={c.id}
                href={`/contratos-arras/${c.id}`}
                className="flex items-center gap-3 border-b border-[var(--border-row)] px-4 py-2.5 hover:bg-[var(--surface-soft)]"
              >
                {contenido}
              </Link>
            );
          })}
        </Zona>
      </div>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`¿Eliminar ${deleteCount} ${deleteLabel}?`}
        description={
          superadmin
            ? "Se borrarán de forma permanente."
            : "Irán a la papelera del superadministrador para confirmar el borrado definitivo."
        }
        confirmLabel={deleting ? "Eliminando…" : superadmin ? "Eliminar definitivamente" : "Enviar a papelera"}
        onConfirm={() => void handleDelete()}
        loading={deleting}
        variant="destructive"
      />
    </div>
  );
}

function Zona({
  icon: Icon,
  title,
  hint,
  nuevoHref,
  nuevoLabel,
  historicoHref,
  historicoLabel,
  loading,
  vacio,
  children,
  puedeSeleccionar,
  selectionMode,
  onToggleSelection,
  selectedCount,
  onSelectAll,
  onClearSelection,
  onDelete,
}: {
  icon: typeof ClipboardPenLine;
  title: string;
  hint: string;
  nuevoHref: string;
  nuevoLabel: string;
  historicoHref: string;
  historicoLabel: string;
  loading: boolean;
  vacio: string;
  children: ReactNode;
  puedeSeleccionar?: boolean;
  selectionMode?: boolean;
  onToggleSelection?: () => void;
  selectedCount?: number;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  onDelete?: () => void;
}) {
  const hay = Boolean(children && Array.isArray(children) ? children.length : children);
  return (
    <section className="overflow-hidden rounded-[14px] border border-border bg-white">
      <div className="border-b border-[var(--border-soft)] px-4 py-4">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-accent-soft text-accent">
            <Icon className="h-4 w-4" strokeWidth={1.8} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[16px] font-semibold">{title}</h2>
            <p className="mt-0.5 text-[12.5px] leading-5 text-[var(--text-2)]">{hint}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href={nuevoHref} className="gap-2">
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              {nuevoLabel}
            </Link>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link href={historicoHref}>{historicoLabel}</Link>
          </Button>
          {puedeSeleccionar && onToggleSelection ? (
            <Button
              type="button"
              size="sm"
              variant={selectionMode ? "default" : "secondary"}
              onClick={onToggleSelection}
              className="gap-2"
            >
              <ListChecks className="h-4 w-4" strokeWidth={1.5} />
              {selectionMode ? "Cancelar" : "Seleccionar"}
            </Button>
          ) : null}
        </div>
      </div>
      {!loading && selectionMode && hay ? (
        <div className="flex flex-col gap-2 border-b border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--text-2)]">
            <span className="font-medium text-foreground">{selectedCount ?? 0}</span> seleccionado
            {(selectedCount ?? 0) !== 1 ? "s" : ""}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onSelectAll}>
              Seleccionar todos
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={onClearSelection} disabled={(selectedCount ?? 0) === 0}>
              Quitar selección
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onDelete}
              disabled={(selectedCount ?? 0) === 0}
              className="gap-1.5 border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
              Eliminar
            </Button>
          </div>
        </div>
      ) : null}
      {loading ? (
        <p className="px-4 py-8 text-center text-[12.5px] text-[var(--text-2)]">Cargando…</p>
      ) : hay ? (
        children
      ) : (
        <p className="px-4 py-8 text-center text-[13.5px] text-[var(--text-2)]">{vacio}</p>
      )}
    </section>
  );
}
