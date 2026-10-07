import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { relacionUno, TIPO_CITA_LABEL, type TipoCita } from "@/lib/citas/citas";
import { canalDeTipo } from "@/lib/alertas/prefs";
import { publicarAviso } from "@/lib/alertas/publicar";
import { horaMadrid } from "@/lib/alertas/ventana";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Cuerpo = { tipo?: string; id?: string };

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Cuerpo | null;
  const tipo = body?.tipo;
  const id = body?.id?.trim();
  if (!id || (tipo !== "mencion" && tipo !== "cita" && tipo !== "tarea")) {
    return NextResponse.json({ ok: false, error: "Aviso no reconocido." }, { status: 400 });
  }

  try {
    if (tipo === "mencion") return await avisarMencion(supabase, user.id, id);
    if (tipo === "cita") return await avisarCita(supabase, user.id, id);
    return await avisarTarea(supabase, user.id, id);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo avisar." },
      { status: 500 }
    );
  }
}

async function nombreDe(userId: string): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("nombre_completo, email").eq("id", userId).maybeSingle();
  const nombre = data?.nombre_completo?.trim();
  if (nombre) return nombre;
  const email = data?.email?.trim();
  if (email) return email.split("@")[0] ?? "Alguien";
  return "Alguien";
}

async function avisarMencion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actorId: string,
  actividadId: string
) {
  const { data: nota } = await supabase
    .from("tareas_actividad")
    .select("id, texto, actor_id, mencionados, tareas:tarea_id(id, titulo)")
    .eq("id", actividadId)
    .maybeSingle();
  if (!nota) return NextResponse.json({ ok: false, error: "Comentario no encontrado." }, { status: 404 });
  if (nota.actor_id !== actorId) {
    return NextResponse.json({ ok: false, error: "Solo quien escribe el comentario puede avisar." }, { status: 403 });
  }
  const mencionados = (nota.mencionados ?? []).filter((id) => id && id !== actorId);
  if (mencionados.length === 0) return NextResponse.json({ ok: true, avisos: 0 });

  const tarea = relacionUno(nota.tareas as { id?: string; titulo?: string | null } | { id?: string; titulo?: string | null }[] | null);
  const tituloTarea = tarea?.titulo?.trim() || "una tarea";
  const quien = await nombreDe(actorId);
  const extracto = nota.texto.trim().slice(0, 140);
  let avisos = 0;
  for (const userId of mencionados) {
    const resultado = await publicarAviso({
      userId,
      clave: `mencion:${nota.id}:${userId}`,
      titulo: `${quien} te ha mencionado`,
      cuerpo: `${tituloTarea}: ${extracto}`,
      url: "/tareas",
      canal: "menciones",
    });
    if (resultado === "nuevo") avisos += 1;
  }
  return NextResponse.json({ ok: true, avisos });
}

async function avisarCita(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actorId: string,
  citaId: string
) {
  const { data: cita } = await supabase
    .from("citas")
    .select("id, comercial_id, titulo, empieza, tipo, lugar")
    .eq("id", citaId)
    .maybeSingle();
  if (!cita?.comercial_id) return NextResponse.json({ ok: false, error: "Cita no encontrada." }, { status: 404 });
  if (cita.comercial_id === actorId) return NextResponse.json({ ok: true, avisos: 0, motivo: "propia" });

  const tipo = cita.tipo in TIPO_CITA_LABEL ? TIPO_CITA_LABEL[cita.tipo as TipoCita] : "Cita";
  const quien = await nombreDe(actorId);
  const hora = horaMadrid(cita.empieza);
  const resultado = await publicarAviso({
    userId: cita.comercial_id,
    clave: `asig:cita:${cita.id}:${cita.comercial_id}:${cita.empieza}`,
    titulo: `${quien} te ha asignado una ${tipo.toLowerCase()}`,
    cuerpo: [hora, cita.titulo, cita.lugar?.trim()].filter(Boolean).join(" · "),
    url: `/calendario?cita=${cita.id}`,
    canal: canalDeTipo(cita.tipo),
  });
  return NextResponse.json({ ok: true, avisos: resultado === "nuevo" ? 1 : 0, estado: resultado });
}

async function avisarTarea(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actorId: string,
  tareaId: string
) {
  const { data: tarea } = await supabase
    .from("tareas")
    .select("id, comercial_id, titulo, vence, hora")
    .eq("id", tareaId)
    .maybeSingle();
  if (!tarea?.comercial_id) return NextResponse.json({ ok: false, error: "Tarea no encontrada." }, { status: 404 });
  if (tarea.comercial_id === actorId) return NextResponse.json({ ok: true, avisos: 0, motivo: "propia" });

  const quien = await nombreDe(actorId);
  const cuando = [tarea.vence?.slice(0, 10), tarea.hora?.slice(0, 5)].filter(Boolean).join(" ");
  const resultado = await publicarAviso({
    userId: tarea.comercial_id,
    clave: `asig:tarea:${tarea.id}:${tarea.comercial_id}:${tarea.vence ?? ""}:${tarea.hora ?? ""}`,
    titulo: `${quien} te ha asignado una tarea`,
    cuerpo: [cuando, tarea.titulo].filter(Boolean).join(" · "),
    url: "/tareas",
    canal: "tareas_hoy",
  });
  return NextResponse.json({ ok: true, avisos: resultado === "nuevo" ? 1 : 0, estado: resultado });
}
