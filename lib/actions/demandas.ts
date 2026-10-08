"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ESTADOS_DEMANDA, TIPOS_OPERACION_DEMANDA } from "@/lib/demandas/matching";
import {
  payloadActualizarDemanda,
  payloadNuevaDemanda,
  validarNuevaDemanda,
  type BorradorNuevaDemanda,
} from "@/lib/demandas/nueva";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ResultadoDemanda = { ok: true; id: string } | { ok: false; error: string };

export type ParcheDemanda = {
  zonas?: string[];
  habitaciones_min?: number | null;
  superficie_min?: number | null;
  superficie_max?: number | null;
  banos_min?: number | null;
  presupuesto_min?: number | null;
  presupuesto_max?: number | null;
  requisitos?: string | null;
  asignacion_auto?: boolean;
  asignacion_casi?: boolean;
  estado?: string;
};

function detalle(error: { message?: string } | null, fallback: string): string {
  const texto = error?.message?.trim();
  if (!texto) return fallback;
  return `${fallback} ${texto}`;
}

async function equipo(): Promise<
  | { ok: true; userId: string; admin: ReturnType<typeof createAdminClient> }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión expirada. Vuelve a entrar." };

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "No se ha podido guardar la demanda. Falta la clave del servidor." };
  }

  const { data: perfil } = await admin.from("profiles").select("role, activo").eq("id", user.id).maybeSingle();
  if (perfil?.activo === false) return { ok: false, error: "Sesión expirada. Vuelve a entrar." };
  if (perfil?.role === "editor") return { ok: false, error: "No puedes guardar demandas." };
  if (!perfil) {
    await admin.from("profiles").insert({ id: user.id, email: user.email ?? null, role: "comercial" });
  }
  return { ok: true, userId: user.id, admin };
}

async function marcarCliente(admin: ReturnType<typeof createAdminClient>, clienteId: string) {
  try {
    await admin.from("clientes").update({ es_cliente: true }).eq("id", clienteId).neq("es_cliente", true);
  } catch {
    // La demanda ya está guardada. Marcar el contacto no puede deshacerla.
  }
}

export async function guardarDemanda(input: {
  id?: string | null;
  borrador: BorradorNuevaDemanda;
}): Promise<ResultadoDemanda> {
  const sesion = await equipo();
  if (!sesion.ok) return sesion;

  const borrador = {
    ...input.borrador,
    comercialId: input.borrador.comercialId || sesion.userId,
  };
  const fallo = validarNuevaDemanda(borrador);
  if (fallo) return { ok: false, error: fallo };
  if (!UUID.test(borrador.clienteId) || !UUID.test(borrador.comercialId)) {
    return { ok: false, error: "Elige o crea un cliente." };
  }
  if (!TIPOS_OPERACION_DEMANDA.includes(borrador.tipoOperacion)) {
    return { ok: false, error: "Elige compra, alquiler o ambos." };
  }

  const { admin } = sesion;
  if (input.id) {
    if (!UUID.test(input.id)) return { ok: false, error: "No se ha podido guardar la demanda." };
    const { data, error } = await admin
      .from("demandas")
      .update({ ...payloadActualizarDemanda(borrador), updated_at: new Date().toISOString() })
      .eq("id", input.id)
      .select("id")
      .maybeSingle();
    if (error || !data) return { ok: false, error: detalle(error, "No se ha podido guardar la demanda.") };
    await marcarCliente(admin, borrador.clienteId);
    return { ok: true, id: data.id };
  }

  const { data, error } = await admin
    .from("demandas")
    .insert(payloadNuevaDemanda(borrador))
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: detalle(error, "No se ha podido crear la demanda.") };
  await marcarCliente(admin, borrador.clienteId);
  return { ok: true, id: data.id };
}

function numero(valor: unknown): number | null | undefined {
  if (valor == null) return null;
  if (typeof valor !== "number" || !Number.isFinite(valor)) return undefined;
  return valor;
}

export async function actualizarDemanda(id: string, parche: ParcheDemanda): Promise<ResultadoDemanda> {
  const sesion = await equipo();
  if (!sesion.ok) return sesion;
  if (!UUID.test(id)) return { ok: false, error: "No se ha podido guardar la demanda." };

  const fila: Record<string, string | number | boolean | string[] | null> = {
    updated_at: new Date().toISOString(),
  };

  if ("zonas" in parche) {
    if (!Array.isArray(parche.zonas) || parche.zonas.some((zona) => typeof zona !== "string")) {
      return { ok: false, error: "No se han podido guardar los criterios." };
    }
    fila.zonas = parche.zonas;
  }
  for (const campo of ["habitaciones_min", "superficie_min", "superficie_max", "banos_min", "presupuesto_min", "presupuesto_max"] as const) {
    if (!(campo in parche)) continue;
    const valor = numero(parche[campo]);
    if (valor === undefined) return { ok: false, error: "No se han podido guardar los criterios." };
    fila[campo] = valor;
  }
  if ("requisitos" in parche) {
    if (parche.requisitos != null && typeof parche.requisitos !== "string") {
      return { ok: false, error: "No se han podido guardar los criterios." };
    }
    fila.requisitos = parche.requisitos ?? null;
  }
  if ("asignacion_auto" in parche) {
    if (typeof parche.asignacion_auto !== "boolean") return { ok: false, error: "No se ha podido guardar el modo." };
    fila.asignacion_auto = parche.asignacion_auto;
  }
  if ("asignacion_casi" in parche) {
    if (typeof parche.asignacion_casi !== "boolean") return { ok: false, error: "No se ha podido guardar el modo." };
    fila.asignacion_casi = parche.asignacion_casi;
  }
  if ("estado" in parche) {
    if (!parche.estado || !ESTADOS_DEMANDA.includes(parche.estado as (typeof ESTADOS_DEMANDA)[number])) {
      return { ok: false, error: "No se ha podido guardar la demanda." };
    }
    fila.estado = parche.estado;
  }

  const { data, error } = await sesion.admin.from("demandas").update(fila).eq("id", id).select("id").maybeSingle();
  if (error || !data) {
    const fallback = "estado" in parche ? "No se ha podido mover la demanda." : "asignacion_auto" in parche ? "No se ha podido guardar el modo." : "No se han podido guardar los criterios.";
    return { ok: false, error: detalle(error, fallback) };
  }
  return { ok: true, id: data.id };
}
