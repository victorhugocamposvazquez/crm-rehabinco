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
      className="sticky top-0 z-40 hidden border-b border-border bg-white md:block"
      role="banner"
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-foreground"
        >
          CRM Inmobiliario
        </Link>
        <nav
          className="flex items-center gap-1"
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
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-neutral-100 text-foreground"
                    : "text-neutral-600 hover:bg-neutral-50 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        {user && (
          <span className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-600">
            {user.role === "admin" ? "Admin" : "Agente"}
          </span>
        )}
      </div>
    </header>
  );
}
