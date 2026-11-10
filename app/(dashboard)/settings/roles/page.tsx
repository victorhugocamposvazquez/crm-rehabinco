"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { SettingsAdminNav } from "@/components/settings/SettingsAdminNav";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";
import { usePermisos } from "@/lib/auth/permisos-context";
import { ROLE_LABELS, isSuperAdmin, type Role } from "@/lib/auth/roles";
import {
  PERMISOS,
  ROLES_CONFIGURABLES,
  activoDe,
  type FilaPermiso,
  type PermisoId,
} from "@/lib/auth/permisos";
import { createClient } from "@/lib/supabase/client";

type RolConfigurable = (typeof ROLES_CONFIGURABLES)[number];

export default function RolesPermisosPage() {
  const { user } = useAuth();
  const { filas, recargar } = usePermisos();
  const router = useRouter();
  const [borrador, setBorrador] = useState<Record<string, boolean>>({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (user && !isSuperAdmin(user.role)) router.replace("/settings");
  }, [user, router]);

  useEffect(() => {
    const siguiente: Record<string, boolean> = {};
    for (const rol of ROLES_CONFIGURABLES) {
      for (const permiso of PERMISOS) {
        siguiente[`${rol}:${permiso.id}`] = activoDe(rol, permiso.id, filas);
      }
    }
    setBorrador(siguiente);
  }, [filas]);

  const grupos = useMemo(() => {
    return (["Zonas", "Permisos"] as const).map((grupo) => ({
      grupo,
      items: PERMISOS.filter((item) => item.grupo === grupo),
    }));
  }, []);

  const marcar = (rol: RolConfigurable, id: PermisoId, activo: boolean) => {
    setBorrador((prev) => ({ ...prev, [`${rol}:${id}`]: activo }));
  };

  const guardar = async () => {
    setGuardando(true);
    const filasNuevas: FilaPermiso[] = [];
    for (const rol of ROLES_CONFIGURABLES) {
      for (const permiso of PERMISOS) {
        filasNuevas.push({ role: rol, permiso: permiso.id, activo: Boolean(borrador[`${rol}:${permiso.id}`]) });
      }
    }
    const supabase = createClient();
    const { error } = await supabase.from("role_permisos").upsert(
      filasNuevas.map((fila) => ({ ...fila, updated_at: new Date().toISOString() })),
      { onConflict: "role,permiso" }
    );
    setGuardando(false);
    if (error) {
      toast.error("No se han guardado los permisos. Si acaba de crearse esta pantalla, falta aplicar la migración.");
      return;
    }
    toast.success("Permisos guardados. Cada persona los verá al recargar.");
    recargar();
  };

  if (!isSuperAdmin(user?.role)) return null;

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Ajustes", href: "/settings" }, { label: "Roles" }]}
        title="Roles y permisos"
        description="Marca qué zonas y qué permisos tiene cada perfil. El superadministrador siempre lo tiene todo, para no quedarse fuera."
      />
      <SettingsAdminNav role={user?.role} />
      <div className="mt-6 overflow-x-auto rounded-[14px] border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="px-4 py-3 text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--text-3)]">Permiso</th>
              {ROLES_CONFIGURABLES.map((rol) => (
                <th key={rol} className="px-3 py-3 text-center text-[13px] font-semibold">
                  {ROLE_LABELS[rol as Role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grupos.map(({ grupo, items }) => (
              <Fragment key={grupo}>
                <tr key={grupo} className="bg-[var(--surface-soft)]">
                  <td colSpan={1 + ROLES_CONFIGURABLES.length} className="px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--text-3)]">
                    {grupo}
                  </td>
                </tr>
                {items.map((permiso) => (
                  <tr key={permiso.id} className="border-t border-[var(--border)]">
                    <td className="px-4 py-3">
                      <p className="text-[14px] font-medium">{permiso.label}</p>
                      <p className="text-[12.5px] text-[var(--text-2)]">{permiso.hint}</p>
                    </td>
                    {ROLES_CONFIGURABLES.map((rol) => (
                      <td key={rol} className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          aria-label={`${permiso.label} para ${ROLE_LABELS[rol as Role]}`}
                          checked={Boolean(borrador[`${rol}:${permiso.id}`])}
                          onChange={(event) => marcar(rol, permiso.id, event.target.checked)}
                          className="h-4 w-4 accent-[var(--accent)]"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-end">
        <Button type="button" onClick={() => void guardar()} disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar permisos"}
        </Button>
      </div>
    </div>
  );
}
