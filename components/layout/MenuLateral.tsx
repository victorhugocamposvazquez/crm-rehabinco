"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { navHrefsForRole, type Role } from "@/lib/auth/roles";
import { itemsDesdeHrefs, navItemActivo } from "./nav-items";

export function MenuLateral({
  abierta,
  onCerrar,
  role,
}: {
  abierta: boolean;
  onCerrar: () => void;
  role: Role | null | undefined;
}) {
  const pathname = usePathname();
  const items = itemsDesdeHrefs(navHrefsForRole(role, "desktop"));

  return (
    <Sheet open={abierta} onOpenChange={(open) => !open && onCerrar()} variant="side" side="left" showCloseButton>
      <nav
        className="h-full overflow-y-auto overscroll-contain px-4 pb-8 pt-[max(3.5rem,calc(env(safe-area-inset-top)+2.75rem))]"
        aria-label="Menú de la aplicación"
      >
        <h2 className="mb-5 px-2 text-xl font-semibold">Menú</h2>
        <ul className="space-y-1">
          {items.map(({ href, label, icon: Icon }) => {
            const activa = navItemActivo(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onCerrar}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium transition-colors",
                    activa
                      ? "bg-accent/10 text-accent"
                      : "text-foreground hover:bg-neutral-50"
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" strokeWidth={1.5} aria-hidden />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </Sheet>
  );
}
