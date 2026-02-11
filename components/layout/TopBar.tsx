"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { Home, Users, FileText, Settings, LogOut, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";
import { Sheet } from "@/components/ui/sheet";

const navItems = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/facturas", label: "Facturas", icon: FileText },
  { href: "/settings", label: "Ajustes", icon: Settings },
];

export function TopBar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);

  const initials = useMemo(() => {
    const source = user?.email?.split("@")[0] ?? "U";
    const parts = source.split(/[._-]/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }, [user?.email]);

  return (
    <>
      <header
        className="sticky top-0 z-40 border-b border-border/80 bg-white/95 backdrop-blur"
        role="banner"
      >
        <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center justify-between gap-3 px-4 sm:h-16 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2"
            aria-label="REHABINCO - Inicio"
          >
            <img
              src="/images/logo-web.png"
              alt=""
              className="h-8 w-auto object-contain sm:h-9"
            />
          </Link>

          <nav
            className="hidden items-center gap-1 rounded-xl border border-border bg-neutral-50/70 p-1 md:flex"
            role="navigation"
            aria-label="Navegación principal"
          >
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive =
                pathname === href || (href !== "/" && pathname.startsWith(href));
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
                  <Icon className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>

          {user && (
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-white px-2 py-1.5 shadow-[0_1px_2px_rgba(16,24,40,0.06)] transition-colors hover:bg-neutral-50 active:scale-[0.98]"
              aria-label="Abrir sesión y ajustes"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-white">
                {initials}
              </span>
              <span className="hidden pr-1 text-xs font-semibold uppercase tracking-wide text-neutral-600 sm:inline">
                {user.role === "admin" ? "Admin" : "Agente"}
              </span>
            </button>
          )}
        </div>
      </header>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <div className="px-4 pb-24 pt-2 md:pb-6">
          <div className="mb-4 rounded-2xl bg-neutral-50 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Sesión iniciada
            </p>
            <p className="mt-1 truncate text-base font-semibold text-foreground">
              {user?.email ?? "—"}
            </p>
            <p className="mt-0.5 text-sm capitalize text-neutral-500">
              {user?.role === "admin" ? "Administrador" : "Agente"}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <Link
              href="/settings"
              onClick={() => setSheetOpen(false)}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-medium text-foreground transition-colors hover:bg-neutral-50"
            >
              <KeyRound className="h-5 w-5 text-neutral-500" strokeWidth={1.5} />
              Cambiar contraseña
            </Link>
            <button
              type="button"
              onClick={() => {
                signOut();
                setSheetOpen(false);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[15px] font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              <LogOut className="h-5 w-5" strokeWidth={1.5} />
              Cerrar sesión
            </button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
