"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock3, List, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  RUTA_EXPLORER,
  RUTA_HISTORICO,
  destinoResultadosCatastro,
  leerRutaResultados,
  recordarResultadosPorId,
  recordarRutaResultados,
} from "@/lib/catastro/explorer/history-ui";

export function CatastroSubnav() {
  const pathname = usePathname();
  const [ultima, setUltima] = useState<string | null>(null);

  useEffect(() => {
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
  }, [pathname]);

  const resultados = destinoResultadosCatastro(pathname, ultima);
  const items = [
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
  ] as const;

  return (
    <nav
      className="sticky top-14 z-30 -mx-4 -mt-6 mb-6 border-b border-[#E6E3DD] bg-white/95 px-2 backdrop-blur sm:top-16 sm:-mx-6 sm:-mt-8 sm:px-6 lg:-mx-8 lg:px-8"
      aria-label="Catastro"
    >
      <div className="flex min-[780px]:gap-6">
        {items.map((item) => {
          const Icono = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "relative flex min-h-11 flex-1 items-center justify-center gap-1.5 py-3 text-[13.5px] font-medium min-[780px]:flex-none min-[780px]:justify-start min-[780px]:text-base",
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
