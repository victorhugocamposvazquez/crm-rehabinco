"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { SettingsAdminNav } from "@/components/settings/SettingsAdminNav";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";
import { listarPapeleraUsuarios, resolverPapelera } from "@/lib/actions/papelera";
import {
  ACCION_PAPELERA_LABEL,
  TIPO_PAPELERA_LABEL,
  type PapeleraItem,
} from "@/lib/papelera/papelera";
import { puedeVerPapelera } from "@/lib/auth/roles";

export default function PapeleraUsuariosPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<PapeleraItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const cargar = () => {
    void listarPapeleraUsuarios().then((data) => {
      if ("error" in data) {
        toast.error(data.error);
        setItems([]);
      } else {
        setItems(data);
      }
      setLoading(false);
    });
  };

  useEffect(() => {
    if (!puedeVerPapelera(user?.role)) {
      setLoading(false);
      return;
    }
    cargar();
  }, [user?.role]);

  const resolver = async (id: string, accion: "aprobar" | "rechazar" | "restaurar") => {
    setBusyId(id);
    const result = await resolverPapelera(id, accion);
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message ?? "Hecho.");
    cargar();
  };

  if (!puedeVerPapelera(user?.role)) {
    return (
      <div>
        <PageHeader
          breadcrumb={[{ label: "Ajustes", href: "/settings" }, { label: "Papelera de usuarios" }]}
          title="Papelera de usuarios"
        />
        <p className="mt-6 text-sm text-[var(--text-2)]">Solo el superadministrador puede ver la papelera.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Ajustes", href: "/settings" }, { label: "Papelera de usuarios" }]}
        title="Papelera de usuarios"
        description="Altas y bajas de usuarios solicitadas por administradores."
      />
      <SettingsAdminNav role={user?.role} />

      <section className="mt-6 overflow-hidden rounded-[14px] border border-border bg-white">
        {loading ? (
          <p className="px-4 py-8 text-center text-[13px] text-[var(--text-2)]">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13.5px] text-[var(--text-2)]">
            No hay solicitudes de usuarios pendientes.
          </p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 border-b border-[var(--border-row)] px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-[14px] font-semibold">{item.etiqueta}</p>
                <p className="mt-0.5 text-[12px] text-[var(--text-2)]">
                  {ACCION_PAPELERA_LABEL[item.accion as keyof typeof ACCION_PAPELERA_LABEL]}{" "}
                  {TIPO_PAPELERA_LABEL[item.tipo as keyof typeof TIPO_PAPELERA_LABEL]} ·{" "}
                  {item.solicitante?.nombre_completo || item.solicitante?.email || "Admin"} ·{" "}
                  {new Date(item.created_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busyId === item.id}
                  onClick={() => void resolver(item.id, "rechazar")}
                >
                  Rechazar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={busyId === item.id}
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => void resolver(item.id, "aprobar")}
                >
                  {item.accion === "crear" ? "Crear" : "Eliminar definitivamente"}
                </Button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
