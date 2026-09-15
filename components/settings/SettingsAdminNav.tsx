"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/settings", label: "Perfil y seguridad" },
  { href: "/settings#equipo", label: "Equipo" },
  { href: "/settings/empresa", label: "Datos de empresa" },
  { href: "/settings/emisores-presupuesto", label: "Emisores de presupuesto" },
  { href: "/settings/portales", label: "APIs de portales" },
] as const;

export function SettingsAdminNav() {
  const pathname = usePathname();
  return (
    <nav className="mt-4 flex flex-wrap gap-1 min-[820px]:w-52 min-[820px]:flex-col min-[820px]:float-left min-[820px]:mr-6">
      {ITEMS.map((item) => {
        const activo = item.href === "/settings" ? pathname === "/settings" : pathname === item.href;
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
