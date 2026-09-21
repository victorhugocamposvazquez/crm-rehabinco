"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardPenLine, FileSignature, Trash2, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";
import { puedeVerPapelera } from "@/lib/auth/roles";

const BASE = [
  {
    href: "/herramientas",
    label: "Resumen",
    icon: Wrench,
    activa: (pathname: string) =>
      pathname === "/herramientas" ||
      (pathname.startsWith("/herramientas/") && !pathname.startsWith("/herramientas/papelera")),
  },
  {
    href: "/partes-visita",
    label: "Visitas",
    icon: ClipboardPenLine,
    activa: (pathname: string) => pathname.startsWith("/partes-visita") || pathname.startsWith("/visitas"),
  },
  {
    href: "/contratos-arras",
    label: "Arras",
    icon: FileSignature,
    activa: (pathname: string) =>
      pathname.startsWith("/contratos-arras") && !pathname.startsWith("/contratos-arras/papelera"),
  },
] as const;

export function HerramientasFooter() {
  const pathname = usePathname();
  const { user } = useAuth();
  const verPapelera = puedeVerPapelera(user?.role);

  const items = [
    ...BASE,
    ...(verPapelera
      ? [
          {
            href: "/herramientas/papelera",
            label: "Papelera",
            icon: Trash2,
            activa: (p: string) => p.startsWith("/herramientas/papelera"),
          },
        ]
      : []),
  ];

  return (
    <nav
      aria-label="Herramientas"
      className="fixed inset-x-0 bottom-[var(--mobile-nav-h)] z-40 flex border-t border-border bg-white/95 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur min-[820px]:bottom-0 min-[820px]:left-[232px] min-[820px]:right-0"
    >
      <div className="mx-auto flex w-full max-w-[1600px] px-6">
        {items.map((item) => {
          const Icono = item.icon;
          const activa = item.activa(pathname ?? "");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex min-h-[52px] flex-1 items-center justify-center gap-2 text-[13.5px] font-medium",
                activa ? "text-accent" : "text-[var(--text-2)] hover:text-accent"
              )}
            >
              <Icono className="h-4 w-4" strokeWidth={1.8} aria-hidden />
              {item.label}
              {activa ? <span className="absolute inset-x-4 top-0 h-[3px] rounded-b bg-accent" /> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
