"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardPenLine,
  FileSignature,
  FileText,
  Home,
  ScrollText,
  Trash2,
  Wrench,
} from "lucide-react";
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
  {
    href: "/hojas-encargo-honorarios",
    label: "Honorarios",
    icon: ScrollText,
    activa: (pathname: string) => pathname.startsWith("/hojas-encargo-honorarios"),
  },
  {
    href: "/contratos-pago-aplazado",
    label: "Aplazado",
    icon: FileText,
    activa: (pathname: string) => pathname.startsWith("/contratos-pago-aplazado"),
  },
  {
    href: "/contratos-arrendamiento",
    label: "Alquiler",
    icon: Home,
    activa: (pathname: string) => pathname.startsWith("/contratos-arrendamiento"),
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
      className="fixed inset-x-0 bottom-[var(--mobile-nav-h)] z-40 flex border-t border-border bg-[var(--surface)] shadow-[0_-4px_12px_rgba(0,0,0,0.06)] min-[820px]:bottom-0 min-[820px]:left-[232px] min-[820px]:right-0"
    >
      <div className="mx-auto flex w-full max-w-[1600px] overflow-x-auto px-2 min-[820px]:px-6">
        {items.map((item) => {
          const Icono = item.icon;
          const activa = item.activa(pathname ?? "");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex min-h-[52px] min-w-[4.5rem] flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium min-[820px]:min-w-0 min-[820px]:flex-row min-[820px]:gap-2 min-[820px]:text-[13.5px]",
                activa ? "text-accent" : "text-[var(--text-2)] hover:text-accent"
              )}
            >
              <Icono className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
              <span className="truncate">{item.label}</span>
              {activa ? <span className="absolute inset-x-2 top-0 h-[3px] rounded-b bg-accent min-[820px]:inset-x-4" /> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
