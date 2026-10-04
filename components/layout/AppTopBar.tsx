"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { breadcrumbDeRuta } from "./nav-items";
import { BusquedaGlobal } from "./BusquedaGlobal";
import { NuevoMenu } from "./NuevoMenu";
import { useAuth } from "@/lib/auth/auth-context";
import { editorHomePath, isEditor } from "@/lib/auth/roles";
import { AvatarComercial } from "@/components/ui/avatar-comercial";
import { InterruptorTema } from "@/components/ui/InterruptorTema";
import { AvisosBarra } from "./AvisosBarra";

export function AppTopBar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { seccion, detalle } = breadcrumbDeRuta(pathname);
  const inicio = isEditor(user?.role) ? editorHomePath() : "/";

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b border-border bg-[var(--surface)] px-3 min-[820px]:h-14 min-[820px]:gap-3 min-[820px]:px-6">
      <Link href={inicio} className="grid h-11 w-11 shrink-0 place-items-center min-[820px]:hidden" aria-label="Inicio">
        <img src="/images/icono.png" alt="" className="h-9 w-9 rounded-[9px] object-contain dark:invert" />
      </Link>
      <nav aria-label="Breadcrumb" className="hidden min-w-0 flex-1 truncate text-[13.5px] min-[820px]:block">
        <span className="text-[var(--text-2)]">{seccion}</span>
        {detalle && (
          <>
            <span className="mx-1.5 text-[var(--text-3)]">›</span>
            <span className="font-semibold text-foreground">{detalle}</span>
          </>
        )}
      </nav>
      <span className="ml-auto shrink-0 min-[820px]:order-1 min-[820px]:ml-0">
        <BusquedaGlobal />
      </span>
      <span className="shrink-0 min-[820px]:order-2">
        <AvisosBarra />
      </span>
      <span className="shrink-0 min-[820px]:order-3">
        <InterruptorTema compacto />
      </span>
      <span className="shrink-0 min-[820px]:order-4">
        <NuevoMenu />
      </span>
      {user ? (
        <Link
          href="/settings"
          className="ml-1.5 shrink-0 min-[820px]:hidden"
          title={`${user.nombre || user.email} · ${user.role}`}
          aria-label={user.nombre || user.email || "Perfil"}
        >
          <AvatarComercial nombre={user.nombre} email={user.email} color={user.color} size={30} />
        </Link>
      ) : null}
    </header>
  );
}
