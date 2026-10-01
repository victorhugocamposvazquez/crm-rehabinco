"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ClipboardPenLine, FileSignature, FileText, Home, Plus, ScrollText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { isAdmin } from "@/lib/auth/roles";
import { relacionUno } from "@/lib/citas/citas";
import { PageHeader } from "@/components/layout/PageHeader";
import { CreadorDocumento } from "@/components/documentos/CreadorDocumento";
import { BotonPapeleraDocumento } from "@/components/documentos/BotonPapeleraDocumento";
import { Button } from "@/components/ui/button";
import { ESTADO_PARTE_LABELS } from "@/lib/partes-visita";
import { colorEstado } from "@/lib/ui/estados-vista";
import { useHayAltaBorrador } from "@/lib/ui/use-alta-borrador";
import type { TipoDocumentoPapelera } from "@/lib/papelera/papelera";

type Creador = { nombre_completo?: string | null; color?: string | null; email?: string | null } | null;

type ParteRow = {
  id: string;
  user_id: string;
  comercial_id: string | null;
  visitante_nombre: string | null;
  inmueble_direccion: string | null;
  fecha_visita: string | null;
  estado: "borrador" | "pendiente_firma" | "firmado";
  creador?: Creador;
};

type DocRow = {
  id: string;
  user_id: string;
  comercial_id: string | null;
  fecha: string | null;
  estado: "borrador" | "cerrado";
  titulo: string;
  subtitulo: string;
  creador?: Creador;
  tipoPapelera: TipoDocumentoPapelera;
  href: string;
};

function nombrePersona(raw: unknown): string {
  if (!Array.isArray(raw) || raw.length === 0) return "";
  const first = raw[0];
  if (!first || typeof first !== "object") return "";
  return String((first as { nombre?: string }).nombre ?? "").trim();
}

function mapCreador<T extends { creador?: Creador | Creador[] }>(row: T): Omit<T, "creador"> & { creador: Creador } {
  return { ...row, creador: relacionUno(row.creador) };
}

export default function HerramientasPage() {
  const { user } = useAuth();
  const admin = isAdmin(user?.role);
  const [partes, setPartes] = useState<ParteRow[]>([]);
  const [arras, setArras] = useState<DocRow[]>([]);
  const [honorarios, setHonorarios] = useState<DocRow[]>([]);
  const [aplazado, setAplazado] = useState<DocRow[]>([]);
  const [arrendamiento, setArrendamiento] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const hayParte = useHayAltaBorrador("parte");
  const hayArras = useHayAltaBorrador("arras");
  const hayHonorarios = useHayAltaBorrador("honorarios");
  const hayAplazado = useHayAltaBorrador("pago-aplazado");
  const hayArrendamiento = useHayAltaBorrador("arrendamiento");

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
        .limit(6),
      supabase
        .from("contratos_arras")
        .select(
          "id, user_id, comercial_id, fecha, estado, finca_descripcion, compradores, vendedores, creador:comercial_id(nombre_completo, color, email)"
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("hojas_encargo_honorarios")
        .select(
          "id, user_id, comercial_id, fecha, estado, cliente_nombre, inmueble_descripcion, creador:comercial_id(nombre_completo, color, email)"
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("contratos_pago_aplazado")
        .select(
          "id, user_id, comercial_id, fecha, estado, finca_descripcion, compradores, vendedores, creador:comercial_id(nombre_completo, color, email)"
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("contratos_arrendamiento")
        .select(
          "id, user_id, comercial_id, fecha, estado, vivienda_direccion, arrendatarios, arrendadores, creador:comercial_id(nombre_completo, color, email)"
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(6),
    ]).then(([p, a, h, ap, ar]) => {
      setPartes(((p.data ?? []) as Array<ParteRow & { creador?: Creador | Creador[] }>).map(mapCreador));
      setArras(
        ((a.data ?? []) as Array<{
          id: string;
          user_id: string;
          comercial_id: string | null;
          fecha: string | null;
          estado: "borrador" | "cerrado";
          finca_descripcion: string | null;
          compradores: unknown;
          vendedores: unknown;
          creador?: Creador | Creador[];
        }>).map((c) => {
          const row = mapCreador(c);
          return {
            id: row.id,
            user_id: row.user_id,
            comercial_id: row.comercial_id,
            fecha: row.fecha,
            estado: row.estado,
            titulo: nombrePersona(row.compradores) || nombrePersona(row.vendedores) || "Contrato",
            subtitulo: [row.finca_descripcion, row.fecha].filter(Boolean).join(" · ") || "Sin finca",
            creador: row.creador,
            tipoPapelera: "contrato_arras" as const,
            href: `/contratos-arras/${row.id}`,
          };
        })
      );
      setHonorarios(
        ((h.data ?? []) as Array<{
          id: string;
          user_id: string;
          comercial_id: string | null;
          fecha: string | null;
          estado: "borrador" | "cerrado";
          cliente_nombre: string | null;
          inmueble_descripcion: string | null;
          creador?: Creador | Creador[];
        }>).map((c) => {
          const row = mapCreador(c);
          return {
            id: row.id,
            user_id: row.user_id,
            comercial_id: row.comercial_id,
            fecha: row.fecha,
            estado: row.estado,
            titulo: row.cliente_nombre || "Cliente",
            subtitulo: [row.inmueble_descripcion, row.fecha].filter(Boolean).join(" · ") || "Sin inmueble",
            creador: row.creador,
            tipoPapelera: "hoja_encargo_honorarios" as const,
            href: `/hojas-encargo-honorarios/${row.id}`,
          };
        })
      );
      setAplazado(
        ((ap.data ?? []) as Array<{
          id: string;
          user_id: string;
          comercial_id: string | null;
          fecha: string | null;
          estado: "borrador" | "cerrado";
          finca_descripcion: string | null;
          compradores: unknown;
          vendedores: unknown;
          creador?: Creador | Creador[];
        }>).map((c) => {
          const row = mapCreador(c);
          return {
            id: row.id,
            user_id: row.user_id,
            comercial_id: row.comercial_id,
            fecha: row.fecha,
            estado: row.estado,
            titulo: nombrePersona(row.compradores) || nombrePersona(row.vendedores) || "Contrato",
            subtitulo: [row.finca_descripcion, row.fecha].filter(Boolean).join(" · ") || "Sin finca",
            creador: row.creador,
            tipoPapelera: "contrato_pago_aplazado" as const,
            href: `/contratos-pago-aplazado/${row.id}`,
          };
        })
      );
      setArrendamiento(
        ((ar.data ?? []) as Array<{
          id: string;
          user_id: string;
          comercial_id: string | null;
          fecha: string | null;
          estado: "borrador" | "cerrado";
          vivienda_direccion: string | null;
          arrendatarios: unknown;
          arrendadores: unknown;
          creador?: Creador | Creador[];
        }>).map((c) => {
          const row = mapCreador(c);
          return {
            id: row.id,
            user_id: row.user_id,
            comercial_id: row.comercial_id,
            fecha: row.fecha,
            estado: row.estado,
            titulo: nombrePersona(row.arrendatarios) || nombrePersona(row.arrendadores) || "Contrato",
            subtitulo: [row.vivienda_direccion, row.fecha].filter(Boolean).join(" · ") || "Sin vivienda",
            creador: row.creador,
            tipoPapelera: "contrato_arrendamiento" as const,
            href: `/contratos-arrendamiento/${row.id}`,
          };
        })
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
            ? "Partes y contratos de todo el equipo. Los borrados van a la papelera de la barra inferior."
            : "Tus partes de visita y contratos. Usa la papelera de cada fila para eliminar."
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

        <ZonaDocs
          icon={FileSignature}
          title="Contrato de arras"
          hint="Vendedores, compradores, finca y arras. LOPD de Rehabinco."
          nuevoHref="/contratos-arras/nuevo"
          nuevoLabel={hayArras ? "Continuar borrador" : "Nuevo contrato"}
          historicoHref="/contratos-arras"
          loading={loading}
          vacio="Aún no hay contratos de arras."
          rows={arras}
          userId={user?.id}
          admin={admin}
          onEliminado={(id) => setArras((prev) => prev.filter((item) => item.id !== id))}
        />

        <ZonaDocs
          icon={ScrollText}
          title="Hoja de encargo / honorarios"
          hint="Reconocimiento de honorarios con mínimo y reparto 60/40."
          nuevoHref="/hojas-encargo-honorarios/nuevo"
          nuevoLabel={hayHonorarios ? "Continuar borrador" : "Nueva hoja"}
          historicoHref="/hojas-encargo-honorarios"
          loading={loading}
          vacio="Aún no hay hojas de encargo."
          rows={honorarios}
          userId={user?.id}
          admin={admin}
          onEliminado={(id) => setHonorarios((prev) => prev.filter((item) => item.id !== id))}
        />

        <ZonaDocs
          icon={FileText}
          title="Compraventa aplazada"
          hint="Precio, pago inicial, cuotas mensuales y LOPD Rehabinco."
          nuevoHref="/contratos-pago-aplazado/nuevo"
          nuevoLabel={hayAplazado ? "Continuar borrador" : "Nuevo contrato"}
          historicoHref="/contratos-pago-aplazado"
          loading={loading}
          vacio="Aún no hay compraventas aplazadas."
          rows={aplazado}
          userId={user?.id}
          admin={admin}
          onEliminado={(id) => setAplazado((prev) => prev.filter((item) => item.id !== id))}
        />

        <ZonaDocs
          icon={Home}
          title="Arrendamiento"
          hint="Vivienda, renta, fianza y seguro DAS/COSNOR."
          nuevoHref="/contratos-arrendamiento/nuevo"
          nuevoLabel={hayArrendamiento ? "Continuar borrador" : "Nuevo contrato"}
          historicoHref="/contratos-arrendamiento"
          loading={loading}
          vacio="Aún no hay contratos de arrendamiento."
          rows={arrendamiento}
          userId={user?.id}
          admin={admin}
          onEliminado={(id) => setArrendamiento((prev) => prev.filter((item) => item.id !== id))}
        />
      </div>
    </div>
  );
}

function ZonaDocs({
  icon,
  title,
  hint,
  nuevoHref,
  nuevoLabel,
  historicoHref,
  loading,
  vacio,
  rows,
  userId,
  admin,
  onEliminado,
}: {
  icon: typeof FileSignature;
  title: string;
  hint: string;
  nuevoHref: string;
  nuevoLabel: string;
  historicoHref: string;
  loading: boolean;
  vacio: string;
  rows: DocRow[];
  userId?: string;
  admin: boolean;
  onEliminado: (id: string) => void;
}) {
  return (
    <Zona
      icon={icon}
      title={title}
      hint={hint}
      nuevoHref={nuevoHref}
      nuevoLabel={nuevoLabel}
      historicoHref={historicoHref}
      historicoLabel="Ver histórico"
      loading={loading}
      vacio={vacio}
    >
      {rows.map((c) => (
        <div
          key={c.id}
          className="flex items-center gap-2 border-b border-[var(--border-row)] px-4 py-2.5 hover:bg-[var(--surface-soft)]"
        >
          <Link href={c.href} className="flex min-w-0 flex-1 items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold">{c.titulo}</div>
              <div className="mt-0.5 truncate text-[12px] text-[var(--text-2)]">{c.subtitulo}</div>
            </div>
            <CreadorDocumento
              userId={c.user_id}
              comercialId={c.comercial_id}
              creador={c.creador}
              viewerId={userId}
              admin={admin}
            />
            <span className="whitespace-nowrap text-[12.5px] text-[var(--text-2)]">
              {c.estado === "cerrado" ? "Cerrado" : "Borrador"}
            </span>
          </Link>
          <BotonPapeleraDocumento id={c.id} tipo={c.tipoPapelera} onEliminado={onEliminado} />
        </div>
      ))}
    </Zona>
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
