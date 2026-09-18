"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUser, deleteUserAccess } from "@/lib/actions/usuarios";
import { isAdmin, isSuperAdmin, parseRole, type Role } from "@/lib/auth/roles";
import type { AccionPapelera, PapeleraItem, TipoDocumentoPapelera, TipoPapelera } from "@/lib/papelera/papelera";
import { tablaDocumentoPapelera } from "@/lib/papelera/papelera";

type Result = { ok: true; message?: string } | { ok: false; error: string };

async function sesionAdmin(): Promise<
  | { ok: true; id: string; superadmin: boolean }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Debes iniciar sesión." };
  const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = parseRole(perfil?.role);
  if (!isAdmin(role)) return { ok: false, error: "No autorizado." };
  return { ok: true, id: user.id, superadmin: isSuperAdmin(role) };
}

async function encolar(
  input: {
    tipo: TipoPapelera;
    accion: AccionPapelera;
    entityId: string | null;
    etiqueta: string;
    snapshot: Record<string, unknown>;
    solicitadoPor: string;
  },
  admin: ReturnType<typeof createAdminClient>
): Promise<Result> {
  const { error } = await admin.from("papelera_items").insert({
    tipo: input.tipo,
    accion: input.accion,
    entity_id: input.entityId,
    etiqueta: input.etiqueta,
    snapshot: input.snapshot,
    solicitado_por: input.solicitadoPor,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, message: "Enviado a la papelera." };
}

function etiquetaDocumento(tipo: TipoDocumentoPapelera, fila: Record<string, unknown>): string {
  if (tipo === "parte_visita") {
    return (fila.visitante_nombre as string | null) || (fila.inmueble_direccion as string | null) || "Parte de visita";
  }
  return (fila.finca_descripcion as string | null) || "Contrato de arras";
}

/** Recupera soft deletes que no llegaron a papelera_items (p. ej. fallo previo al encolar). */
async function sincronizarDocumentosHuerfanos(admin: ReturnType<typeof createAdminClient>) {
  const tipos: TipoDocumentoPapelera[] = ["parte_visita", "contrato_arras"];
  for (const tipo of tipos) {
    const tabla = tablaDocumentoPapelera(tipo);
    const { data: borrados } = await admin
      .from(tabla)
      .select("id, visitante_nombre, inmueble_direccion, finca_descripcion, compradores, vendedores, deleted_at, deleted_by")
      .not("deleted_at", "is", null);
    if (!borrados?.length) continue;

    const ids = borrados.map((f) => f.id as string);
    const { data: pendientes } = await admin
      .from("papelera_items")
      .select("entity_id")
      .eq("tipo", tipo)
      .eq("accion", "eliminar")
      .is("resuelto_at", null)
      .in("entity_id", ids);
    const yaEncolados = new Set((pendientes ?? []).map((p) => p.entity_id as string));

    for (const fila of borrados) {
      const entityId = fila.id as string;
      const solicitadoPor = fila.deleted_by as string | null;
      if (yaEncolados.has(entityId) || !solicitadoPor) continue;
      await encolar(
        {
          tipo,
          accion: "eliminar",
          entityId,
          etiqueta: etiquetaDocumento(tipo, fila as Record<string, unknown>),
          snapshot: fila as Record<string, unknown>,
          solicitadoPor,
        },
        admin
      );
    }
  }
}

export async function eliminarDocumentos(tipo: TipoDocumentoPapelera, ids: string[]): Promise<Result> {
  const sesion = await sesionAdmin();
  if (!sesion.ok) return { ok: false, error: sesion.error };
  if (ids.length === 0) return { ok: false, error: "Nada que eliminar." };

  const admin = createAdminClient();
  const tabla = tablaDocumentoPapelera(tipo);

  const { data: filas, error: readErr } = await admin
    .from(tabla)
    .select("id, visitante_nombre, inmueble_direccion, finca_descripcion, compradores, vendedores, deleted_at")
    .in("id", ids);
  if (readErr) return { ok: false, error: readErr.message };
  const vivas = (filas ?? []).filter((f) => !f.deleted_at);
  if (vivas.length === 0) return { ok: false, error: "Ya están en la papelera." };

  const ahora = new Date().toISOString();
  const { error: softErr } = await admin
    .from(tabla)
    .update({ deleted_at: ahora, deleted_by: sesion.id })
    .in(
      "id",
      vivas.map((f) => f.id)
    );
  if (softErr) return { ok: false, error: softErr.message };

  for (const f of vivas) {
    const r = await encolar(
      {
        tipo,
        accion: "eliminar",
        entityId: f.id as string,
        etiqueta: etiquetaDocumento(tipo, f as Record<string, unknown>),
        snapshot: f as Record<string, unknown>,
        solicitadoPor: sesion.id,
      },
      admin
    );
    if (!r.ok) return r;
  }

  return {
    ok: true,
    message: vivas.length === 1 ? "Enviado a la papelera." : `${vivas.length} enviados a la papelera.`,
  };
}

export async function solicitarCrearUsuario(
  email: string,
  password: string,
  role: Role
): Promise<Result> {
  const sesion = await sesionAdmin();
  if (!sesion.ok) return { ok: false, error: sesion.error };

  if (sesion.superadmin) {
    const r = await createUser(email, password, role);
    return r.success ? { ok: true, message: r.message } : { ok: false, error: r.error };
  }

  const admin = createAdminClient();
  return encolar(
    {
      tipo: "usuario",
      accion: "crear",
      entityId: null,
      etiqueta: email.trim().toLowerCase(),
      snapshot: { email: email.trim().toLowerCase(), password, role },
      solicitadoPor: sesion.id,
    },
    admin
  );
}

export async function solicitarEliminarUsuario(userId: string): Promise<Result> {
  const sesion = await sesionAdmin();
  if (!sesion.ok) return { ok: false, error: sesion.error };
  if (userId === sesion.id) return { ok: false, error: "No puedes eliminar tu propio acceso." };

  if (sesion.superadmin) {
    const r = await deleteUserAccess(userId);
    return r.success ? { ok: true, message: r.message } : { ok: false, error: r.error };
  }

  const admin = createAdminClient();
  const { data: destino } = await admin
    .from("profiles")
    .select("id, role, email, nombre_completo")
    .eq("id", userId)
    .maybeSingle();
  if (!destino) return { ok: false, error: "No existe ese usuario." };
  if (parseRole(destino.role) === "superadmin") {
    return { ok: false, error: "No se puede eliminar al superadministrador." };
  }

  return encolar(
    {
      tipo: "usuario",
      accion: "eliminar",
      entityId: userId,
      etiqueta: destino.nombre_completo || destino.email || "Usuario",
      snapshot: {
        userId,
        email: destino.email,
        nombre: destino.nombre_completo,
        role: destino.role,
      },
      solicitadoPor: sesion.id,
    },
    admin
  );
}

async function listarPapeleraPorTipos(tipos: TipoPapelera[]): Promise<PapeleraItem[] | { error: string }> {
  const sesion = await sesionAdmin();
  if (!sesion.ok) return { error: sesion.error };
  if (!sesion.superadmin) return { error: "Solo el superadministrador ve la papelera." };

  const admin = createAdminClient();
  const incluyeDocumentos = tipos.some((t) => t === "parte_visita" || t === "contrato_arras");
  if (incluyeDocumentos) await sincronizarDocumentosHuerfanos(admin);

  const { data, error } = await admin
    .from("papelera_items")
    .select(
      "id, tipo, accion, entity_id, etiqueta, snapshot, solicitado_por, created_at, resuelto_at, resolucion, solicitante:solicitado_por(nombre_completo, email)"
    )
    .in("tipo", tipos)
    .is("resuelto_at", null)
    .order("created_at", { ascending: false });
  if (error) return { error: error.message };

  return ((data ?? []) as Array<PapeleraItem & { solicitante?: PapeleraItem["solicitante"] | PapeleraItem["solicitante"][] }>).map(
    (row) => ({
      ...row,
      solicitante: Array.isArray(row.solicitante) ? row.solicitante[0] ?? null : row.solicitante ?? null,
    })
  );
}

export async function listarPapeleraDocumentos(
  tipo: TipoDocumentoPapelera
): Promise<PapeleraItem[] | { error: string }> {
  return listarPapeleraPorTipos([tipo]);
}

export async function listarPapeleraUsuarios(): Promise<PapeleraItem[] | { error: string }> {
  return listarPapeleraPorTipos(["usuario"]);
}

export async function resolverPapelera(itemId: string, accion: "aprobar" | "rechazar" | "restaurar"): Promise<Result> {
  const sesion = await sesionAdmin();
  if (!sesion.ok) return { ok: false, error: sesion.error };
  if (!sesion.superadmin) return { ok: false, error: "Solo el superadministrador puede resolver la papelera." };

  const admin = createAdminClient();
  const { data: item, error } = await admin
    .from("papelera_items")
    .select("*")
    .eq("id", itemId)
    .is("resuelto_at", null)
    .maybeSingle();
  if (error || !item) return { ok: false, error: "Solicitud no encontrada." };

  const ahora = new Date().toISOString();
  const marcar = async (resolucion: string) => {
    await admin
      .from("papelera_items")
      .update({ resuelto_at: ahora, resuelto_por: sesion.id, resolucion })
      .eq("id", itemId);
  };

  if (accion === "rechazar") {
    if (item.tipo !== "usuario" && item.accion === "eliminar" && item.entity_id) {
      await admin
        .from(tablaDocumentoPapelera(item.tipo as TipoDocumentoPapelera))
        .update({ deleted_at: null, deleted_by: null })
        .eq("id", item.entity_id);
    }
    await marcar("rechazado");
    return { ok: true, message: "Solicitud rechazada." };
  }

  if (accion === "restaurar") {
    if (item.accion === "eliminar" && item.entity_id && item.tipo !== "usuario") {
      await admin
        .from(tablaDocumentoPapelera(item.tipo as TipoDocumentoPapelera))
        .update({ deleted_at: null, deleted_by: null })
        .eq("id", item.entity_id);
    }
    await marcar("restaurado");
    return { ok: true, message: "Restaurado." };
  }

  // aprobar
  if (item.tipo === "usuario") {
    const snap = item.snapshot as Record<string, unknown>;
    if (item.accion === "crear") {
      const r = await createUser(String(snap.email), String(snap.password), parseRole(snap.role));
      if (!r.success) return { ok: false, error: r.error };
      await marcar("aprobado");
      return { ok: true, message: r.message };
    }
    const userId = String(snap.userId ?? item.entity_id);
    const r = await deleteUserAccess(userId);
    if (!r.success) return { ok: false, error: r.error };
    await marcar("aprobado");
    return { ok: true, message: r.message };
  }

  if (item.accion === "eliminar" && item.entity_id) {
    const { error: delErr } = await admin
      .from(tablaDocumentoPapelera(item.tipo as TipoDocumentoPapelera))
      .delete()
      .eq("id", item.entity_id);
    if (delErr) return { ok: false, error: delErr.message };
    await marcar("aprobado");
    return { ok: true, message: "Eliminado definitivamente." };
  }

  return { ok: false, error: "Solicitud no válida." };
}
