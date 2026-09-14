import { createClient } from "../supabase/server";
import { parseRole, puedeRastrearCatastro, type Role } from "../auth/roles";
import {
  createSupabaseExplorerStore,
  type ExplorerDbClient,
} from "./supabase-explorer-store";
import { createCrmPropertyIntegration, type PropertyIntegrationClient } from "./property-integration";
import { createSupabaseZoneArchive } from "./supabase-zone-archive";

export async function explorerStoreDesdeSesion() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let role: Role | null = null;
  if (user) {
    const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    role = parseRole(data?.role);
  }
  return {
    user,
    role,
    store: createSupabaseExplorerStore(supabase as unknown as ExplorerDbClient),
    archive: createSupabaseZoneArchive(supabase as never),
    properties: createCrmPropertyIntegration(supabase as unknown as PropertyIntegrationClient),
    supabase,
  };
}

export function respuestaSesion(user: { id: string } | null): Response | null {
  if (user) return null;
  return Response.json({ ok: false, error: "Sesión expirada" }, { status: 401 });
}

export function respuestaRastreoCatastro(role: Role | null): Response | null {
  if (puedeRastrearCatastro(role)) return null;
  return Response.json(
    { ok: false, error: "Solo un administrador puede rastrear Catastro." },
    { status: 403 }
  );
}

export function respuestaRastreoDesdeSesion(
  user: { id: string } | null,
  role: Role | null
): Response | null {
  return respuestaSesion(user) ?? respuestaRastreoCatastro(role);
}
