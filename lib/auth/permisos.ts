import { navHrefsForRole, type Role } from "@/lib/auth/roles";

export type PermisoId =
  | "hoy"
  | "fichaje"
  | "calendario"
  | "tareas"
  | "seguimiento"
  | "captacion"
  | "catastro"
  | "inmuebles"
  | "web"
  | "valoraciones"
  | "demandas"
  | "contactos"
  | "herramientas"
  | "presupuestos"
  | "facturas"
  | "informes"
  | "jornada"
  | "tareas_equipo"
  | "catastro_equipo"
  | "empresa"
  | "usuarios"
  | "portales";

export type PermisoDef = {
  id: PermisoId;
  label: string;
  hint: string;
  grupo: "Zonas" | "Permisos";
  href?: string;
};

export const PERMISOS: readonly PermisoDef[] = [
  { id: "hoy", grupo: "Zonas", label: "Hoy", hint: "El inicio del día.", href: "/" },
  { id: "fichaje", grupo: "Zonas", label: "Fichaje", hint: "Entrada y salida.", href: "/fichaje" },
  { id: "calendario", grupo: "Zonas", label: "Calendario", hint: "Agenda.", href: "/calendario" },
  { id: "tareas", grupo: "Zonas", label: "Tareas", hint: "Tablero de tareas.", href: "/tareas" },
  { id: "seguimiento", grupo: "Zonas", label: "Seguimiento", hint: "Embudo de seguimiento.", href: "/seguimiento" },
  { id: "captacion", grupo: "Zonas", label: "Captación", hint: "Anuncios y encargos.", href: "/captacion" },
  { id: "catastro", grupo: "Zonas", label: "Catastro", hint: "Búsqueda de fincas.", href: "/catastro" },
  { id: "inmuebles", grupo: "Zonas", label: "Inmuebles", hint: "Cartera.", href: "/propiedades" },
  { id: "web", grupo: "Zonas", label: "Diseño web", hint: "La web pública.", href: "/web/gestionar" },
  { id: "valoraciones", grupo: "Zonas", label: "Valoraciones", hint: "Informes de valor.", href: "/valoraciones" },
  { id: "demandas", grupo: "Zonas", label: "Demandas", hint: "Lo que busca cada contacto.", href: "/demandas" },
  { id: "contactos", grupo: "Zonas", label: "Contactos", hint: "Agenda de personas.", href: "/clientes" },
  { id: "herramientas", grupo: "Zonas", label: "Herramientas", hint: "Partes, arras y contratos.", href: "/herramientas" },
  { id: "presupuestos", grupo: "Zonas", label: "Presupuestos", hint: "Presupuestos y ampliaciones.", href: "/presupuestos" },
  { id: "facturas", grupo: "Zonas", label: "Facturas", hint: "Facturación.", href: "/facturas" },
  { id: "informes", grupo: "Zonas", label: "Informes", hint: "Cifras del equipo.", href: "/informes" },
  { id: "jornada", grupo: "Zonas", label: "Registro de jornada", hint: "Fichajes del equipo.", href: "/equipo/jornada" },
  { id: "tareas_equipo", grupo: "Permisos", label: "Tareas de todo el equipo", hint: "Si está apagado, solo ve las suyas." },
  { id: "catastro_equipo", grupo: "Permisos", label: "Archivo de catastro del equipo", hint: "Búsquedas, cobertura y asignar fincas." },
  { id: "empresa", grupo: "Permisos", label: "Empresa e Idealista", hint: "Datos fiscales, emisores y publicación." },
  { id: "usuarios", grupo: "Permisos", label: "Usuarios", hint: "Dar de alta y pedir la baja. La papelera la ve el superadministrador." },
  { id: "portales", grupo: "Permisos", label: "Claves de captación", hint: "Zonas y gasto de los portales." },
];

export const ROLES_CONFIGURABLES = ["admin", "comercial", "editor", "catastro_user"] as const satisfies readonly Role[];

const HREF_PERMISO: Record<string, PermisoId> = {
  "/": "hoy",
  "/fichaje": "fichaje",
  "/calendario": "calendario",
  "/tareas": "tareas",
  "/seguimiento": "seguimiento",
  "/captacion": "captacion",
  "/catastro": "catastro",
  "/propiedades": "inmuebles",
  "/web/gestionar": "web",
  "/valoraciones": "valoraciones",
  "/demandas": "demandas",
  "/clientes": "contactos",
  "/herramientas": "herramientas",
  "/presupuestos": "presupuestos",
  "/facturas": "facturas",
  "/informes": "informes",
  "/equipo/jornada": "jornada",
};

const RUTAS = (
  [
  { prefijo: "/settings/portales", permiso: "portales" },
  { prefijo: "/settings/empresa", permiso: "empresa" },
  { prefijo: "/settings/emisores-presupuesto", permiso: "empresa" },
  { prefijo: "/settings/publicacion", permiso: "empresa" },
  { prefijo: "/settings", permiso: "hoy" },
  { prefijo: "/catastro/searches", permiso: "catastro_equipo" },
  { prefijo: "/catastro/equipo", permiso: "catastro_equipo" },
  { prefijo: "/catastro/cobertura", permiso: "catastro_equipo" },
  { prefijo: "/buscar", permiso: "catastro_equipo" },
  { prefijo: "/web", permiso: "web" },
  { prefijo: "/equipo", permiso: "jornada" },
  { prefijo: "/partes-visita", permiso: "herramientas" },
  { prefijo: "/visitas", permiso: "herramientas" },
  { prefijo: "/contratos-arras", permiso: "herramientas" },
  { prefijo: "/hojas-encargo-honorarios", permiso: "herramientas" },
  { prefijo: "/hojas-encargo-exclusiva", permiso: "herramientas" },
  { prefijo: "/contratos-pago-aplazado", permiso: "herramientas" },
  { prefijo: "/contratos-arrendamiento", permiso: "herramientas" },
  { prefijo: "/inmuebles", permiso: "inmuebles" },
  { prefijo: "/propiedades", permiso: "inmuebles" },
  { prefijo: "/clientes", permiso: "contactos" },
  { prefijo: "/fichaje", permiso: "fichaje" },
  { prefijo: "/calendario", permiso: "calendario" },
  { prefijo: "/tareas", permiso: "tareas" },
  { prefijo: "/seguimiento", permiso: "seguimiento" },
  { prefijo: "/captacion", permiso: "captacion" },
  { prefijo: "/catastro", permiso: "catastro" },
  { prefijo: "/valoraciones", permiso: "valoraciones" },
  { prefijo: "/demandas", permiso: "demandas" },
  { prefijo: "/herramientas", permiso: "herramientas" },
  { prefijo: "/presupuestos", permiso: "presupuestos" },
  { prefijo: "/facturas", permiso: "facturas" },
  { prefijo: "/informes", permiso: "informes" },
  { prefijo: "/", permiso: "hoy", exacto: true },
] satisfies { prefijo: string; permiso: PermisoId; exacto?: boolean }[]
).sort((a, b) => b.prefijo.length - a.prefijo.length);

export function permisoPorDefecto(role: Role | null | undefined, id: PermisoId): boolean {
  if (role === "superadmin") return true;
  if (id === "tareas_equipo") return role === "admin" || role === "comercial";
  if (id === "catastro_equipo") return role === "admin" || role === "catastro_user";
  if (id === "empresa" || id === "usuarios") return role === "admin";
  if (id === "portales") return false;
  const href = PERMISOS.find((item) => item.id === id)?.href;
  if (!href) return false;
  return navHrefsForRole(role, "desktop").includes(href);
}

export type FilaPermiso = { role: string; permiso: string; activo: boolean };

export function activoDe(role: Role, id: PermisoId, filas: readonly FilaPermiso[] | null): boolean {
  if (role === "superadmin") return true;
  const fila = filas?.find((item) => item.role === role && item.permiso === id);
  if (fila) return fila.activo;
  return permisoPorDefecto(role, id);
}

export function hrefsConPermisos(
  role: Role | null | undefined,
  variant: "desktop" | "mobile" | "top",
  filas: readonly FilaPermiso[] | null
): string[] {
  const tiene = (id: PermisoId) => activoDe(role ?? "comercial", id, filas);
  const desktop = Object.entries(HREF_PERMISO)
    .filter(([, id]) => tiene(id))
    .map(([href]) => href);
  const permitidos = new Set(desktop);
  permitidos.add("/settings");
  if (variant === "desktop") {
    return [...permitidos];
  }
  const plantilla = navHrefsForRole(role, variant).filter((href) => permitidos.has(href));
  if (plantilla.length > 0) return [...plantilla];
  const fallback = desktop.slice(0, 4);
  return variant === "mobile" ? [...fallback, "/settings"] : fallback;
}

export function rutaPermitida(pathname: string, role: Role | null | undefined, filas: readonly FilaPermiso[] | null): boolean {
  if (role === "superadmin") return true;
  if (
    pathname === "/settings/roles" ||
    pathname.startsWith("/settings/roles/") ||
    pathname === "/settings/papelera" ||
    pathname.startsWith("/settings/papelera/")
  ) {
    return false;
  }
  const regla = RUTAS.find((item) => (item.exacto ? pathname === item.prefijo : pathname === item.prefijo || pathname.startsWith(`${item.prefijo}/`)));
  if (!regla) return true;
  if (regla.prefijo === "/settings") return true;
  if (regla.permiso === "catastro_equipo" && !activoDe(role ?? "comercial", "catastro", filas)) return false;
  return activoDe(role ?? "comercial", regla.permiso, filas);
}

export function inicioPermitido(role: Role | null | undefined, filas: readonly FilaPermiso[] | null): string {
  const hrefs = hrefsConPermisos(role, "desktop", filas);
  const preferido = role === "editor" ? "/presupuestos" : role === "catastro_user" ? "/catastro" : "/";
  if (hrefs.includes(preferido)) return preferido;
  return hrefs.find((href) => href !== "/settings") ?? "/settings";
}
