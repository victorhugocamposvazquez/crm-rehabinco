"use client";

import { usePathname } from "next/navigation";
import { breadcrumbDeRuta } from "./nav-items";
import { BusquedaGlobal } from "./BusquedaGlobal";
import { NuevoMenu } from "./NuevoMenu";

export function AppTopBar() {
  const pathname = usePathname();
  const { seccion, detalle } = breadcrumbDeRuta(pathname);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-white px-4 min-[820px]:px-6">
      <nav aria-label="Breadcrumb" className="min-w-0 flex-1 truncate text-[13.5px]">
        <span className="text-[var(--text-2)]">{seccion}</span>
        {detalle && (
          <>
            <span className="mx-1.5 text-[var(--text-3)]">›</span>
            <span className="font-semibold text-foreground">{detalle}</span>
          </>
        )}
      </nav>
      <BusquedaGlobal />
      <NuevoMenu />
    </header>
  );
}
