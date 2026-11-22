"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { useHrefsNav } from "@/lib/auth/permisos-context";
import { gruposNavParaRol } from "@/components/layout/nav-items";
import { DESCRIPCION_MODULO } from "@/components/layout/lanzador";

/** Lanzador de módulos del diseño Aire: una tarjeta por módulo, agrupadas. */
export default function LanzadorPage() {
  const { user } = useAuth();
  const permitidos = useHrefsNav("desktop");
  const grupos = gruposNavParaRol(user?.role, permitidos);
  const nombre = (user?.nombre || "").split(" ")[0];

  return (
    <div className="mx-auto max-w-[1080px] pb-10 pt-4 min-[820px]:pt-10" data-testid="lanzador">
      <h1 className="mb-8 text-center text-2xl font-normal text-[var(--titulo,var(--foreground))] min-[820px]:mb-10 min-[820px]:text-4xl min-[820px]:leading-tight">
        {nombre ? `${nombre}, ¿por dónde seguimos?` : "¿Por dónde seguimos?"}
      </h1>
      <div className="flex flex-col gap-8">
        {grupos.map((grupo) => (
          <section key={grupo.label}>
            <h2 className="mb-3 text-[13px] font-medium uppercase tracking-wide text-[var(--text-3)]">{grupo.label}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {grupo.items.map((item) => {
                const Icono = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex min-h-[120px] flex-col gap-2 rounded-[8px] border border-transparent bg-[var(--surface)] px-3 pb-4 pt-2.5 shadow-[var(--sombra-aire)] hover:border-[var(--border-strong)]"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--accent-soft)] text-foreground transition-colors group-hover:bg-[var(--accent)] group-hover:text-[var(--accent-foreground)]">
                      <Icono className="h-5 w-5" strokeWidth={1.8} aria-hidden />
                    </span>
                    <span className="text-sm font-semibold text-[var(--titulo,var(--foreground))] min-[820px]:text-base">{item.label}</span>
                    <span className="text-xs leading-[18px] text-[var(--text-2)]">{DESCRIPCION_MODULO[item.href] ?? ""}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
