"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";
import { AvatarComercial } from "@/components/ui/avatar-comercial";
import { SupportTrigger } from "@/components/support/SupportTrigger";
import { BusquedaGlobal } from "./BusquedaGlobal";
import { NuevoMenu } from "./NuevoMenu";
import { AvisosBarra } from "./AvisosBarra";
import { useMenuPerfil } from "./MenuPerfil";

export const RUTA_LANZADOR = "/inicio";

/**
 * Barra superior del diseño Aire: 56 px, marca a la izquierda y acciones
 * redondas a la derecha. Sustituye al menú lateral; los módulos se abren
 * desde el lanzador (/inicio).
 */
export function BarraAire() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { abrir: abrirPerfil } = useMenuPerfil();
  const enLanzador = pathname === RUTA_LANZADOR;

  return (
    <header
      className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-3 min-[820px]:gap-3 min-[820px]:px-5"
      data-testid="barra-aire"
    >
      <Link href={RUTA_LANZADOR} className="flex h-10 shrink-0 items-center" aria-label="Rehabinco, inicio">
        <img src="/images/logo-web.png" alt="Rehabinco" className="marca-rehabinco h-6 w-auto object-contain" />
      </Link>
      <span className="ml-auto shrink-0">
        <BusquedaGlobal />
      </span>
      <Link
        href={RUTA_LANZADOR}
        aria-label="Módulos"
        title="Módulos"
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--text-2)] hover:bg-[var(--accent-soft)] hover:text-foreground",
          enLanzador && "bg-[var(--accent-soft)] text-foreground"
        )}
      >
        <LayoutGrid className="h-[18px] w-[18px]" strokeWidth={1.9} aria-hidden />
      </Link>
      <span className="shrink-0">
        <SupportTrigger />
      </span>
      <span className="shrink-0">
        <AvisosBarra />
      </span>
      <span className="hidden shrink-0 min-[820px]:inline">
        <NuevoMenu />
      </span>
      {user ? (
        <button
          type="button"
          onClick={abrirPerfil}
          className="ml-1 shrink-0 rounded-full"
          title={`${user.nombre || user.email}`}
          aria-label={user.nombre || user.email || "Perfil"}
        >
          <AvatarComercial nombre={user.nombre} email={user.email} color={user.color} size={32} />
        </button>
      ) : null}
    </header>
  );
}
