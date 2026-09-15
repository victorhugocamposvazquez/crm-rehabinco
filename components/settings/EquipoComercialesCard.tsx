"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteUserAccess, setUserActivo } from "@/lib/actions/usuarios";
import { puedeGestionarUsuarios, roleLabel, type Role } from "@/lib/auth/roles";

type UsuarioRow = {
  id: string;
  nombre_completo: string | null;
  email: string | null;
  zona: string | null;
  color: string;
  activo: boolean;
  role: string;
};

export function EquipoComercialesCard({
  role,
  tick,
}: {
  role?: Role | null;
  tick?: number;
}) {
  const [filas, setFilas] = useState<UsuarioRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const gestiona = puedeGestionarUsuarios(role);

  const cargar = () => {
    const supabase = createClient();
    void supabase
      .from("profiles")
      .select("id, nombre_completo, email, zona, color, activo, role")
      .order("nombre_completo")
      .then(({ data }) => setFilas((data ?? []) as UsuarioRow[]));
  };

  useEffect(() => {
    cargar();
  }, [tick]);

  const desactivar = async (item: UsuarioRow) => {
    setBusyId(item.id);
    const result = await setUserActivo(item.id, !item.activo);
    setBusyId(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message);
    cargar();
  };

  const eliminar = async (item: UsuarioRow) => {
    if (
      !window.confirm(
        `¿Eliminar el acceso de ${item.nombre_completo || item.email}? Si tiene historial en el CRM, se corta el login y se conserva lo ya hecho.`
      )
    ) {
      return;
    }
    setBusyId(item.id);
    const result = await deleteUserAccess(item.id);
    setBusyId(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message);
    cargar();
  };

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>Equipo</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-neutral-500">
          {gestiona
            ? "Desactiva o elimina accesos. El historial del CRM se conserva si esa persona ya tiene datos."
            : "Color y zona salen en el calendario. Solo el superadministrador gestiona altas y bajas."}
        </p>
        <ul className="space-y-2">
          {filas.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#E6E3DD] px-3 py-2 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: item.color || "#3A6A82" }} />
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.nombre_completo || item.email}</p>
                  <p className="text-xs text-neutral-500">
                    {roleLabel(item.role as Role)} · {item.zona || "Sin zona"}
                    {item.activo ? "" : " · sin acceso"}
                  </p>
                </div>
              </div>
              {gestiona ? (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    className="text-xs font-semibold text-[#0B7461] hover:underline disabled:opacity-50"
                    onClick={() => void desactivar(item)}
                  >
                    {item.activo ? "Desactivar" : "Activar"}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    className="text-xs font-semibold text-[var(--red)] hover:underline disabled:opacity-50"
                    onClick={() => void eliminar(item)}
                  >
                    Eliminar
                  </button>
                </div>
              ) : (
                <span className="shrink-0 text-xs font-semibold text-neutral-500">{item.activo ? "Activo" : "Inactivo"}</span>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
