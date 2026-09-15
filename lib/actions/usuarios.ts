"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLE_LABELS, ROLES_CREABLES, parseRole, type Role } from "@/lib/auth/roles";

export type CreateUserResult =
  | { success: true; message: string }
  | { success: false; error: string };

async function exigirSuperadmin(): Promise<
  | { ok: true; id: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  if (!currentUser) {
    return { ok: false, error: "Debes iniciar sesión." };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", currentUser.id)
    .single();
  if (parseRole(profile?.role) !== "superadmin") {
    return { ok: false, error: "Solo el superadministrador puede gestionar usuarios." };
  }
  return { ok: true, id: currentUser.id };
}

export async function createUser(
  email: string,
  password: string,
  role: Role
): Promise<CreateUserResult> {
  try {
    const sesion = await exigirSuperadmin();
    if (!sesion.ok) return { success: false, error: sesion.error };

    if (!ROLES_CREABLES.includes(role)) {
      return { success: false, error: "El rol no es válido." };
    }

    const emailTrimmed = email.trim().toLowerCase();
    if (!emailTrimmed) {
      return { success: false, error: "El email es obligatorio." };
    }
    if (password.length < 6) {
      return { success: false, error: "La contraseña debe tener al menos 6 caracteres." };
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return {
        success: false,
        error: "Falta SUPABASE_SERVICE_ROLE_KEY. Añádela en Vercel → Settings → Environment Variables y redeploy.",
      };
    }

    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: emailTrimmed,
      password,
      email_confirm: true,
      app_metadata: { role },
    });

    if (error) {
      if (error.message.includes("already been registered") || error.message.includes("already exists")) {
        return { success: false, error: "Ya existe un usuario con ese email." };
      }
      return { success: false, error: error.message };
    }

    if (!data.user) {
      return { success: false, error: "No se recibió el usuario creado." };
    }

    const { error: upsertError } = await admin.from("profiles").upsert(
      {
        id: data.user.id,
        email: emailTrimmed,
        role,
        activo: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (upsertError) {
      console.error("createUser profiles upsert:", upsertError);
      return {
        success: true,
        message: `Usuario ${emailTrimmed} creado. Revisa en Supabase → Authentication si aparece.`,
      };
    }

    return {
      success: true,
      message: `Usuario ${emailTrimmed} creado como ${ROLE_LABELS[role]}.`,
    };
  } catch (err) {
    console.error("createUser error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al crear el usuario.",
    };
  }
}

export async function setUserActivo(userId: string, activo: boolean): Promise<CreateUserResult> {
  try {
    const sesion = await exigirSuperadmin();
    if (!sesion.ok) return { success: false, error: sesion.error };
    if (userId === sesion.id) {
      return { success: false, error: "No puedes desactivar tu propio acceso." };
    }

    const admin = createAdminClient();
    const { data: destino } = await admin.from("profiles").select("id, role, email").eq("id", userId).maybeSingle();
    if (!destino) return { success: false, error: "No existe ese usuario." };
    if (parseRole(destino.role) === "superadmin") {
      return { success: false, error: "No se puede desactivar al superadministrador." };
    }

    const { error } = await admin
      .from("profiles")
      .update({ activo, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (error) return { success: false, error: error.message };

    const { error: banError } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: activo ? "none" : "876000h",
    });
    if (banError) {
      console.error("setUserActivo ban:", banError);
    }

    return {
      success: true,
      message: activo ? `Acceso reactivado para ${destino.email}.` : `Acceso desactivado para ${destino.email}.`,
    };
  } catch (err) {
    console.error("setUserActivo error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "No se ha podido actualizar el acceso.",
    };
  }
}

export async function deleteUserAccess(userId: string): Promise<CreateUserResult> {
  try {
    const sesion = await exigirSuperadmin();
    if (!sesion.ok) return { success: false, error: sesion.error };
    if (userId === sesion.id) {
      return { success: false, error: "No puedes eliminar tu propio acceso." };
    }

    const admin = createAdminClient();
    const { data: destino } = await admin.from("profiles").select("id, role, email").eq("id", userId).maybeSingle();
    if (!destino) return { success: false, error: "No existe ese usuario." };
    if (parseRole(destino.role) === "superadmin") {
      return { success: false, error: "No se puede eliminar al superadministrador." };
    }

    await admin
      .from("profiles")
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq("id", userId);
    await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" }).catch(() => undefined);

    const { error: delError } = await admin.auth.admin.deleteUser(userId);
    if (delError) {
      return {
        success: true,
        message: `Acceso de ${destino.email} cortado. El historial se conserva porque tiene datos en el CRM.`,
      };
    }

    return {
      success: true,
      message: `Usuario ${destino.email} eliminado.`,
    };
  } catch (err) {
    console.error("deleteUserAccess error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "No se ha podido eliminar el acceso.",
    };
  }
}
