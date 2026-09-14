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
  Columns3,
} from "lucide-react";
import type { Role } from "@/lib/auth/roles";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Hoy", icon: Home },
  { href: "/calendario", label: "Calendario", icon: CalendarDays },
  { href: "/tareas", label: "Tareas", icon: ListTodo },
  { href: "/seguimiento", label: "Seguimiento", icon: Columns3 },
  { href: "/catastro", label: "Catastro", icon: Search },
  { href: "/propiedades", label: "Inmuebles", icon: Building2 },
  { href: "/demandas", label: "Demandas", icon: Users },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/partes-visita", label: "Visitas", icon: ClipboardPenLine },
  { href: "/presupuestos", label: "Presupuestos", icon: ClipboardList },
  { href: "/facturas", label: "Facturas", icon: FileText },
  { href: "/informes", label: "Informes", icon: BarChart3 },
  { href: "/settings", label: "Ajustes", icon: Settings },
];

export const NAV_GROUPS: { label: string; adminOnly?: boolean; hrefs: readonly string[] }[] = [
  { label: "Día a día", hrefs: ["/", "/calendario", "/tareas"] },
  { label: "Captación", hrefs: ["/catastro", "/seguimiento", "/propiedades", "/demandas", "/clientes", "/partes-visita"] },
  { label: "Obra y facturación", adminOnly: true, hrefs: ["/presupuestos", "/facturas", "/informes"] },
];

export const NAV_MOBILE_LABEL: Record<string, string> = {
  "/calendario": "Agenda",
  "/settings": "Más",
};

export function itemsDesdeHrefs(hrefs: readonly string[]): NavItem[] {
  return hrefs
    .map((href) => NAV_ITEMS.find((item) => item.href === href))
    .filter((item): item is NavItem => Boolean(item));
}

export function navItemActivo(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === "/catastro" && pathname.startsWith("/buscar")) return true;
  if (href === "/settings") return pathname.startsWith("/settings");
  if (href === "/propiedades" && pathname.startsWith("/inmuebles")) return true;
  if (href === "/partes-visita" && pathname.startsWith("/visitas")) return true;
  if (href !== "/") return pathname.startsWith(href);
  return false;
}

export function breadcrumbDeRuta(pathname: string): { seccion: string; detalle?: string } {
  const item = NAV_ITEMS.find((nav) => navItemActivo(pathname, nav.href) && nav.href !== "/") 
    ?? NAV_ITEMS.find((nav) => nav.href === pathname);
  if (pathname === "/") return { seccion: "Hoy" };
  const seccion = item?.label ?? "CRM";
  const partes = pathname.split("/").filter(Boolean);
  if (partes.length > 1 && !["nuevo", "nueva", "editar"].includes(partes[1])) {
    return { seccion, detalle: "Detalle" };
  }
  if (partes.includes("nuevo") || partes.includes("nueva")) return { seccion, detalle: "Nuevo" };
  if (partes.includes("editar")) return { seccion, detalle: "Editar" };
  return { seccion };
}

export function gruposNavParaRol(role: Role | null | undefined, permitidos: readonly string[]): {
  label: string;
  items: NavItem[];
}[] {
  const set = new Set(permitidos);
  const grupos = NAV_GROUPS.filter((grupo) => {
    if (grupo.adminOnly && role !== "admin") return false;
    return grupo.hrefs.some((href) => set.has(href));
  }).map((grupo) => ({
    label: grupo.label,
    items: itemsDesdeHrefs(grupo.hrefs.filter((href) => set.has(href))),
  }));
  if (role === "editor") {
    return [{ label: "Obra", items: itemsDesdeHrefs(["/presupuestos"].filter((href) => set.has(href))) }];
  }
  return grupos.filter((grupo) => grupo.items.length > 0);
}
