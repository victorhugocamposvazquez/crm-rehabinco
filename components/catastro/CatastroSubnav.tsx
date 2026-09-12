"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { RUTA_EXPLORER, RUTA_HISTORICO } from "@/lib/catastro/explorer/history-ui";

function activa(pathname: string, href: string) {
  if (href === RUTA_HISTORICO) {
    return pathname === RUTA_HISTORICO || pathname.startsWith(`${RUTA_HISTORICO}/`);
  }
  if (href === RUTA_EXPLORER) {
    return pathname === RUTA_EXPLORER || pathname.startsWith(`${RUTA_EXPLORER}/finca/`);
  }
  return false;
}

const items = [
  { href: RUTA_EXPLORER, label: "Buscar" },
  { href: RUTA_HISTORICO, label: "Historial" },
] as const;

export function CatastroSubnav() {
  const pathname = usePathname();
  return (
    <nav
      className="mb-6 flex flex-wrap gap-2 rounded-xl border border-border bg-neutral-50/80 p-1"
      aria-label="Catastro"
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            activa(pathname, item.href)
              ? "bg-white text-accent shadow-sm"
              : "text-neutral-600 hover:bg-white/70 hover:text-accent"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
