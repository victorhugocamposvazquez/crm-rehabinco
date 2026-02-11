"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/facturas", label: "Facturas", icon: FileText },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/80 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      role="navigation"
      aria-label="Navegación principal"
    >
      <div className="flex h-[4.25rem] items-center justify-around px-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            pathname === href ||
            (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-w-[78px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-[11px] font-semibold tracking-wide transition-all",
                isActive
                  ? "bg-neutral-100 text-foreground"
                  : "text-neutral-500 hover:text-foreground"
              )}
            >
              <Icon
                className="h-6 w-6"
                strokeWidth={1.5}
                aria-hidden
              />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
