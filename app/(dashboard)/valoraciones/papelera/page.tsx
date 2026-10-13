"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { ValoracionesNav } from "@/components/avm/ValoracionesNav";
import { createClient } from "@/lib/supabase/client";
import { eliminarValoracionDefinitiva, restaurarValoracion } from "@/lib/actions/avm-papelera";
import { fmtEuros, fmtFechaCorta } from "@/lib/avm/ui/format";

type Fila = {
  id: string;
  created_at: string;
  deleted_at: string;
  value_mid: number | null;
  direccion: string;
};

export default function PapeleraValoracionesPage() {
  const router = useRouter();
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [borrarId, setBorrarId] = useState<string | null>(null);

  const cargar = useCallback(() => {
    const supabase = createClient();
    setCargando(true);
    void supabase
      .from("avm_valuations")
      .select("id, created_at, deleted_at, value_mid, avm_properties(formatted_address)")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        setFilas(
          (data ?? []).map((r) => {
            const property = Array.isArray(r.avm_properties) ? r.avm_properties[0] : r.avm_properties;
            return {
              id: r.id,
              created_at: r.created_at,
              deleted_at: r.deleted_at as string,
              value_mid: r.value_mid == null ? null : Number(r.value_mid),
              direccion: property?.formatted_address || "Sin dirección",
            };
          })
        );
        setCargando(false);
      });
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const restaurar = async (id: string) => {
    setOcupada(id);
    const result = await restaurarValoracion(id);
    setOcupada(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Valoración restaurada.");
    cargar();
    window.dispatchEvent(new Event("avm-papelera"));
    router.refresh();
  };

  const eliminar = async () => {
    if (!borrarId) return;
    setOcupada(borrarId);
    const result = await eliminarValoracionDefinitiva(borrarId);
    setOcupada(null);
    setBorrarId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Valoración eliminada.");
    window.dispatchEvent(new Event("avm-papelera"));
    cargar();
  };

  return (
    <div className="pb-20">
      <PageHeader
        breadcrumb={[{ label: "Valoraciones", href: "/valoraciones" }, { label: "Papelera" }]}
        title="Papelera"
        description="Valoraciones apartadas del listado. Puedes devolverlas o borrarlas del todo."
        actions={
          <Button asChild size="sm" variant="secondary">
            <Link href="/valoraciones" className="gap-2">
              <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
              Volver al listado
            </Link>
          </Button>
        }
      />
      <ValoracionesNav actual="/valoraciones/papelera" />

      {cargando ? (
        <p className="text-[13px] text-[var(--text-3)]">Cargando…</p>
      ) : filas.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-[var(--border)] px-4 py-10 text-center text-[13px] text-[var(--text-2)]">
          La papelera está vacía.
        </p>
      ) : (
        <div className="overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--surface)]">
          {filas.map((f) => (
            <div
              key={f.id}
              className="flex flex-col gap-3 border-b border-[var(--border)] px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-[14px] font-medium">{f.direccion}</p>
                <p className="mt-0.5 text-[12px] text-[var(--text-3)]">
                  {f.value_mid != null ? fmtEuros(f.value_mid) : "Sin valor"} · creada {fmtFechaCorta(f.created_at)} · en papelera{" "}
                  {fmtFechaCorta(f.deleted_at)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="secondary" disabled={ocupada === f.id} onClick={() => void restaurar(f.id)}>
                  Restaurar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={ocupada === f.id}
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => setBorrarId(f.id)}
                >
                  Eliminar definitivamente
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog
        open={borrarId != null}
        onOpenChange={(open) => {
          if (!open) setBorrarId(null);
        }}
        title="Eliminar definitivamente"
        description="Esta valoración desaparece y no se puede recuperar."
        confirmLabel="Eliminar"
        variant="destructive"
        loading={ocupada != null}
        onConfirm={eliminar}
      />
    </div>
  );
}
