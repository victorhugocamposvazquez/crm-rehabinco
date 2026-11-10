"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { isSuperAdmin } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { AlertDialog } from "@/components/ui/alert-dialog";
import {
  eliminarInmuebleDefinitivo,
  restaurarInmueble,
  vaciarPapeleraInmuebles,
} from "@/lib/actions/propiedades-papelera";
import { formatPrecioInmueble } from "@/lib/inmuebles/catalogo";

export type InmueblePapelera = {
  id: string;
  titulo: string | null;
  direccion: string | null;
  referencia: string | null;
  precio_venta: number | null;
  precio_alquiler: number | null;
  deleted_at: string;
};

function etiqueta(p: InmueblePapelera) {
  return p.titulo?.trim() || p.direccion?.trim() || p.referencia || "Inmueble";
}

function fechaCorta(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

export function PapeleraInmuebles({ tick = 0, onRestaurado }: { tick?: number; onRestaurado?: () => void }) {
  const { user } = useAuth();
  const superadmin = isSuperAdmin(user?.role);
  const [filas, setFilas] = useState<InmueblePapelera[]>([]);
  const [cargando, setCargando] = useState(true);
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [borrarId, setBorrarId] = useState<string | null>(null);
  const [vaciarOpen, setVaciarOpen] = useState(false);
  const [vaciando, setVaciando] = useState(false);

  const cargar = useCallback(() => {
    const supabase = createClient();
    setCargando(true);
    void supabase
      .from("propiedades")
      .select("id, titulo, direccion, referencia, precio_venta, precio_alquiler, deleted_at")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        setFilas(
          ((data ?? []) as Array<InmueblePapelera & { deleted_at: string | null }>)
            .filter((r) => r.deleted_at)
            .map((r) => ({ ...r, deleted_at: r.deleted_at as string }))
        );
        setCargando(false);
      });
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar, tick]);

  const restaurar = async (id: string) => {
    setOcupada(id);
    const result = await restaurarInmueble(id);
    setOcupada(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Inmueble restaurado.");
    setFilas((prev) => prev.filter((f) => f.id !== id));
    onRestaurado?.();
  };

  const eliminarUno = async () => {
    if (!borrarId) return;
    setOcupada(borrarId);
    const result = await eliminarInmuebleDefinitivo(borrarId);
    setOcupada(null);
    setBorrarId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Inmueble eliminado definitivamente.");
    setFilas((prev) => prev.filter((f) => f.id !== borrarId));
  };

  const vaciar = async () => {
    setVaciando(true);
    const result = await vaciarPapeleraInmuebles();
    setVaciando(false);
    setVaciarOpen(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.n ? `Papelera vaciada (${result.n}).` : "Papelera vaciada.");
    setFilas([]);
  };

  return (
    <section className="mt-8 overflow-hidden rounded-[14px] border border-dashed border-[var(--input)] bg-[var(--surface)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-soft)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Trash2 className="h-4 w-4 text-[var(--text-3)]" strokeWidth={1.8} />
          <div>
            <h2 className="text-[14px] font-semibold text-foreground">Papelera</h2>
            <p className="text-[12px] text-[var(--text-3)]">
              Inmuebles quitados del stock. Puedes recuperarlos
              {superadmin ? "; solo tú puedes vaciarla." : "."}
            </p>
          </div>
        </div>
        {superadmin && filas.length > 0 ? (
          <Button type="button" size="sm" variant="secondary" onClick={() => setVaciarOpen(true)}>
            Vaciar papelera
          </Button>
        ) : null}
      </div>

      {cargando ? (
        <p className="px-4 py-6 text-[13px] text-[var(--text-3)]">Cargando papelera…</p>
      ) : filas.length === 0 ? (
        <p className="px-4 py-8 text-center text-[13px] text-[var(--text-2)]">La papelera está vacía.</p>
      ) : (
        <ul className="divide-y divide-[var(--border-row)]">
          {filas.map((f) => {
            const precio = f.precio_venta ?? f.precio_alquiler;
            return (
              <li
                key={f.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-foreground">{etiqueta(f)}</p>
                  <p className="mt-0.5 text-[12px] text-[var(--text-2)]">
                    {[f.referencia, formatPrecioInmueble(precio), `Eliminado ${fechaCorta(f.deleted_at)}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={ocupada === f.id}
                    onClick={() => void restaurar(f.id)}
                  >
                    Recuperar
                  </Button>
                  {superadmin ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={ocupada === f.id}
                      onClick={() => setBorrarId(f.id)}
                      className="text-red-700"
                    >
                      Eliminar definitivo
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog
        open={Boolean(borrarId)}
        onOpenChange={(open) => !open && setBorrarId(null)}
        title="¿Eliminar definitivamente?"
        description="Se borrará el inmueble y sus fotos/documentos. No se puede deshacer."
        confirmLabel={ocupada ? "Eliminando…" : "Eliminar"}
        loading={Boolean(ocupada)}
        variant="destructive"
        onConfirm={() => void eliminarUno()}
      />
      <AlertDialog
        open={vaciarOpen}
        onOpenChange={setVaciarOpen}
        title="¿Vaciar la papelera?"
        description={`Se eliminarán definitivamente ${filas.length} inmueble${filas.length === 1 ? "" : "s"}. No se puede deshacer.`}
        confirmLabel={vaciando ? "Vaciando…" : "Vaciar"}
        loading={vaciando}
        variant="destructive"
        onConfirm={() => void vaciar()}
      />
    </section>
  );
}
