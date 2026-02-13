"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export type CreateUserResult =
  | { success: true; message: string }
  | { success: false; error: string };

export async function createUser(
  email: string,
  password: string,
  role: "admin" | "agente"
): Promise<CreateUserResult> {
  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!currentUser) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", currentUser.id)
    .single();

  if (profile?.role !== "admin") {
    return { success: false, error: "Solo los administradores pueden crear usuarios." };
  }

  const emailTrimmed = email.trim().toLowerCase();
  if (!emailTrimmed) {
    return { success: false, error: "El email es obligatorio." };
  }
  if (password.length < 6) {
    return { success: false, error: "La contraseña debe tener al menos 6 caracteres." };
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: emailTrimmed,
      password,
      email_confirm: true,
      user_metadata: { role },
    });

    if (error) {
      if (error.message.includes("already been registered")) {
        return { success: false, error: "Ya existe un usuario con ese email." };
      }
      return { success: false, error: error.message };
    }

    // El trigger handle_new_user crea el perfil con role desde raw_user_meta_data
    // Por si acaso, actualizamos el perfil explícitamente
    if (data.user) {
      await admin.from("profiles").upsert(
        {
          id: data.user.id,
          email: emailTrimmed,
          role,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
    }

    return {
      success: true,
      message: `Usuario ${emailTrimmed} creado correctamente como ${role}.`,
    };
  } catch (err) {
    console.error("createUser error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al crear el usuario.",
    };
  }
}
