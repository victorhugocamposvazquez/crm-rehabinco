"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock3, List, Map, Search, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { CarrilHorizontal } from "@/components/ui/carril-horizontal";
import { isAdmin, isComercial } from "@/lib/auth/roles";
import { useAuth } from "@/lib/auth/auth-context";
import {
  RUTA_EXPLORER,
  RUTA_HISTORICO,
  destinoResultadosCatastro,
  leerRutaResultados,
  recordarResultadosPorId,
  recordarRutaResultados,
} from "@/lib/catastro/explorer/history-ui";

export const RUTA_EQUIPO_CATASTRO = "/catastro/equipo";
export const RUTA_COBERTURA_CATASTRO = "/catastro/cobertura";

export function CatastroSubnav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const admin = isAdmin(user?.role);
  const comercial = isComercial(user?.role);
  const [ultima, setUltima] = useState<string | null>(null);

  useEffect(() => {
    if (!admin) return;
    recordarRutaResultados(pathname);
    const local = leerRutaResultados();
    setUltima(local);
    if (local) return;
    let vivo = true;
    void fetch("/api/catastro/searches/recent?limit=1")
      .then(async (respuesta) => {
        const json = (await respuesta.json()) as { ok?: boolean; searches?: Array<{ id?: string }> };
        const id = json.searches?.[0]?.id?.trim() ?? "";
        if (!vivo || !respuesta.ok || !json.ok || !id) return;
        recordarResultadosPorId(id);
        setUltima(leerRutaResultados());
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [pathname, admin]);

  const resultados = destinoResultadosCatastro(pathname, ultima);
  if (!user) return null;
  const items = comercial
    ? [
        {
          href: RUTA_EXPLORER,
          label: "Tus fincas",
          icon: List,
          activa: pathname === RUTA_EXPLORER || pathname.startsWith(`${RUTA_EXPLORER}/finca/`),
        },
      ]
    : [
        {
          href: RUTA_EXPLORER,
          label: "Buscar",
          icon: Search,
          activa: pathname === RUTA_EXPLORER || pathname.startsWith(`${RUTA_EXPLORER}/finca/`),
        },
        {
          href: resultados.href,
          label: "Resultados",
          icon: List,
          activa: resultados.activa,
        },
        {
          href: RUTA_HISTORICO,
          label: "Historial",
          icon: Clock3,
          activa: pathname === RUTA_HISTORICO,
        },
        {
          href: RUTA_EQUIPO_CATASTRO,
          label: "Equipo",
          icon: Users,
          activa: pathname.startsWith(RUTA_EQUIPO_CATASTRO),
        },
        {
          href: RUTA_COBERTURA_CATASTRO,
          label: "Cobertura",
          icon: Map,
          activa: pathname.startsWith(RUTA_COBERTURA_CATASTRO),
        },
      ];

  return (
    <nav
      className="sticky top-14 z-30 -mx-3.5 -mt-5 mb-6 border-b border-[var(--border)] bg-[var(--surface)]/95 px-1 backdrop-blur min-[820px]:-mx-6 min-[820px]:-mt-6 min-[820px]:px-4"
      aria-label="Catastro"
    >
      <CarrilHorizontal trackClassName="min-[780px]:gap-6">
        {items.map((item) => {
          const Icono = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "relative flex min-h-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap px-3 py-3 text-[13.5px] font-medium min-[780px]:justify-start min-[780px]:px-1 min-[780px]:text-base",
                item.activa ? "text-foreground" : "text-[var(--text-2)] hover:text-foreground"
              )}
            >
              <Icono className="h-4 w-4" strokeWidth={1.9} aria-hidden />
              {item.label}
              {item.activa ? <span className="absolute inset-x-2 -bottom-px h-[3px] bg-foreground min-[780px]:inset-x-0" /> : null}
            </Link>
          );
        })}
      </CarrilHorizontal>
    </nav>
  );
}
