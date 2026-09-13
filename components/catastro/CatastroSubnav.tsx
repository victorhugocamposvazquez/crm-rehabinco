"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock3, List, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { RUTA_EXPLORER, RUTA_HISTORICO } from "@/lib/catastro/explorer/history-ui";

function rutaResultados(pathname: string) {
  if (/^\/catastro\/searches\/[^/]+$/.test(pathname)) return pathname;
  return `${RUTA_EXPLORER}#resultados`;
}

export function CatastroSubnav() {
  const pathname = usePathname();
  const resultados = rutaResultados(pathname);
  const items = [
    {
      href: RUTA_EXPLORER,
      label: "Buscar",
      icon: Search,
      activa: pathname === RUTA_EXPLORER || pathname.startsWith(`${RUTA_EXPLORER}/finca/`),
    },
    {
      href: resultados,
      label: "Resultados",
      icon: List,
      activa: /^\/catastro\/searches\/[^/]+$/.test(pathname),
    },
    {
      href: RUTA_HISTORICO,
      label: "Historial",
      icon: Clock3,
      activa: pathname === RUTA_HISTORICO,
    },
  ] as const;

  return (
    <nav className="-mx-4 mb-6 border-b border-[#E6E3DD] bg-white px-4 sm:-mx-6 sm:px-6" aria-label="Catastro">
      <div className="flex gap-6">
        {items.map((item) => {
          const Icono = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "relative flex items-center gap-1.5 py-3 text-base font-medium",
                item.activa ? "text-[#0B7461]" : "text-[#5D6B67] hover:text-[#0B7461]"
              )}
            >
              <Icono className="h-4 w-4" strokeWidth={1.9} aria-hidden />
              {item.label}
              {item.activa ? <span className="absolute inset-x-0 -bottom-px h-[3px] bg-[#0B7461]" /> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
