"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Bell, Building2, KeyRound, LogOut, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { isAdmin, puedeVerApisPortales, roleLabel } from "@/lib/auth/roles";
import { AvatarComercial } from "@/components/ui/avatar-comercial";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Ctx = { abrir: () => void; cerrar: () => void };

const MenuPerfilContext = createContext<Ctx | null>(null);

export function useMenuPerfil(): Ctx {
  return useContext(MenuPerfilContext) ?? { abrir: () => undefined, cerrar: () => undefined };
}

export function MenuPerfilProvider({ children }: { children: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const abrir = useCallback(() => setAbierto(true), []);
  const cerrar = useCallback(() => setAbierto(false), []);

  return (
    <MenuPerfilContext.Provider value={{ abrir, cerrar }}>
      {children}
      <MenuPerfilModal abierto={abierto} onCerrar={cerrar} />
    </MenuPerfilContext.Provider>
  );
}

function MenuPerfilModal({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const { user, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!abierto) return;
    const onKey = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abierto, onCerrar]);

  useEffect(() => {
    if (!abierto) {
      setPassword("");
      setConfirmPassword("");
      setPasswordMessage(null);
      setPasswordError(null);
    }
  }, [abierto]);

  const onUpdatePassword = async () => {
    setPasswordError(null);
    setPasswordMessage(null);
    if (password.length < 6) {
      setPasswordError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError("Las contraseñas no coinciden.");
      return;
    }
    setPasswordSaving(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setPasswordSaving(false);
    if (updateError) {
      setPasswordError(updateError.message);
      return;
    }
    setPasswordMessage("Contraseña actualizada correctamente.");
    setPassword("");
    setConfirmPassword("");
  };

  if (!abierto || !mounted || !user) return null;

  const admin = isAdmin(user.role);

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-3 min-[520px]:items-center min-[520px]:p-4">
      <button
        type="button"
        className="velo-flotante absolute inset-0"
        aria-label="Cerrar perfil"
        onClick={onCerrar}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="menu-perfil-titulo"
        className="caja-flotante relative z-[1] flex max-h-[min(36rem,calc(100dvh-1.5rem))] w-full max-w-md flex-col overflow-hidden rounded-[16px]"
      >
        <div className="overflow-y-auto overscroll-contain px-4 pb-5 pt-4">
          <div className="flex items-start gap-3">
            <AvatarComercial nombre={user.nombre} email={user.email} color={user.color} size={48} />
            <div className="min-w-0 flex-1">
              <h2 id="menu-perfil-titulo" className="truncate text-[16px] font-semibold tracking-tight">
                {user.nombre || user.email}
              </h2>
              <p className="truncate text-[13px] text-[var(--text-2)]">{user.email}</p>
              <p className="mt-0.5 text-[12px] text-[var(--text-3)]">{roleLabel(user.role)}</p>
            </div>
            <button
              type="button"
              onClick={onCerrar}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-[var(--text-2)] hover:bg-[var(--surface-soft)] hover:text-foreground"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>

          <div className="mt-5 rounded-[12px] border border-border bg-[var(--surface-soft)] p-3.5">
            <h3 className="mb-3 flex items-center gap-2 text-[13px] font-semibold">
              <KeyRound className="h-4 w-4 text-[var(--text-2)]" strokeWidth={1.6} aria-hidden />
              Cambiar contraseña
            </h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="menu-perfil-password">Nueva contraseña</Label>
                <Input
                  id="menu-perfil-password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="menu-perfil-confirm">Confirmar</Label>
                <Input
                  id="menu-perfil-confirm"
                  type="password"
                  placeholder="Repite la contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              {passwordError ? <p className="text-[12.5px] text-[var(--red)]">{passwordError}</p> : null}
              {passwordMessage ? <p className="text-[12.5px] text-[var(--green)]">{passwordMessage}</p> : null}
              <Button type="button" size="sm" onClick={() => void onUpdatePassword()} disabled={passwordSaving}>
                {passwordSaving ? "Guardando…" : "Actualizar contraseña"}
              </Button>
            </div>
          </div>

          <div className="mt-3 space-y-0.5">
            <Link
              href="/settings"
              onClick={onCerrar}
              className="flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-[14px] font-medium hover:bg-[var(--surface-soft)]"
            >
              <Settings className="h-4 w-4 text-[var(--text-2)]" strokeWidth={1.7} aria-hidden />
              Ajustes de cuenta
            </Link>
            {user.role !== "editor" ? (
              <Link
                href="/settings/avisos"
                onClick={onCerrar}
                className="flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-[14px] font-medium hover:bg-[var(--surface-soft)]"
              >
                <Bell className="h-4 w-4 text-[var(--text-2)]" strokeWidth={1.7} aria-hidden />
                Avisos
              </Link>
            ) : null}
            {admin ? (
              <Link
                href="/settings/empresa"
                onClick={onCerrar}
                className="flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-[14px] font-medium hover:bg-[var(--surface-soft)]"
              >
                <Building2 className="h-4 w-4 text-[var(--text-2)]" strokeWidth={1.7} aria-hidden />
                Datos de empresa
              </Link>
            ) : null}
            {admin ? (
              <Link
                href="/settings/emisores-presupuesto"
                onClick={onCerrar}
                className="flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-[14px] font-medium hover:bg-[var(--surface-soft)]"
              >
                <Building2 className="h-4 w-4 text-[var(--text-2)]" strokeWidth={1.7} aria-hidden />
                Emisores de presupuesto
              </Link>
            ) : null}
            {puedeVerApisPortales(user.role) ? (
              <Link
                href="/settings/portales"
                onClick={onCerrar}
                className="flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-[14px] font-medium hover:bg-[var(--surface-soft)]"
              >
                <KeyRound className="h-4 w-4 text-[var(--text-2)]" strokeWidth={1.7} aria-hidden />
                Captación
              </Link>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => {
              void signOut();
              onCerrar();
            }}
            className="mt-3 flex min-h-11 w-full items-center gap-3 rounded-[10px] px-3 text-left text-[14px] font-medium text-[var(--red)] hover:bg-[var(--red-bg)]"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.7} aria-hidden />
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
