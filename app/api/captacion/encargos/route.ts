import { isAdmin, isCatastroUser, puedeAsignarFincas, type Role } from "@/lib/auth/roles";
import { esRolAsignable, uuidComercial } from "@/lib/catastro-host/finca-assignment";
import { explorerStoreDesdeSesion, respuestaSesion } from "@/lib/catastro-host/from-request";
import { crearEncargos, listarEncargos } from "@/lib/captacion/encargos-db";
import { operacionDesdeApunte, type EncargoImportado } from "@/lib/captacion/importar-excel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function puedeVer(role: Role | null): boolean {
  return isAdmin(role) || isCatastroUser(role) || role === "comercial";
}

export async function GET(request: Request) {
  const { user, role, supabase } = await explorerStoreDesdeSesion();
  const sinSesion = respuestaSesion(user);
  if (sinSesion) return sinSesion;
  if (!user || !puedeVer(role)) {
    return Response.json({ ok: false, error: "No tienes permiso." }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const sinFinca = params.get("sinFinca") === "1";
  const verTodos = isAdmin(role);
  try {
    const encargos = await listarEncargos(supabase, {
      asignadoA: verTodos ? undefined : user.id,
      sinFinca,
    });
    let asignables: Array<{ id: string; nombre: string }> = [];
    if (puedeAsignarFincas(role)) {
      const { data } = await supabase
        .from("profiles")
        .select("id, nombre_completo, email, role, activo")
        .in("role", ["comercial", "agente", "admin", "superadmin", "catastro_user"])
        .order("nombre_completo");
      asignables = (data ?? [])
        .filter((item) => item.activo !== false && esRolAsignable(item.role))
        .map((item) => ({
          id: item.id,
          nombre: item.nombre_completo?.trim() || item.email?.split("@")[0] || "Sin nombre",
        }));
    }
    return Response.json({
      ok: true,
      encargos,
      puedeEncargar: puedeAsignarFincas(role),
      asignables,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se han podido leer los encargos.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { user, role, supabase } = await explorerStoreDesdeSesion();
  const sinSesion = respuestaSesion(user);
  if (sinSesion) return sinSesion;
  if (!user || !puedeAsignarFincas(role)) {
    return Response.json({ ok: false, error: "Solo quien encarga puede dar de alta un portal." }, { status: 403 });
  }

  let cuerpo: Record<string, unknown> = {};
  try {
    cuerpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "Cuerpo inválido." }, { status: 400 });
  }

  const calle = typeof cuerpo.calle === "string" ? cuerpo.calle.trim() : "";
  const numero = typeof cuerpo.numero === "string" ? cuerpo.numero.trim() : "";
  const asignadoA = uuidComercial(cuerpo.asignadoA);
  if (!calle) return Response.json({ ok: false, error: "Falta la calle." }, { status: 400 });
  if (!asignadoA) return Response.json({ ok: false, error: "Falta a quién se lo encargas." }, { status: 400 });

  const encargo: EncargoImportado = {
    calle,
    numero,
    municipio: typeof cuerpo.municipio === "string" && cuerpo.municipio.trim() ? cuerpo.municipio.trim() : "A Coruña",
    tipoUso: typeof cuerpo.tipoUso === "string" ? cuerpo.tipoUso.trim() || null : null,
    operacion: operacionDesdeApunte(typeof cuerpo.operacion === "string" ? cuerpo.operacion : ""),
    contactoNombre: typeof cuerpo.contactoNombre === "string" ? cuerpo.contactoNombre.trim() || null : null,
    telefono: typeof cuerpo.telefono === "string" ? cuerpo.telefono.trim() || null : null,
    email: typeof cuerpo.email === "string" ? cuerpo.email.trim() || null : null,
    estado: "contactar",
    proximaAccion: typeof cuerpo.proximaAccion === "string" ? cuerpo.proximaAccion.trim() || null : null,
    resultado: typeof cuerpo.resultado === "string" ? cuerpo.resultado.trim() || null : null,
    notasRevision: null,
    requiereConfirmacion: false,
    prioridad: null,
    posibleDuplicado: false,
    filaOrigen: { fuente: "manual" },
  };

  try {
    await crearEncargos(supabase, {
      asignadoA,
      asignadoPor: user.id,
      origen: "manual",
      encargos: [encargo],
      detalleActividad: "Encargo creado a mano",
    });
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se ha podido crear el encargo.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
