"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CalendarDays,
  ClipboardList,
  FileText,
  ListTodo,
  Plus,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { isAdmin, isEditor } from "@/lib/auth/roles";

type ItemNuevo = { href: string; label: string; icon: LucideIcon };

export function NuevoMenu() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const editor = isEditor(user?.role);
  const admin = isAdmin(user?.role);

  useEffect(() => {
    const onDoc = (evento: MouseEvent) => {
      if (!ref.current?.contains(evento.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const items: ItemNuevo[] = editor
    ? [{ href: "/presupuestos/nuevo", label: "Presupuesto", icon: ClipboardList }]
    : [
        { href: "/tareas", label: "Tarea", icon: ListTodo },
        { href: "/calendario", label: "Cita", icon: CalendarDays },
        { href: "/propiedades/nueva", label: "Inmueble", icon: Building2 },
        { href: "/clientes/nuevo", label: "Cliente", icon: User },
        { href: "/demandas?nueva=1", label: "Demanda", icon: Users },
        ...(admin
          ? [
              { href: "/presupuestos/nuevo", label: "Presupuesto", icon: ClipboardList },
              { href: "/facturas/nueva", label: "Factura", icon: FileText },
            ]
          : []),
      ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-1.5 rounded-[9px] bg-accent px-3 text-[13.5px] font-semibold text-white hover:bg-accent-dark max-[819px]:h-10"
      >
        <Plus size={14} strokeWidth={2.6} />
        Nuevo
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1.5 w-[250px] rounded-[12px] border border-border bg-white p-1.5 shadow-[0_14px_34px_rgba(19,28,26,.14)]">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium text-foreground hover:bg-[var(--surface-soft)]"
              >
                <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[7px] bg-[var(--surface-soft)] text-accent">
                  <Icon size={14} strokeWidth={1.9} />
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
