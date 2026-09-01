export type Role = "admin" | "agente" | "editor";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  agente: "Agente",
  editor: "Editor Garal",
};

export function parseRole(value: unknown): Role {
  if (value === "admin" || value === "agente" || value === "editor") return value;
  return "agente";
}

export function roleLabel(role: Role | null | undefined): string {
  if (!role) return "—";
  return ROLE_LABELS[role] ?? role;
}

export function isEditor(role: Role | null | undefined): boolean {
  return role === "editor";
}

const EDITOR_HOME = "/presupuestos";

const EDITOR_BLOCKED_PREFIXES = [
  "/clientes",
  "/propiedades",
  "/partes-visita",
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
