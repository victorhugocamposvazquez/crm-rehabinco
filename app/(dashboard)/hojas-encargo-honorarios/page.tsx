"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { isAdmin } from "@/lib/auth/roles";
import { relacionUno } from "@/lib/citas/citas";
import { CreadorDocumento } from "@/components/documentos/CreadorDocumento";
import { BotonPapeleraDocumento } from "@/components/documentos/BotonPapeleraDocumento";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Fab } from "@/components/ui/fab";
import { useHayAltaBorrador } from "@/lib/ui/use-alta-borrador";

type Row = {
  id: string;
  user_id: string;
  comercial_id: string | null;
  fecha: string | null;
  estado: "borrador" | "cerrado";
  cliente_nombre: string | null;
  inmueble_descripcion: string | null;
  creador?: { nombre_completo?: string | null; color?: string | null; email?: string | null } | null;
};

export default function HojasEncargoHonorariosPage() {
  const { user } = useAuth();
  const admin = isAdmin(user?.role);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const hayBorrador = useHayAltaBorrador("honorarios");

  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("hojas_encargo_honorarios")
      .select(
        "id, user_id, comercial_id, fecha, estado, cliente_nombre, inmueble_descripcion, creador:comercial_id(nombre_completo, color, email)"
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setRows(
          ((data ?? []) as Array<Row & { creador?: Row["creador"] | Row["creador"][] }>).map((row) => ({
            ...row,
            creador: relacionUno(row.creador),
          }))
        );
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Herramientas", href: "/herramientas" },
          { label: "Hojas de encargo" },
        ]}
        title="Hojas de encargo / honorarios"
        description={
          admin
            ? "Encargos de todo el equipo. Cada fila indica quién lo creó."
            : "Tus hojas de encargo. Se rellenan en el CRM y se descargan en PDF."
        }
        actions={
          <Button asChild size="sm" className="hidden min-[820px]:inline-flex">
            <Link href="/hojas-encargo-honorarios/nuevo" className="gap-2">
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              {hayBorrador ? "Continuar borrador" : "Nueva hoja"}
            </Link>
          </Button>
        }
      />

      <section className="mt-5 overflow-hidden rounded-[14px] border border-border bg-white">
        {loading ? (
          <p className="px-4 py-8 text-center text-[12.5px] text-[var(--text-2)]">Cargando…</p>
        ) : rows.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[13.5px] text-[var(--text-2)]">Aún no hay hojas de encargo.</p>
            <Button asChild size="sm" className="mt-4">
              <Link href="/hojas-encargo-honorarios/nuevo">Nueva hoja</Link>
            </Button>
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="flex items-center gap-2 border-b border-[var(--border-row)] px-4 py-2.5 hover:bg-[var(--surface-soft)]"
            >
              <Link href={`/hojas-encargo-honorarios/${row.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold">{row.cliente_nombre || "Cliente pendiente"}</div>
                  <div className="mt-0.5 truncate text-[12px] text-[var(--text-2)]">
                    {[row.inmueble_descripcion, row.fecha].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <CreadorDocumento
                  userId={row.user_id}
                  comercialId={row.comercial_id}
                  creador={row.creador}
                  viewerId={user?.id}
                  admin={admin}
                />
                <span className="text-[12.5px] text-[var(--text-2)]">{row.estado === "cerrado" ? "Cerrado" : "Borrador"}</span>
              </Link>
              <BotonPapeleraDocumento
                id={row.id}
                tipo="hoja_encargo_honorarios"
                onEliminado={(id) => setRows((prev) => prev.filter((item) => item.id !== id))}
              />
            </div>
          ))
        )}
      </section>

      <Fab href="/hojas-encargo-honorarios/nuevo" label={hayBorrador ? "Continuar borrador" : "Nueva hoja"} />
    </div>
  );
}
