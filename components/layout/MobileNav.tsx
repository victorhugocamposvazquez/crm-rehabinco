"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Building2,
  Search,
  ClipboardPenLine,
  ListTodo,
  CalendarDays,
  FileText,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";
import { navHrefsForRole } from "@/lib/auth/roles";

const navItems = [
  { href: "/", label: "Hoy", icon: Home },
  { href: "/catastro", label: "Catastro", icon: Search },
  { href: "/tareas", label: "Tareas", icon: ListTodo },
  { href: "/calendario", label: "Agenda", icon: CalendarDays },
  { href: "/propiedades", label: "Inmuebles", icon: Building2 },
  { href: "/partes-visita", label: "Visitas", icon: ClipboardPenLine },
  { href: "/facturas", label: "Facturas", icon: FileText },
  { href: "/presupuestos", label: "Presupuestos", icon: ClipboardList },
];

export function MobileNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const items = navHrefsForRole(user?.role, "mobile")
    .map((href) => navItems.find((item) => item.href === href))
    .filter((item): item is (typeof navItems)[number] => Boolean(item));

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/80 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      role="navigation"
      aria-label="Navegación principal"
    >
      <div className="flex h-[4.25rem] items-center justify-evenly px-3 sm:px-4">
        {items.map(({ href, label, icon: Icon }) => {
          const isActive =
            pathname === href ||
            (href === "/catastro" && pathname.startsWith("/buscar")) ||
            (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-1 rounded-xl py-2.5 text-[11px] font-semibold tracking-wide transition-all",
                isActive
                  ? "bg-accent/10 text-accent"
                  : "text-neutral-500 hover:bg-accent/5 hover:text-accent"
              )}
            >
              <Icon
                className="h-6 w-6 shrink-0"
                strokeWidth={1.5}
                aria-hidden
              />
              <span className="truncate px-0.5">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
