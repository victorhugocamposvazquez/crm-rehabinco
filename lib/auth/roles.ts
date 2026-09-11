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

export function isEditor(role: Role | null | undefined): boolean {
  return role === "editor";
}

export function isComercial(role: Role | null | undefined): boolean {
  return role === "comercial";
}

const EDITOR_HOME = "/presupuestos";

const EDITOR_BLOCKED_PREFIXES = [
  "/clientes",
  "/propiedades",
  "/inmuebles",
  "/partes-visita",
  "/visitas",
  "/demandas",
  "/calendario",
  "/facturas",
  "/settings/empresa",
  "/settings/emisores-presupuesto",
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
