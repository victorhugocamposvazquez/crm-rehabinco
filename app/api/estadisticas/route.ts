import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { permisoDeSesion } from "@/lib/auth/permiso-servidor";
import { parseRole } from "@/lib/auth/roles";
import { nombreComercial } from "@/lib/catastro-host/finca-assignment";
import {
  calcularEstadisticasEquipo,
  type PeriodoEstadisticas,
  type EstadisticasRawInput,
} from "@/lib/estadisticas/calcular";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PERIODOS_VALIDOS: readonly PeriodoEstadisticas[] = [
  "semana",
  "mes",
  "trimestre",
  "anio",
  "todo",
];

function parsePeriodo(valor: string | null): PeriodoEstadisticas {
  if (valor && (PERIODOS_VALIDOS as readonly string[]).includes(valor)) {
    return valor as PeriodoEstadisticas;
  }
  return "mes";
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ ok: false, error: "Sesión expirada." }, { status: 401 });
  }

  const permitido = await permisoDeSesion("informes");
  if (!permitido) {
    return Response.json(
      { ok: false, error: "No tienes acceso a Estadísticas y Ranking." },
      { status: 403 }
    );
  }

  const url = new URL(request.url);
  const periodo = parsePeriodo(url.searchParams.get("periodo"));

  let db = supabase;
  try {
    db = createAdminClient() as unknown as typeof supabase;
  } catch {
    db = supabase;
  }

  const [
    perfilesRes,
    propiedadesRes,
    captadoresRes,
    partesVisitaRes,
    citasRes,
    arrasRes,
    pagoAplazadoRes,
    arrendamientosRes,
    exclusivasRes,
    honorariosRes,
    fincasAssignRes,
    fincasLinksRes,
    encargosCalleRes,
    demandasRes,
    notasClientesRes,
    tareasRes,
    valoracionesRes,
  ] = await Promise.all([
    db
      .from("profiles")
      .select("id, nombre_completo, email, role, color, foto_url, activo")
      .in("role", ["comercial", "agente", "admin", "superadmin", "catastro_user"])
      .eq("activo", true)
      .order("nombre_completo"),
    db
      .from("propiedades")
      .select(
        "id, user_id, comercial_id, captado_por, captado_conjunto, estado, tipo_operacion, precio_venta, precio_alquiler, publicado, publicar_web, publicar_idealista, created_at, updated_at, deleted_at"
      )
      .is("deleted_at", null),
    db.from("propiedad_captadores").select("propiedad_id, profile_id"),
    db
      .from("partes_visita")
      .select("id, user_id, comercial_id, estado, fecha_visita, created_at"),
    db.from("citas").select("id, comercial_id, tipo, estado, empieza"),
    db
      .from("contratos_arras")
      .select("id, user_id, comercial_id, propiedad_id, estado, precio, fecha, created_at"),
    db
      .from("contratos_pago_aplazado")
      .select(
        "id, user_id, comercial_id, propiedad_id, estado, precio, fecha, created_at, deleted_at"
      )
      .is("deleted_at", null),
    db
      .from("contratos_arrendamiento")
      .select(
        "id, user_id, comercial_id, propiedad_id, estado, renta_anual, renta_mensual, fecha, created_at, deleted_at"
      )
      .is("deleted_at", null),
    db
      .from("hojas_encargo_exclusiva")
      .select("id, user_id, comercial_id, estado, precio_venta, fecha, created_at, deleted_at")
      .is("deleted_at", null),
    db
      .from("hojas_encargo_honorarios")
      .select("id, user_id, comercial_id, estado, fecha, created_at, deleted_at")
      .is("deleted_at", null),
    db
      .from("catastro_explorer_assignments")
      .select(
        "finca_reference, comercial_id, assigned_at, catastro_explorer_pipeline(estado, updated_at)"
      ),
    db.from("catastro_property_links").select("finca_reference, property_id"),
    db
      .from("captacion_encargos")
      .select("id, asignado_a, estado, finca_reference, created_at, updated_at"),
    db
      .from("demandas")
      .select("id, comercial_id, estado, created_at, demanda_inmuebles(id)"),
    db.from("clientes_notas").select("id, actor_id, tipo, created_at"),
    db.from("tareas").select("id, comercial_id, estado, vence, created_at"),
    db
      .from("avm_valuations")
      .select("id, created_by, created_at, deleted_at")
      .is("deleted_at", null),
  ]);

  const captadoresPorPropiedad = new Map<string, string[]>();
  for (const fila of captadoresRes.data ?? []) {
    if (!fila.propiedad_id || !fila.profile_id) continue;
    const lista = captadoresPorPropiedad.get(fila.propiedad_id) ?? [];
    lista.push(fila.profile_id);
    captadoresPorPropiedad.set(fila.propiedad_id, lista);
  }

  const fincasConPropiedad = new Set<string>(
    (fincasLinksRes.data ?? [])
      .filter((item) => Boolean(item.property_id))
      .map((item) => String(item.finca_reference))
  );

  const raw: EstadisticasRawInput = {
    usuarios: (perfilesRes.data ?? []).map((p) => ({
      id: p.id,
      nombre: nombreComercial(p),
      email: p.email,
      role: parseRole(p.role),
      color: p.color || "#111111",
      fotoUrl: p.foto_url ?? null,
    })),
    propiedades: (propiedadesRes.data ?? []).map((p) => ({
      id: p.id,
      userId: p.user_id,
      comercialId: p.comercial_id,
      captadoPor: p.captado_por,
      captadoConjunto: Boolean(p.captado_conjunto),
      captadoresIds: captadoresPorPropiedad.get(p.id) ?? [],
      estado: p.estado,
      tipoOperacion: p.tipo_operacion,
      precioVenta: p.precio_venta,
      precioAlquiler: p.precio_alquiler,
      publicado: Boolean(p.publicado),
      publicarWeb: Boolean(p.publicar_web),
      publicarIdealista: Boolean(p.publicar_idealista),
      createdAt: p.created_at,
      updatedAt: p.updated_at || p.created_at,
    })),
    partesVisita: (partesVisitaRes.data ?? []).map((v) => ({
      id: v.id,
      userId: v.user_id,
      comercialId: v.comercial_id,
      estado: v.estado,
      fechaVisita: v.fecha_visita,
      createdAt: v.created_at,
    })),
    citas: (citasRes.data ?? []).map((c) => ({
      id: c.id,
      comercialId: c.comercial_id,
      tipo: c.tipo,
      estado: c.estado,
      empieza: c.empieza,
    })),
    arras: (arrasRes.data ?? []).map((a) => ({
      id: a.id,
      userId: a.user_id,
      comercialId: a.comercial_id,
      propiedadId: a.propiedad_id,
      estado: a.estado,
      importe: a.precio,
      fecha: a.fecha,
      createdAt: a.created_at,
    })),
    pagoAplazado: (pagoAplazadoRes.data ?? []).map((pa) => ({
      id: pa.id,
      userId: pa.user_id,
      comercialId: pa.comercial_id,
      propiedadId: pa.propiedad_id,
      estado: pa.estado,
      importe: pa.precio,
      fecha: pa.fecha,
      createdAt: pa.created_at,
    })),
    arrendamientos: (arrendamientosRes.data ?? []).map((ar) => ({
      id: ar.id,
      userId: ar.user_id,
      comercialId: ar.comercial_id,
      propiedadId: ar.propiedad_id,
      estado: ar.estado,
      importe: ar.renta_anual ?? (ar.renta_mensual ? Number(ar.renta_mensual) * 12 : null),
      fecha: ar.fecha,
      createdAt: ar.created_at,
    })),
    hojasEncargo: [
      ...(exclusivasRes.data ?? []).map((h) => ({
        id: h.id,
        userId: h.user_id,
        comercialId: h.comercial_id,
        tipo: "exclusiva" as const,
        estado: h.estado,
        precio: h.precio_venta,
        fecha: h.fecha,
        createdAt: h.created_at,
      })),
      ...(honorariosRes.data ?? []).map((h) => ({
        id: h.id,
        userId: h.user_id,
        comercialId: h.comercial_id,
        tipo: "honorarios" as const,
        estado: h.estado,
        precio: null,
        fecha: h.fecha,
        createdAt: h.created_at,
      })),
    ],
    fincas: (fincasAssignRes.data ?? []).map((f) => {
      const pipe = Array.isArray(f.catastro_explorer_pipeline)
        ? f.catastro_explorer_pipeline[0]
        : f.catastro_explorer_pipeline;
      const ref = String(f.finca_reference);
      return {
        fincaReference: ref,
        comercialId: f.comercial_id,
        estado: pipe?.estado ?? "nueva",
        conPropiedad: fincasConPropiedad.has(ref),
        assignedAt: f.assigned_at,
        updatedAt: pipe?.updated_at ?? null,
      };
    }),
    encargosCalle: (encargosCalleRes.data ?? []).map((e) => ({
      id: e.id,
      asignadoA: e.asignado_a,
      estado: e.estado,
      fincaReference: e.finca_reference,
      createdAt: e.created_at,
      updatedAt: e.updated_at,
    })),
    demandas: (demandasRes.data ?? []).map((d) => ({
      id: d.id,
      comercialId: d.comercial_id,
      estado: d.estado,
      crucesCount: Array.isArray(d.demanda_inmuebles)
        ? d.demanda_inmuebles.length
        : d.demanda_inmuebles
          ? 1
          : 0,
      createdAt: d.created_at,
    })),
    notasClientes: (notasClientesRes.data ?? []).map((n) => ({
      id: n.id,
      actorId: n.actor_id,
      tipo: n.tipo,
      createdAt: n.created_at,
    })),
    tareas: (tareasRes.data ?? []).map((t) => ({
      id: t.id,
      comercialId: t.comercial_id,
      estado: t.estado,
      vence: t.vence,
      createdAt: t.created_at,
    })),
    valoraciones: (valoracionesRes.data ?? []).map((val) => ({
      id: val.id,
      actorId: val.created_by,
      createdAt: val.created_at,
    })),
  };

  const resultado = calcularEstadisticasEquipo(raw, { periodo });

  return Response.json({
    ok: true,
    miUserId: user.id,
    ...resultado,
  });
}
