import { puedeAsignarFincas } from "@/lib/auth/roles";
import { uuidComercial } from "@/lib/catastro-host/finca-assignment";
import { explorerStoreDesdeSesion, respuestaSesion } from "@/lib/catastro-host/from-request";
import { importarSiNoExiste } from "@/lib/captacion/encargos-db";
import { encargosDesdeXlsx, FUENTE_EXCEL_CAPTACION } from "@/lib/captacion/importar-excel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { user, role, supabase } = await explorerStoreDesdeSesion();
  const sinSesion = respuestaSesion(user);
  if (sinSesion) return sinSesion;
  if (!user || !puedeAsignarFincas(role)) {
    return Response.json({ ok: false, error: "Solo quien encarga puede importar." }, { status: 403 });
  }

  const form = await request.formData();
  const archivo = form.get("archivo");
  const asignadoA = uuidComercial(form.get("asignadoA"));
  if (!(archivo instanceof File)) {
    return Response.json({ ok: false, error: "Falta el Excel." }, { status: 400 });
  }
  if (!asignadoA) {
    return Response.json({ ok: false, error: "Falta a quién se lo encargas." }, { status: 400 });
  }

  try {
    const leido = await encargosDesdeXlsx(await archivo.arrayBuffer(), {
      municipio: "A Coruña",
      fuente: archivo.name || FUENTE_EXCEL_CAPTACION,
    });
    if (leido.errores.length > 0) {
      return Response.json({ ok: false, error: leido.errores[0] }, { status: 400 });
    }
    const resultado = await importarSiNoExiste(supabase, {
      asignadoA,
      asignadoPor: user.id,
      fuente: archivo.name || FUENTE_EXCEL_CAPTACION,
      encargos: leido.encargos,
    });
    return Response.json({ ok: true, ...resultado, leidos: leido.encargos.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se ha podido importar.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
