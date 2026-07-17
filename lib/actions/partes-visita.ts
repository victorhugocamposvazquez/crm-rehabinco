"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  firmarParteVisitaSchema,
  type FirmarParteVisitaValues,
} from "@/lib/validations/parte-visita";
import type { Database } from "@/lib/supabase/types";

export type ParteVisitaPublic = Pick<
  Database["public"]["Tables"]["partes_visita"]["Row"],
  | "id"
  | "token"
  | "estado"
  | "visitante_nombre"
  | "visitante_documento"
  | "visitante_telefono"
  | "visitante_email"
  | "inmueble_direccion"
  | "inmueble_referencia"
  | "fecha_visita"
  | "hora_visita"
  | "agente_nombre"
  | "observaciones"
  | "lugar_firma"
  | "firma_visitante"
  | "firma_agente"
  | "firmado_en"
>;

export type PublicParteResult =
  | { success: true; parte: ParteVisitaPublic }
  | { success: false; error: string };

export type FirmarParteResult =
  | { success: true }
  | { success: false; error: string };

export async function getParteVisitaPublic(
  token: string
): Promise<PublicParteResult> {
  try {
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuid.test(token)) {
      return { success: false, error: "Enlace no válido." };
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("partes_visita")
      .select(
        "id, token, estado, visitante_nombre, visitante_documento, visitante_telefono, visitante_email, inmueble_direccion, inmueble_referencia, fecha_visita, hora_visita, agente_nombre, observaciones, lugar_firma, firma_visitante, firma_agente, firmado_en"
      )
      .eq("token", token)
      .maybeSingle();

    if (error) {
      return { success: false, error: "No se pudo cargar el parte de visita." };
    }
    if (!data) {
      return { success: false, error: "Parte de visita no encontrado." };
    }

    return { success: true, parte: data as ParteVisitaPublic };
  } catch {
    return { success: false, error: "No se pudo cargar el parte de visita." };
  }
}

export async function firmarParteVisitaPublic(
  input: FirmarParteVisitaValues
): Promise<FirmarParteResult> {
  try {
    const parsed = firmarParteVisitaSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Datos incompletos.",
      };
    }

    const values = parsed.data;
    const admin = createAdminClient();

    const { data: existing, error: fetchError } = await admin
      .from("partes_visita")
      .select("id, estado")
      .eq("token", values.token)
      .maybeSingle();

    if (fetchError || !existing) {
      return { success: false, error: "Parte de visita no encontrado." };
    }
    if (existing.estado === "firmado") {
      return { success: false, error: "Este parte ya está firmado." };
    }
    if (existing.estado === "borrador") {
      return {
        success: false,
        error: "Este parte aún no está listo para firmar.",
      };
    }

    const { error: updateError } = await admin
      .from("partes_visita")
      .update({
        visitante_nombre: values.visitante_nombre.trim(),
        visitante_documento: values.visitante_documento.trim(),
        visitante_telefono: values.visitante_telefono?.trim() || null,
        visitante_email: values.visitante_email?.trim() || null,
        observaciones: values.observaciones?.trim() || null,
        firma_visitante: values.firma_visitante,
        firma_agente: values.firma_agente,
        estado: "firmado",
        firmado_en: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("token", values.token)
      .eq("estado", "pendiente_firma");

    if (updateError) {
      return { success: false, error: "No se pudo guardar la firma." };
    }

    return { success: true };
  } catch {
    return { success: false, error: "No se pudo guardar la firma." };
  }
}
