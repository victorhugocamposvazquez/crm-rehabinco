"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { puedeVerApisPortales, puedeVerPapelera, type Role } from "@/lib/auth/roles";

const ITEMS = [
  { href: "/settings", label: "Perfil y seguridad", portales: false, papelera: false },
  { href: "/settings#equipo", label: "Equipo", portales: false, papelera: false },
  { href: "/settings/papelera", label: "Papelera de usuarios", portales: false, papelera: true },
  { href: "/settings/empresa", label: "Datos de empresa", portales: false, papelera: false },
  { href: "/settings/emisores-presupuesto", label: "Emisores de presupuesto", portales: false, papelera: false },
  { href: "/settings/portales", label: "APIs de portales", portales: true, papelera: false },
] as const;

export function SettingsAdminNav({ role }: { role?: Role | null }) {
  const pathname = usePathname();
  const items = ITEMS.filter((item) => {
    if (item.portales && !puedeVerApisPortales(role)) return false;
    if (item.papelera && !puedeVerPapelera(role)) return false;
    return true;
  });
  return (
    <nav className="mt-4 flex flex-wrap gap-1 min-[820px]:w-52 min-[820px]:flex-col min-[820px]:float-left min-[820px]:mr-6">
      {items.map((item) => {
        const activo =
          item.href === "/settings" || item.href === "/settings#equipo"
            ? pathname === "/settings"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-[9px] px-3 py-2 text-[13.5px] font-medium",
              activo
                ? "border border-accent bg-accent-soft text-accent-dark"
                : "text-[var(--text-2)] hover:bg-[var(--surface-soft)]"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
