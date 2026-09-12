/**
 * Archivo de sesiones de zona en Supabase. Fuera del motor catastral.
 */
import {
  hidratarSesionZona,
  serializarSesionZona,
  type ZoneSessionArchive,
} from "../catastro/zone-archive";
import { esZonaActiva, type ZoneSession } from "../catastro/zone-session";

type ZoneRow = {
  id: string;
  user_id: string;
  clave_zona: string;
  status: string;
  payload: unknown;
  expires_at: string;
};

type ArchiveClient = {
  from: (table: string) => {
    select: (columns: string) => ArchiveQuery;
    delete: () => ArchiveQuery;
    upsert: (values: Record<string, unknown>, options?: { onConflict?: string }) => Promise<{ error: { message: string } | null }>;
  };
};

type ArchiveQuery = {
    eq: (column: string, value: unknown) => ArchiveQuery;
    neq: (column: string, value: unknown) => ArchiveQuery;
    in: (column: string, values: unknown[]) => ArchiveQuery;
  gt: (column: string, value: unknown) => ArchiveQuery;
  maybeSingle: () => Promise<{ data: ZoneRow | null; error: { message: string } | null }>;
  then: (
    onfulfilled?: (value: { data: ZoneRow[] | null; error: { message: string } | null; count?: number | null }) => unknown
  ) => Promise<unknown>;
};

function fila(session: ZoneSession) {
  return {
    id: session.id,
    user_id: session.userId,
    clave_zona: session.claveZona,
    status: session.status,
    payload: serializarSesionZona(session),
    expires_at: new Date(session.expiresAt).toISOString(),
    updated_at: new Date(session.updatedAt).toISOString(),
  };
}

export function createSupabaseZoneArchive(client: ArchiveClient): ZoneSessionArchive {
  return {
    async get(id, userId) {
      const { data } = await client
        .from("catastro_zone_sessions")
        .select("id,user_id,clave_zona,status,payload,expires_at")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();
      return hidratarSesionZona(data?.payload);
    },
    async findByKey(userId, claveZona) {
      const { data } = await client
        .from("catastro_zone_sessions")
        .select("id,user_id,clave_zona,status,payload,expires_at")
        .eq("user_id", userId)
        .eq("clave_zona", claveZona)
        .maybeSingle();
      return hidratarSesionZona(data?.payload);
    },
    async put(session) {
      await client
        .from("catastro_zone_sessions")
        .delete()
        .eq("user_id", session.userId)
        .eq("clave_zona", session.claveZona)
        .neq("id", session.id);
      const { error } = await client
        .from("catastro_zone_sessions")
        .upsert(fila(session), { onConflict: "id" });
      if (error) throw new Error(error.message);
    },
    async countActive(userId) {
      const result = (await client
        .from("catastro_zone_sessions")
        .select("id,user_id,clave_zona,status,payload,expires_at")
        .eq("user_id", userId)
        .in("status", ["prepared", "running", "paused"])
        .gt("expires_at", new Date().toISOString())) as {
        data: ZoneRow[] | null;
      };
      return (result.data ?? []).filter((row) => {
        const session = hidratarSesionZona(row.payload);
        return session ? esZonaActiva(session) : false;
      }).length;
    },
  };
}
