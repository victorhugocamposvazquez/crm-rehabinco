import type { LucideIcon } from "lucide-react";
import {
  Home,
  Users,
  FileText,
  ClipboardList,
  ClipboardPenLine,
  Building2,
  Search,
  Settings,
  CalendarDays,
  BarChart3,
  ListTodo,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Hoy", icon: Home },
  { href: "/catastro", label: "Catastro", icon: Search },
  { href: "/propiedades", label: "Inmuebles", icon: Building2 },
  { href: "/demandas", label: "Demandas", icon: Users },
  { href: "/calendario", label: "Calendario", icon: CalendarDays },
  { href: "/tareas", label: "Tareas", icon: ListTodo },
  { href: "/informes", label: "Informes", icon: BarChart3 },
  { href: "/partes-visita", label: "Visitas", icon: ClipboardPenLine },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/presupuestos", label: "Presupuestos", icon: ClipboardList },
  { href: "/facturas", label: "Facturas", icon: FileText },
  { href: "/settings", label: "Ajustes", icon: Settings },
];

export function itemsDesdeHrefs(hrefs: readonly string[]): NavItem[] {
  return hrefs
    .map((href) => NAV_ITEMS.find((item) => item.href === href))
    .filter((item): item is NavItem => Boolean(item));
}

export function navItemActivo(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === "/catastro" && pathname.startsWith("/buscar")) return true;
  if (href === "/settings") return pathname.startsWith("/settings");
  if (href !== "/") return pathname.startsWith(href);
  return false;
}
