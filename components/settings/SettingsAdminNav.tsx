"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { CarrilHorizontal } from "@/components/ui/carril-horizontal";
import { isSuperAdmin, puedeVerApisPortales, puedeVerPapelera, type Role } from "@/lib/auth/roles";

const ITEMS = [
  { href: "/settings", label: "Perfil y seguridad", portales: false, papelera: false, superadmin: false },
  { href: "/settings#sistema-avisos", label: "Sistema de avisos", portales: false, papelera: false, superadmin: true },
  { href: "/settings#equipo", label: "Equipo", portales: false, papelera: false, superadmin: false },
  { href: "/settings/papelera", label: "Papelera de usuarios", portales: false, papelera: true, superadmin: false },
  { href: "/settings/empresa", label: "Datos de empresa", portales: false, papelera: false, superadmin: false },
  { href: "/settings/emisores-presupuesto", label: "Emisores de presupuesto", portales: false, papelera: false, superadmin: false },
  { href: "/settings/portales", label: "Captación", portales: true, papelera: false, superadmin: false },
] as const;

export function SettingsAdminNav({ role }: { role?: Role | null }) {
  const pathname = usePathname();
  const [hash, setHash] = useState("");
  useEffect(() => {
    const leer = () => setHash(window.location.hash);
    leer();
    window.addEventListener("hashchange", leer);
    return () => window.removeEventListener("hashchange", leer);
  }, [pathname]);
  const items = ITEMS.filter((item) => {
    if (item.portales && !puedeVerApisPortales(role)) return false;
    if (item.papelera && !puedeVerPapelera(role)) return false;
    if (item.superadmin && !isSuperAdmin(role)) return false;
    return true;
  });
  const anclasSettings = new Set(["#equipo", "#sistema-avisos"]);
  return (
    <CarrilHorizontal
      role="navigation"
      label="Ajustes"
      className="mt-4 min-[820px]:float-left min-[820px]:mr-6 min-[820px]:w-52"
      trackClassName="gap-1 min-[820px]:flex-col"
    >
      {items.map((item) => {
        const ancla = item.href.includes("#") ? item.href.slice(item.href.indexOf("#")) : "";
        const activo = ancla
          ? pathname === "/settings" && hash === ancla
          : item.href === "/settings"
            ? pathname === "/settings" && !anclasSettings.has(hash)
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setHash(ancla)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-[9px] px-3 py-2 text-[13.5px] font-medium min-[820px]:w-full min-[820px]:whitespace-normal",
              activo
                ? "border border-accent bg-accent-soft text-accent-dark"
                : "text-[var(--text-2)] hover:bg-[var(--surface-soft)]"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </CarrilHorizontal>
  );
}
