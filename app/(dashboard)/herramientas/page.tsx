"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ClipboardPenLine, FileSignature, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { isAdmin, puedeVerPapelera } from "@/lib/auth/roles";
import { relacionUno } from "@/lib/citas/citas";
import { PageHeader } from "@/components/layout/PageHeader";
import { CreadorDocumento } from "@/components/documentos/CreadorDocumento";
import { BotonPapeleraDocumento } from "@/components/documentos/BotonPapeleraDocumento";
import { Button } from "@/components/ui/button";
import { ESTADO_PARTE_LABELS } from "@/lib/partes-visita";
import { colorEstado } from "@/lib/ui/estados-vista";
import { useHayAltaBorrador } from "@/lib/ui/use-alta-borrador";

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
  const admin = isAdmin(user?.role);
  const verPapelera = puedeVerPapelera(user?.role);
  const [partes, setPartes] = useState<ParteRow[]>([]);
  const [arras, setArras] = useState<ArrasRow[]>([]);
  const [loading, setLoading] = useState(true);
  const hayParte = useHayAltaBorrador("parte");
  const hayArras = useHayAltaBorrador("arras");

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

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Herramientas" }]}
        title="Herramientas"
        description={
          admin
            ? "Partes y contratos de todo el equipo. Cada sección tiene su papelera para confirmar borrados."
            : "Tus partes de visita y contratos de arras. Usa la papelera de cada fila para eliminar."
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
          papeleraHref={verPapelera ? "/partes-visita/papelera" : undefined}
          loading={loading}
          vacio="Aún no hay partes."
        >
          {partes.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 border-b border-[var(--border-row)] px-4 py-2.5 hover:bg-[var(--surface-soft)]"
            >
              <Link href={`/partes-visita/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
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
              </Link>
              <BotonPapeleraDocumento
                id={p.id}
                tipo="parte_visita"
                onEliminado={(id) => setPartes((prev) => prev.filter((item) => item.id !== id))}
              />
            </div>
          ))}
        </Zona>

        <Zona
          icon={FileSignature}
          title="Contrato de arras"
          hint="Vendedores, compradores, finca y arras. La cláusula de datos es de Rehabinco, año 2026."
          nuevoHref="/contratos-arras/nuevo"
          nuevoLabel={hayArras ? "Continuar borrador" : "Nuevo contrato"}
          historicoHref="/contratos-arras"
          historicoLabel="Ver histórico"
          papeleraHref={verPapelera ? "/contratos-arras/papelera" : undefined}
          loading={loading}
          vacio="Aún no hay contratos de arras."
        >
          {arras.map((c) => {
            const quien = nombrePersona(c.compradores) || nombrePersona(c.vendedores) || "Contrato";
            return (
              <div
                key={c.id}
                className="flex items-center gap-2 border-b border-[var(--border-row)] px-4 py-2.5 hover:bg-[var(--surface-soft)]"
              >
                <Link href={`/contratos-arras/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3">
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
                </Link>
                <BotonPapeleraDocumento
                  id={c.id}
                  tipo="contrato_arras"
                  onEliminado={(id) => setArras((prev) => prev.filter((item) => item.id !== id))}
                />
              </div>
            );
          })}
        </Zona>
      </div>
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
  papeleraHref,
  loading,
  vacio,
  children,
}: {
  icon: typeof ClipboardPenLine;
  title: string;
  hint: string;
  nuevoHref: string;
  nuevoLabel: string;
  historicoHref: string;
  historicoLabel: string;
  papeleraHref?: string;
  loading: boolean;
  vacio: string;
  children: ReactNode;
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
          {papeleraHref ? (
            <Button asChild size="sm" variant="secondary">
              <Link href={papeleraHref} className="gap-2">
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                Papelera
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
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
