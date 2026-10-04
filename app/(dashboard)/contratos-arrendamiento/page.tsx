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
import { listarPersonasArras, parsePersonasArras } from "@/lib/contrato-arras";
import { useHayAltaBorrador } from "@/lib/ui/use-alta-borrador";

type Row = {
  id: string;
  user_id: string;
  comercial_id: string | null;
  fecha: string | null;
  estado: "borrador" | "cerrado";
  vivienda_direccion: string | null;
  renta_mensual: number | null;
  arrendatarios: unknown;
  arrendadores: unknown;
  creador?: { nombre_completo?: string | null; color?: string | null; email?: string | null } | null;
};

export default function ContratosArrendamientoPage() {
  const { user } = useAuth();
  const admin = isAdmin(user?.role);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const hayBorrador = useHayAltaBorrador("arrendamiento");

  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("contratos_arrendamiento")
      .select(
        "id, user_id, comercial_id, fecha, estado, vivienda_direccion, renta_mensual, arrendatarios, arrendadores, creador:comercial_id(nombre_completo, color, email)"
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
          { label: "Arrendamiento" },
        ]}
        title="Contratos de arrendamiento"
        description={
          admin
            ? "Contratos de todo el equipo. Cada fila indica quién lo creó."
            : "Tus contratos de arrendamiento con seguro DAS/COSNOR."
        }
        actions={
          <Button asChild size="sm" className="hidden min-[820px]:inline-flex">
            <Link href="/contratos-arrendamiento/nuevo" className="gap-2">
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              {hayBorrador ? "Continuar borrador" : "Nuevo contrato"}
            </Link>
          </Button>
        }
      />

      <section className="mt-5 overflow-hidden rounded-[14px] border border-border bg-[var(--surface)]">
        {loading ? (
          <p className="px-4 py-8 text-center text-[12.5px] text-[var(--text-2)]">Cargando…</p>
        ) : rows.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[13.5px] text-[var(--text-2)]">Aún no hay contratos de arrendamiento.</p>
            <Button asChild size="sm" className="mt-4">
              <Link href="/contratos-arrendamiento/nuevo">Nuevo contrato</Link>
            </Button>
          </div>
        ) : (
          rows.map((row) => {
            const arrendatarios = listarPersonasArras(parsePersonasArras(row.arrendatarios));
            return (
              <div
                key={row.id}
                className="flex items-center gap-2 border-b border-[var(--border-row)] px-4 py-2.5 hover:bg-[var(--surface-soft)]"
              >
                <Link href={`/contratos-arrendamiento/${row.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold">{arrendatarios || "Arrendatario pendiente"}</div>
                    <div className="mt-0.5 truncate text-[12px] text-[var(--text-2)]">
                      {[
                        row.vivienda_direccion,
                        row.fecha,
                        row.renta_mensual != null ? `${row.renta_mensual.toLocaleString("es-ES")} €/mes` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
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
                  tipo="contrato_arrendamiento"
                  onEliminado={(id) => setRows((prev) => prev.filter((item) => item.id !== id))}
                />
              </div>
            );
          })
        )}
      </section>

      <Fab href="/contratos-arrendamiento/nuevo" label={hayBorrador ? "Continuar borrador" : "Nuevo contrato"} />
    </div>
  );
}
