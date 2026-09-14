"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { isAdmin, isEditor } from "@/lib/auth/roles";

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

  const items = editor
    ? [{ href: "/presupuestos/nuevo", label: "Presupuesto" }]
    : [
        { href: "/tareas", label: "Tarea" },
        { href: "/calendario", label: "Cita" },
        { href: "/propiedades/nueva", label: "Inmueble" },
        { href: "/clientes/nuevo", label: "Cliente" },
        { href: "/demandas/nueva", label: "Demanda" },
        ...(admin
          ? [
              { href: "/presupuestos/nuevo", label: "Presupuesto" },
              { href: "/facturas/nueva", label: "Factura" },
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
        <div className="absolute right-0 z-50 mt-1.5 min-w-[180px] overflow-hidden rounded-[12px] border border-border bg-white py-1 shadow-none">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-[13.5px] font-medium text-foreground hover:bg-accent-soft hover:text-accent"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
