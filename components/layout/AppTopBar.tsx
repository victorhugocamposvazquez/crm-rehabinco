"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { breadcrumbDeRuta } from "./nav-items";
import { BusquedaGlobal } from "./BusquedaGlobal";
import { NuevoMenu } from "./NuevoMenu";
import { useAuth } from "@/lib/auth/auth-context";
import { AvatarComercial } from "@/components/ui/avatar-comercial";

export function AppTopBar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { seccion, detalle } = breadcrumbDeRuta(pathname);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-white px-4 min-[820px]:px-6">
      {user ? (
        <Link
          href="/settings"
          className="flex min-w-0 flex-1 items-center gap-2 min-[820px]:hidden"
          title={`${user.nombre || user.email} · ${user.role}`}
        >
          <AvatarComercial nombre={user.nombre} email={user.email} color={user.color} size={30} />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[13px] font-semibold">{user.nombre?.split(" ")[0] || user.email}</span>
          </span>
        </Link>
      ) : null}
      <nav aria-label="Breadcrumb" className="hidden min-w-0 flex-1 truncate text-[13.5px] min-[820px]:block">
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
