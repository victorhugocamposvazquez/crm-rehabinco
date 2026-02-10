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
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      role="navigation"
      aria-label="Navegación principal"
    >
      <div className="flex h-16 items-center justify-around">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            pathname === href ||
            (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg px-4 py-2 text-xs font-medium transition-colors",
                isActive
                  ? "text-foreground"
                  : "text-neutral-500 hover:text-foreground"
              )}
            >
              <Icon
                className={cn("h-6 w-6", isActive && "stroke-[2.5px]")}
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
