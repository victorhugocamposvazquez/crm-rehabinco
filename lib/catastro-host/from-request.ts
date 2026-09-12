import { createClient } from "../supabase/server";
import { parseRole, type Role } from "../auth/roles";
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
  };
}
