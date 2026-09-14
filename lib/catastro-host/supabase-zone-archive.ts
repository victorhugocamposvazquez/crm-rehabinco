/**
 * Archivo de sesiones de zona en Supabase. Fuera del motor catastral.
 */
import {
  hidratarSesionZona,
  permiteEscribirSesionZona,
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

type ArchiveResult<T> = { data: T; error: { message: string } | null };

type ArchiveQuery = {
  eq: (column: string, value: unknown) => ArchiveQuery;
  neq: (column: string, value: unknown) => ArchiveQuery;
  in: (column: string, values: unknown[]) => ArchiveQuery;
  gt: (column: string, value: unknown) => ArchiveQuery;
  or: (filter: string) => ArchiveQuery;
  order: (column: string, options?: { ascending?: boolean }) => ArchiveQuery;
  limit: (value: number) => ArchiveQuery;
  select: (columns: string) => ArchiveQuery;
  maybeSingle: () => Promise<ArchiveResult<ZoneRow | { id?: string } | null>>;
  then: (
    onfulfilled?: (value: { data: ZoneRow[] | null; error: { message: string } | null; count?: number | null }) => unknown
  ) => Promise<unknown>;
};

type ArchiveClient = {
  from: (table: string) => {
    select: (columns: string) => ArchiveQuery;
    delete: () => ArchiveQuery;
    update: (values: Record<string, unknown>) => ArchiveQuery;
    upsert: (
      values: Record<string, unknown>,
      options?: { onConflict?: string }
    ) => Promise<{ error: { message: string } | null }>;
  };
};

const CLAIM_MS = 90_000;

function fila(session: ZoneSession) {
  return {
    id: session.id,
    user_id: session.userId,
    clave_zona: session.claveZona,
    status: session.status === "running" ? "paused" : session.status,
    payload: serializarSesionZona(session),
    expires_at: new Date(session.expiresAt).toISOString(),
    updated_at: new Date(session.updatedAt).toISOString(),
  };
}

export function createSupabaseZoneArchive(client: ArchiveClient): ZoneSessionArchive {
  const archive: ZoneSessionArchive = {
    async get(id, userId) {
      const { data } = await client
        .from("catastro_zone_sessions")
        .select("id,user_id,clave_zona,status,payload,expires_at")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();
      return hidratarSesionZona((data as ZoneRow | null)?.payload);
    },
    async findByKey(userId, claveZona) {
      const { data } = await client
        .from("catastro_zone_sessions")
        .select("id,user_id,clave_zona,status,payload,expires_at")
        .eq("user_id", userId)
        .eq("clave_zona", claveZona)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return hidratarSesionZona((data as ZoneRow | null)?.payload);
    },
    async put(session) {
      const [porId, porClave] = await Promise.all([
        archive.get(session.id, session.userId),
        archive.findByKey(session.userId, session.claveZona),
      ]);
      const rival = porClave && porClave.id !== session.id ? porClave : null;
      if (rival && !permiteEscribirSesionZona(session, rival)) return;
      if (porId && !permiteEscribirSesionZona(session, porId)) return;
      await client
        .from("catastro_zone_sessions")
        .delete()
        .eq("user_id", session.userId)
        .eq("clave_zona", session.claveZona)
        .neq("id", session.id);
      const { error } = await client.from("catastro_zone_sessions").upsert(fila(session), { onConflict: "id" });
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
    async tryClaim(id, userId, ms = CLAIM_MS) {
      const ahora = new Date().toISOString();
      const hasta = new Date(Date.now() + ms).toISOString();
      const { data, error } = await client
        .from("catastro_zone_sessions")
        .update({ claimed_until: hasta })
        .eq("id", id)
        .eq("user_id", userId)
        .or(`claimed_until.is.null,claimed_until.lt."${ahora}"`)
        .select("id")
        .maybeSingle();
      if (error) {
        console.error("[catastro:zone-archive]", error.message);
        return false;
      }
      return Boolean((data as { id?: string } | null)?.id);
    },
    async releaseClaim(id, userId) {
      await client.from("catastro_zone_sessions").update({ claimed_until: null }).eq("id", id).eq("user_id", userId);
    },
  };
  return archive;
}
