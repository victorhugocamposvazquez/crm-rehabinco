"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";
import { solicitarCrearUsuario } from "@/lib/actions/papelera";
import {
  ROLE_LABELS,
  ROLES_CREABLES,
  isAdmin,
  isSuperAdmin,
  puedeSolicitarUsuarios,
  puedeVerApisPortales,
  puedeVerPapelera,
  roleLabel,
  type Role,
} from "@/lib/auth/roles";
import { UserPlus, Building2, KeyRound, Trash2 } from "lucide-react";
import { PerfilComercialCard } from "@/components/settings/PerfilComercialCard";
import { EquipoComercialesCard } from "@/components/settings/EquipoComercialesCard";
import { SettingsAdminNav } from "@/components/settings/SettingsAdminNav";
import { TokenExtensionCard } from "@/components/settings/TokenExtensionCard";
import { AvisosPwaCard } from "@/components/pwa/AvisosPwa";

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserConfirmPassword, setNewUserConfirmPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<Role>("comercial");
  const [createUserMessage, setCreateUserMessage] = useState<string | null>(null);
  const [createUserError, setCreateUserError] = useState<string | null>(null);
  const [createUserSaving, setCreateUserSaving] = useState(false);
  const [equipoTick, setEquipoTick] = useState(0);
  const direccion = isAdmin(user?.role);
  const superadmin = isSuperAdmin(user?.role);
  const puedeUsuarios = puedeSolicitarUsuarios(user?.role);

  const onUpdatePassword = async () => {
    setError(null);
    setMessage(null);
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setMessage("Contraseña actualizada correctamente.");
    setPassword("");
    setConfirmPassword("");
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Ajustes", href: "/settings" }]}
        title="Ajustes"
        description="Perfil, equipo y empresa. El superadministrador también crea usuarios y configura la captación."
      />
      {direccion ? <SettingsAdminNav role={user?.role} /> : null}

      <div id="perfil" className="mt-8 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sesión</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-neutral-500">Email</p>
            <p className="text-base font-medium">{user?.email ?? "—"}</p>
            <p className="mt-3 text-sm text-neutral-500">Rol</p>
            <p className="text-base font-medium">{roleLabel(user?.role)}</p>
            <Button className="mt-4" variant="secondary" onClick={() => signOut()}>
              Cerrar sesión
            </Button>
          </CardContent>
        </Card>

        {user?.id && user.role !== "editor" && <PerfilComercialCard userId={user.id} />}
        {user?.id && user.role !== "editor" ? <TokenExtensionCard userId={user.id} /> : null}
        {user?.id && user.role !== "editor" && <AvisosPwaCard />}
        {direccion && (
          <div id="equipo" className="contents">
            <EquipoComercialesCard role={user?.role} tick={equipoTick} />
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Cambiar contraseña</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nueva contraseña</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar contraseña</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {message && <p className="text-sm text-emerald-700">{message}</p>}
            <Button onClick={onUpdatePassword} disabled={saving}>
              {saving ? "Guardando..." : "Actualizar contraseña"}
            </Button>
          </CardContent>
        </Card>

        {direccion && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" strokeWidth={1.5} />
                Datos de empresa (facturación)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-600">
                Razón social, dirección, IBAN y número de cuenta que salen al imprimir facturas.
              </p>
              <Button className="mt-4" variant="secondary" asChild>
                <Link href="/settings/empresa">Editar datos de empresa</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {direccion && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" strokeWidth={1.5} />
                Emisores de presupuesto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-600">
                Rehabinco S.L. y Garal: logotipo y datos fiscales que salen al generar el PDF del
                presupuesto.
              </p>
              <Button className="mt-4" variant="secondary" asChild>
                <Link href="/settings/emisores-presupuesto">Editar emisores de presupuesto</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {puedeVerPapelera(user?.role) && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5" strokeWidth={1.5} />
                Papelera de usuarios
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-600">
                Altas y bajas de usuarios solicitadas por administradores. Los documentos de
                Herramientas tienen su papelera en cada sección.
              </p>
              <Button className="mt-4" variant="secondary" asChild>
                <Link href="/settings/papelera">Abrir papelera de usuarios</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {puedeVerApisPortales(user?.role) && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" strokeWidth={1.5} />
                Captación
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-600">
                Zonas de Idealista y el gasto de Bright Data. Solo lo ve el superadministrador.
              </p>
              <Button className="mt-4" variant="secondary" asChild>
                <Link href="/settings/portales">Elegir zonas de Captación</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {puedeUsuarios && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" strokeWidth={1.5} />
                Crear usuario
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!superadmin ? (
                <p className="mb-4 text-sm text-neutral-600">
                  La solicitud irá a la papelera del superadministrador para que la confirme.
                </p>
              ) : null}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setCreateUserError(null);
                  setCreateUserMessage(null);
                  if (newUserPassword.length < 6) {
                    setCreateUserError("La contraseña debe tener al menos 6 caracteres.");
                    return;
                  }
                  if (newUserPassword !== newUserConfirmPassword) {
                    setCreateUserError("Las contraseñas no coinciden.");
                    return;
                  }
                  setCreateUserSaving(true);
                  const result = await solicitarCrearUsuario(newUserEmail, newUserPassword, newUserRole);
                  setCreateUserSaving(false);
                  if (result.ok) {
                    setCreateUserMessage(result.message ?? "Usuario creado.");
                    setNewUserEmail("");
                    setNewUserPassword("");
                    setNewUserConfirmPassword("");
                    if (superadmin) setEquipoTick((n) => n + 1);
                  } else {
                    setCreateUserError(result.error);
                  }
                }}
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="new-user-email">Email</Label>
                  <Input
                    id="new-user-email"
                    type="email"
                    placeholder="usuario@ejemplo.com"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-user-password">Contraseña</Label>
                  <Input
                    id="new-user-password"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-user-confirm">Confirmar contraseña</Label>
                  <Input
                    id="new-user-confirm"
                    type="password"
                    placeholder="Repite la contraseña"
                    value={newUserConfirmPassword}
                    onChange={(e) => setNewUserConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-user-role">Rol</Label>
                  <select
                    id="new-user-role"
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as Role)}
                    className="flex h-10 w-full rounded-lg border border-border bg-white px-4 py-2 text-base"
                  >
                    {ROLES_CREABLES.map((rol) => (
                      <option key={rol} value={rol}>
                        {ROLE_LABELS[rol]}
                      </option>
                    ))}
                  </select>
                  {newUserRole === "editor" && (
                    <p className="text-xs text-neutral-500">
                      Solo crea presupuestos. El emisor queda fijado en Garal.
                    </p>
                  )}
                </div>
                <div className="space-y-2 sm:col-span-2 lg:col-span-4">
                  {createUserError && <p className="text-sm text-red-600">{createUserError}</p>}
                  {createUserMessage && <p className="text-sm text-emerald-700">{createUserMessage}</p>}
                  <Button type="submit" disabled={createUserSaving}>
                    {createUserSaving ? "Enviando…" : superadmin ? "Crear usuario" : "Solicitar alta"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

