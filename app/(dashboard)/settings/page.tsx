"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
    <div className="animate-[fadeIn_0.3s_ease-out]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
        CRM / Ajustes
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-[2.2rem]">
        Ajustes de cuenta
      </h1>
      <p className="mt-2 max-w-2xl text-base text-neutral-600">
        Gestiona tu sesión, tu rol y la seguridad de acceso.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sesión</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-neutral-500">Email</p>
            <p className="text-base font-medium">{user?.email ?? "—"}</p>
            <p className="mt-3 text-sm text-neutral-500">Rol</p>
            <p className="text-base font-medium capitalize">{user?.role ?? "—"}</p>
            <Button className="mt-4" variant="secondary" onClick={() => signOut()}>
              Cerrar sesión
            </Button>
          </CardContent>
        </Card>

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
      </div>
    </div>
  );
}

