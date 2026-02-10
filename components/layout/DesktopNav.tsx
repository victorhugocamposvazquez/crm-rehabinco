"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";

const navItems = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/facturas", label: "Facturas", icon: FileText },
];

export function DesktopNav() {
  const pathname = usePathname();
  const { user } = useAuth();

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
          <span className="rounded-full border border-border bg-neutral-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
            {user.role === "admin" ? "Admin" : "Agente"}
          </span>
        )}
      </div>
    </header>
  );
}
