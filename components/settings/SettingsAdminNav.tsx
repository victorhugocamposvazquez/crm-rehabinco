"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { puedeVerApisPortales, type Role } from "@/lib/auth/roles";

const ITEMS = [
  { href: "/settings", label: "Perfil y seguridad", portales: false },
  { href: "/settings#equipo", label: "Equipo", portales: false },
  { href: "/settings/empresa", label: "Datos de empresa", portales: false },
  { href: "/settings/emisores-presupuesto", label: "Emisores de presupuesto", portales: false },
  { href: "/settings/portales", label: "APIs de portales", portales: true },
] as const;

export function SettingsAdminNav({ role }: { role?: Role | null }) {
  const pathname = usePathname();
  const items = ITEMS.filter((item) => !item.portales || puedeVerApisPortales(role));
  return (
    <nav className="mt-4 flex flex-wrap gap-1 min-[820px]:w-52 min-[820px]:flex-col min-[820px]:float-left min-[820px]:mr-6">
      {items.map((item) => {
        const activo = item.href === "/settings" || item.href === "/settings#equipo" ? pathname === "/settings" : pathname === item.href;
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
