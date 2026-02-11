"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Home, Users, FileText, Settings, LogOut, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";

const navItems = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/facturas", label: "Facturas", icon: FileText },
  { href: "/settings", label: "Ajustes", icon: Settings },
];

export function DesktopNav() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const initials = useMemo(() => {
    const source = user?.email?.split("@")[0] ?? "U";
    const parts = source.split(/[._-]/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }, [user?.email]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <header
      className="sticky top-0 z-40 hidden border-b border-border/80 bg-white/90 backdrop-blur md:block"
      role="banner"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="text-base font-semibold tracking-tight text-foreground"
        >
          CRM Inmobiliario
        </Link>
        <nav
          className="flex items-center gap-1 rounded-xl border border-border bg-neutral-50/70 p-1"
          role="navigation"
          aria-label="Navegación principal"
        >
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive =
              pathname === href ||
              (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
                  isActive
                    ? "bg-white text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.06)]"
                    : "text-neutral-600 hover:bg-white hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        {user && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-2 rounded-full border border-border bg-white px-2 py-1.5 shadow-[0_1px_2px_rgba(16,24,40,0.06)] transition-colors hover:bg-neutral-50"
              aria-label="Abrir menú de sesión"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-white">
                {initials}
              </span>
              <span className="pr-1 text-xs font-semibold uppercase tracking-wide text-neutral-600">
                {user.role === "admin" ? "Admin" : "Agente"}
              </span>
            </button>

            {open && (
              <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-border bg-white p-2 shadow-[0_14px_28px_rgba(16,24,40,0.12)]">
                <div className="mb-2 rounded-xl bg-neutral-50 px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Sesión iniciada
                  </p>
                  <p className="mt-0.5 truncate text-sm font-medium text-foreground">{user.email}</p>
                </div>
                <Link
                  href="/settings"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                >
                  <KeyRound className="h-4 w-4" />
                  Cambiar contraseña
                </Link>
                <button
                  onClick={() => signOut()}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
