import { createClient } from "@/lib/supabase/server";
import { isAdmin, parseRole, type Role } from "@/lib/auth/roles";
import type { Punch, WorkCenter } from "./types";

export type SesionFichaje = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  role: Role;
  nombre: string;
  admin: boolean;
};

export async function sesionFichaje(): Promise<SesionFichaje | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: perfil } = await supabase
    .from("profiles")
    .select("id, role, nombre_completo, activo")
    .eq("id", user.id)
    .maybeSingle();
  if (!perfil || perfil.activo === false) return null;
  const role = parseRole(perfil.role);
  return {
    supabase,
    userId: user.id,
    role,
    nombre: perfil.nombre_completo ?? user.email ?? "Usuario",
    admin: isAdmin(role),
  };
}

export async function escribirAudit(
  supabase: SesionFichaje["supabase"],
  input: {
    actorId: string | null;
    actorLabel: string;
    action: string;
    detail: string;
    origin: string;
  }
): Promise<void> {
  await supabase.from("fichaje_audit_log").insert({
    actor_id: input.actorId,
    actor_label: input.actorLabel,
    action: input.action,
    detail: input.detail,
    origin: input.origin,
  });
}

export function mapPunch(row: Record<string, unknown>): Punch {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    type: row.type as Punch["type"],
    at: String(row.at),
    client_at: (row.client_at as string | null) ?? null,
    mode: row.mode as Punch["mode"],
    work_center_id: (row.work_center_id as string | null) ?? null,
    lat: row.lat == null ? null : Number(row.lat),
    lng: row.lng == null ? null : Number(row.lng),
    accuracy: row.accuracy == null ? null : Number(row.accuracy),
    source: String(row.source ?? "pwa"),
    client_id: (row.client_id as string | null) ?? null,
    superseded_by: (row.superseded_by as string | null) ?? null,
    sequence_ok: row.sequence_ok !== false,
  };
}

export function mapCentro(row: Record<string, unknown>): WorkCenter {
  return {
    id: String(row.id),
    name: String(row.name),
    address: String(row.address),
    lat: Number(row.lat),
    lng: Number(row.lng),
    radius_m: Number(row.radius_m ?? 150),
  };
}
