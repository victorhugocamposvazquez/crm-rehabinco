import { PERMISOS, activoDe, type FilaPermiso } from "@/lib/auth/permisos";
import { type Role } from "@/lib/auth/roles";

export type SupportModuleInfo = {
  id: string;
  label: string;
  hint: string;
  href?: string;
};

export type SupportProjectManifest = {
  projectKey: string;
  crmName: string;
  baseUrl: string;
  githubRepo: string;
  defaultCursorModel: "composer-2.5" | "auto";
  modulosDisponibles: SupportModuleInfo[];
};

export function getSupportProjectManifest(opts?: {
  role?: Role | null;
  filasPermisos?: readonly FilaPermiso[] | null;
}): SupportProjectManifest {
  const projectKey = (process.env.NEXT_PUBLIC_SUPPORT_PROJECT_KEY || process.env.SUPPORT_PROJECT_KEY || "rehabinco")
    .trim()
    .toLowerCase();
  const crmName = (process.env.NEXT_PUBLIC_SUPPORT_CRM_NAME || "CRM Rehabinco").trim();
  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.SUPPORT_CRM_BASE_URL ||
    "https://crm.rehabinco.es"
  )
    .trim()
    .replace(/\/+$/, "");
  const githubRepo = (process.env.SUPPORT_GITHUB_REPO || "victorhugocamposvazquez/crm-rehabinco").trim();
  const rawModel = (process.env.SUPPORT_CURSOR_MODEL || "auto").trim();
  const defaultCursorModel: "composer-2.5" | "auto" = rawModel === "composer-2.5" ? "composer-2.5" : "auto";

  const zonas = PERMISOS.filter((p) => p.grupo === "Zonas");
  const filtradas = opts?.role
    ? zonas.filter((z) => activoDe(opts.role ?? "comercial", z.id, opts.filasPermisos ?? null))
    : zonas;

  return {
    projectKey,
    crmName,
    baseUrl,
    githubRepo,
    defaultCursorModel,
    modulosDisponibles: filtradas.map((z) => ({
      id: z.id,
      label: z.label,
      hint: z.hint,
      href: z.href,
    })),
  };
}

export function inferirModuloPorRuta(pathname: string): string {
  const limpia = (pathname || "/").trim();
  if (limpia === "/") return "hoy";
  const zonas = PERMISOS.filter((p) => p.grupo === "Zonas" && p.href && p.href !== "/");
  for (const z of zonas) {
    if (z.href && (limpia === z.href || limpia.startsWith(`${z.href}/`))) {
      return z.id;
    }
  }
  if (limpia.startsWith("/inmuebles")) return "inmuebles";
  if (limpia.startsWith("/partes-visita") || limpia.startsWith("/contratos-") || limpia.startsWith("/hojas-encargo")) {
    return "herramientas";
  }
  if (limpia.startsWith("/settings")) return "ajustes";
  return "general";
}
