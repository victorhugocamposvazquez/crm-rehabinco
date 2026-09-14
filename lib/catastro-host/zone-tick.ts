/**
 * Continúa búsquedas por zona sin el navegador.
 * Host CRM: cron + after(). El motor no conoce Vercel ni Supabase.
 */
import { after } from "next/server";
import { ZoneBusyError } from "@/lib/catastro/zone-search";
import { hidratarSesionZona } from "@/lib/catastro/zone-archive";
import {
  sesionContinuaEnSegundoPlano,
  snapshotContinuaEnSegundoPlano,
} from "@/lib/catastro/zone-session";
import { avanzarZonaEnServidor } from "@/lib/catastro/search-zone";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseExplorerStore, type ExplorerDbClient } from "./supabase-explorer-store";
import { createSupabaseZoneArchive } from "./supabase-zone-archive";

const CLAIM_MS = 90_000;
const MAX_POR_INVOCACION = 4;

export function cronZonaAutorizado(request: Request): boolean {
  const esperado = process.env.CRON_SECRET?.trim();
  if (!esperado) return false;
  return request.headers.get("authorization") === `Bearer ${esperado}`;
}

export function programarTickZona(zoneSearchId: string): void {
  if (!zoneSearchId) return;
  after(() => {
    void tickZonasPendientes(zoneSearchId).catch((error) => {
      console.error("[catastro:zone-tick]", error instanceof Error ? error.message : error);
    });
  });
}

const RECIENTE_MS = 40_000;

type AdminClient = ReturnType<typeof createAdminClient>;

async function reclamarSesion(admin: AdminClient, id: string): Promise<boolean> {
  const ahora = new Date().toISOString();
  const hasta = new Date(Date.now() + CLAIM_MS).toISOString();
  const { data, error } = await admin
    .from("catastro_zone_sessions")
    .update({ claimed_until: hasta })
    .eq("id", id)
    .or(`claimed_until.is.null,claimed_until.lt."${ahora}"`)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[catastro:zone-tick]", error.message);
    return false;
  }
  return Boolean(data?.id);
}

function depsDeAdmin(admin: AdminClient) {
  return {
    archive: createSupabaseZoneArchive(admin as never),
    explorerStore: createSupabaseExplorerStore(admin as unknown as ExplorerDbClient),
  };
}

async function liberarSesion(admin: AdminClient, id: string): Promise<void> {
  await admin.from("catastro_zone_sessions").update({ claimed_until: null }).eq("id", id);
}

async function tickSesion(
  admin: AdminClient,
  payload: unknown,
  opciones: { continuarCadena?: boolean } = {}
): Promise<"ticked" | "skipped"> {
  const session = hidratarSesionZona(payload);
  if (!session || !sesionContinuaEnSegundoPlano(session)) return "skipped";
  if (!opciones.continuarCadena && Date.now() - session.updatedAt < RECIENTE_MS) return "skipped";
  if (!(await reclamarSesion(admin, session.id))) return "skipped";
  try {
    const snapshot = await avanzarZonaEnServidor(session, depsDeAdmin(admin));
    await liberarSesion(admin, session.id);
    if (snapshotContinuaEnSegundoPlano(snapshot)) programarTickZona(session.id);
    return "ticked";
  } catch (error) {
    await liberarSesion(admin, session.id);
    if (error instanceof ZoneBusyError) return "skipped";
    console.error("[catastro:zone-tick]", error instanceof Error ? error.message : error);
    return "skipped";
  }
}

export async function tickZonasPendientes(zoneSearchId?: string): Promise<{ ticked: number; skipped: number }> {
  const admin = createAdminClient();
  if (zoneSearchId) {
    const { data } = await admin
      .from("catastro_zone_sessions")
      .select("payload")
      .eq("id", zoneSearchId)
      .maybeSingle();
    const resultado = await tickSesion(admin, data?.payload, { continuarCadena: true });
    return resultado === "ticked" ? { ticked: 1, skipped: 0 } : { ticked: 0, skipped: 1 };
  }

  const { data, error } = await admin
    .from("catastro_zone_sessions")
    .select("id, payload")
    .in("status", ["paused", "running", "prepared", "upstream_paused"])
    .gt("expires_at", new Date().toISOString())
    .limit(12);
  if (error) {
    console.error("[catastro:zone-tick]", error.message);
    return { ticked: 0, skipped: 0 };
  }

  let ticked = 0;
  let skipped = 0;
  for (const fila of data ?? []) {
    if (ticked >= MAX_POR_INVOCACION) break;
    const resultado = await tickSesion(admin, fila.payload);
    if (resultado === "ticked") ticked += 1;
    else skipped += 1;
  }
  return { ticked, skipped };
}
