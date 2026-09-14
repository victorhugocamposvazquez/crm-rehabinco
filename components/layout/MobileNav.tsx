"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";
import { navHrefsForRole, roleLabel } from "@/lib/auth/roles";
import { Sheet } from "@/components/ui/sheet";
import { AvatarComercial } from "@/components/ui/avatar-comercial";
import { itemsDesdeHrefs, NAV_MOBILE_LABEL, navItemActivo } from "./nav-items";

export function MobileNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [mas, setMas] = useState(false);
  const items = itemsDesdeHrefs(navHrefsForRole(user?.role, "mobile"));
  const resto = itemsDesdeHrefs(navHrefsForRole(user?.role, "desktop")).filter(
    (item) => !items.some((visible) => visible.href === item.href) || item.href === "/settings"
  );

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-white pb-[env(safe-area-inset-bottom)] min-[820px]:hidden"
        role="navigation"
        aria-label="Navegación principal"
      >
        <div className="flex h-[4.25rem] items-center justify-evenly px-2">
          {items.map(({ href, label, icon: Icon }) => {
            const esMas = href === "/settings" && user?.role === "admin";
            const isActive = esMas
              ? mas || (!navHrefsForRole(user?.role, "mobile").some((item) => item !== "/settings" && navItemActivo(pathname, item)) && navItemActivo(pathname, href))
              : navItemActivo(pathname, href);
            const texto = NAV_MOBILE_LABEL[href] ?? label;
            if (esMas) {
              return (
                <button
                  key="mas"
                  type="button"
                  onClick={() => setMas(true)}
                  className={cn(
                    "flex min-h-11 min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-1 rounded-xl py-2 text-[11px] font-semibold",
                    isActive ? "bg-accent-soft text-accent" : "text-[var(--text-2)]"
                  )}
                >
                  <MoreHorizontal className="h-[17px] w-[17px] shrink-0" strokeWidth={1.9} />
                  <span className="truncate px-0.5">Más</span>
                </button>
              );
            }
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex min-h-11 min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-1 rounded-xl py-2 text-[11px] font-semibold",
                  isActive ? "bg-accent-soft text-accent" : "text-[var(--text-2)]"
                )}
              >
                <Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={1.9} aria-hidden />
                <span className="truncate px-0.5">{texto}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      <Sheet open={mas} onOpenChange={setMas} variant="side" side="left" showCloseButton>
        <nav className="px-4 pb-8 pt-[max(3.5rem,calc(env(safe-area-inset-top)+2.75rem))]" aria-label="Más destinos">
          {user ? (
            <Link
              href="/settings"
              onClick={() => setMas(false)}
              className="mb-5 flex items-center gap-3 rounded-[12px] bg-[var(--surface-soft)] px-3 py-3"
            >
              <AvatarComercial nombre={user.nombre} email={user.email} color={user.color} size={40} />
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[15px] font-semibold">{user.nombre || user.email}</span>
                <span className="block text-[12.5px] text-[var(--text-2)]">{roleLabel(user.role)}</span>
              </span>
            </Link>
          ) : null}
          <h2 className="mb-3 px-2 text-xl font-semibold">Más</h2>
          <ul className="space-y-1">
            {resto.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setMas(false)}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-[9px] px-3 py-3 text-[15px] font-medium",
                    navItemActivo(pathname, href) ? "bg-accent-soft text-accent" : "text-foreground hover:bg-[var(--surface-soft)]"
                  )}
                >
                  <Icon size={17} strokeWidth={1.9} />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Sheet>
    </>
  );
}
