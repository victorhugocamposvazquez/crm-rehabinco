"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Fab } from "@/components/ui/fab";
import { listarPersonasArras, parsePersonasArras } from "@/lib/contrato-arras";
import { useHayAltaBorrador } from "@/lib/ui/use-alta-borrador";

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
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const hayBorrador = useHayAltaBorrador("arras");

  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("contratos_arras")
      .select("id, fecha, estado, finca_descripcion, precio, arras, compradores, vendedores")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setRows((data ?? []) as Row[]);
        setLoading(false);
      });
  }, []);

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
          <Button asChild size="sm" className="hidden min-[820px]:inline-flex">
            <Link href="/contratos-arras/nuevo" className="gap-2">
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              {hayBorrador ? "Continuar borrador" : "Nuevo contrato"}
            </Link>
          </Button>
        }
      />

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
            return (
              <Link
                key={row.id}
                href={`/contratos-arras/${row.id}`}
                className="flex items-center gap-3 border-b border-[var(--border-row)] px-4 py-2.5 hover:bg-[var(--surface-soft)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold">{compradores || "Compradores pendientes"}</div>
                  <div className="mt-0.5 truncate text-[12px] text-[var(--text-2)]">
                    {[row.finca_descripcion, row.fecha, row.precio != null ? `${row.precio.toLocaleString("es-ES")} €` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <span className="text-[12.5px] text-[var(--text-2)]">{row.estado === "cerrado" ? "Cerrado" : "Borrador"}</span>
              </Link>
            );
          })
        )}
      </section>
      <Fab href="/contratos-arras/nuevo" label={hayBorrador ? "Continuar borrador" : "Nuevo contrato"} />
    </div>
  );
}
