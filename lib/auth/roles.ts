export type Role = "admin" | "comercial" | "editor";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  comercial: "Comercial",
  editor: "Editor Garal",
};

export function parseRole(value: unknown): Role {
  if (value === "admin" || value === "editor") return value;
  if (value === "comercial" || value === "agente") return "comercial";
  return "comercial";
}

export function roleLabel(role: Role | null | undefined): string {
  if (!role) return "—";
  return ROLE_LABELS[role] ?? role;
}

export function isAdmin(role: Role | null | undefined): boolean {
  return role === "admin";
}

export function isEditor(role: Role | null | undefined): boolean {
  return role === "editor";
}

export function isComercial(role: Role | null | undefined): boolean {
  return role === "comercial";
}

export function puedeCrearPropiedad(role: Role | null | undefined): boolean {
  return role === "admin" || role === "comercial";
}

/** Solo dirección rastrea Catastro y reparte fincas. */
export function puedeRastrearCatastro(role: Role | null | undefined): boolean {
  return role === "admin";
}

export function puedeAsignarFincas(role: Role | null | undefined): boolean {
  return role === "admin";
}

const EDITOR_HOME = "/presupuestos";

const EDITOR_BLOCKED_PREFIXES = [
  "/clientes",
  "/buscar",
  "/catastro",
  "/propiedades",
  "/inmuebles",
  "/partes-visita",
  "/visitas",
  "/demandas",
  "/captacion",
  "/seguimiento",
  "/calendario",
  "/tareas",
  "/informes",
  "/facturas",
  "/settings/empresa",
  "/settings/emisores-presupuesto",
  "/settings/portales",
];

export function editorHomePath(): string {
  return EDITOR_HOME;
}

/** Rutas que un editor no puede usar (se redirige a presupuestos). */
export function isEditorBlockedPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return EDITOR_BLOCKED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

const COMERCIAL_BLOCKED_PREFIXES = [
  "/buscar",
  "/catastro/searches",
  "/catastro/equipo",
  "/catastro/cobertura",
  "/facturas",
  "/informes",
  "/presupuestos",
  "/settings/empresa",
  "/settings/emisores-presupuesto",
  "/settings/portales",
];

export function comercialHomePath(): string {
  return "/";
}

/** El comercial no rastrea, no factura ni abre el histórico de búsquedas del equipo. */
export function isComercialBlockedPath(pathname: string): boolean {
  return COMERCIAL_BLOCKED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/** Menú completo por rol. El hamburguesa muestra esta lista entera. */
export const NAV_DESKTOP_BY_ROLE: Record<Role, readonly string[]> = {
  admin: [
    "/",
    "/captacion",
    "/catastro",
    "/propiedades",
    "/demandas",
    "/calendario",
    "/tareas",
    "/seguimiento",
    "/informes",
    "/partes-visita",
    "/clientes",
    "/presupuestos",
    "/facturas",
    "/settings",
  ],
  comercial: [
    "/",
    "/tareas",
    "/calendario",
    "/captacion",
    "/partes-visita",
    "/propiedades",
    "/demandas",
    "/seguimiento",
    "/catastro",
    "/clientes",
    "/settings",
  ],
  editor: ["/presupuestos", "/settings"],
};

/** Atajos de la barra: lo del día a día. El resto vive en el menú lateral. */
export const NAV_TOP_BY_ROLE: Record<Role, readonly string[]> = {
  admin: ["/", "/captacion", "/catastro", "/propiedades", "/demandas"],
  comercial: ["/", "/tareas", "/calendario", "/captacion", "/propiedades"],
  editor: ["/presupuestos"],
};

export const NAV_MOBILE_BY_ROLE: Record<Role, readonly string[]> = {
  admin: ["/", "/calendario", "/tareas", "/captacion", "/settings"],
  comercial: ["/", "/tareas", "/calendario", "/captacion", "/settings"],
  editor: ["/presupuestos", "/settings"],
};

export function navHrefsForRole(
  role: Role | null | undefined,
  variant: "desktop" | "mobile" | "top"
): readonly string[] {
  const resolved: Role = role ?? "comercial";
  if (variant === "mobile") return NAV_MOBILE_BY_ROLE[resolved];
  if (variant === "top") {
    const permitidos = new Set(NAV_DESKTOP_BY_ROLE[resolved]);
    return NAV_TOP_BY_ROLE[resolved].filter((href) => permitidos.has(href));
  }
  return NAV_DESKTOP_BY_ROLE[resolved];
}
