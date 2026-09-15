import { createAdminClient } from "@/lib/supabase/admin";
import { agruparPorCanal, claveDigest, resumenPorCanal, tareaEnDigest, type ItemAviso } from "@/lib/alertas/digest";
import { itemPermitido, prefsCompletas, SELECT_PREFS_AVISO, type PrefsAviso } from "@/lib/alertas/prefs";
import { enviarPush } from "@/lib/alertas/web-push";
import { relacionUno } from "@/lib/citas/citas";

function horaLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(11, 16);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export async function dispararDigestAlertas(dia = new Date().toISOString().slice(0, 10)) {
  const admin = createAdminClient();
  const inicio = `${dia}T00:00:00`;
  const fin = `${dia}T23:59:59`;

  const [{ data: citas }, { data: tareas }, { data: partes }, { data: actividad }, { data: prefsRows }] = await Promise.all([
    admin
      .from("citas")
      .select("id, comercial_id, titulo, empieza, tipo, estado")
      .gte("empieza", inicio)
      .lte("empieza", fin)
      .eq("estado", "prevista"),
    admin
      .from("tareas")
      .select("id, comercial_id, titulo, vence, hora, estado")
      .lte("vence", dia)
      .eq("estado", "pendiente"),
    admin
      .from("partes_visita")
      .select("id, comercial_id, visitante_nombre, inmueble_direccion, estado")
      .eq("estado", "pendiente_firma"),
    admin
      .from("tareas_actividad")
      .select("id, texto, created_at, actor_id, mencionados, tareas:tarea_id(titulo)")
      .gte("created_at", inicio)
      .lte("created_at", fin),
    admin.from("crm_aviso_prefs").select(`user_id, ${SELECT_PREFS_AVISO}`),
  ]);

  const prefsPorUsuario = new Map<string, PrefsAviso>();
  for (const row of prefsRows ?? []) {
    prefsPorUsuario.set(row.user_id, prefsCompletas(row));
  }

  const porUsuario = new Map<string, ItemAviso[]>();
  const meter = (userId: string | null | undefined, item: ItemAviso) => {
    if (!userId) return;
    const prefs = prefsPorUsuario.get(userId) ?? prefsCompletas(null);
    if (!itemPermitido(item.tipo, prefs)) return;
    const lista = porUsuario.get(userId) ?? [];
    lista.push(item);
    porUsuario.set(userId, lista);
  };

  for (const cita of citas ?? []) {
    meter(cita.comercial_id, { titulo: cita.titulo, hora: horaLocal(cita.empieza), tipo: cita.tipo });
  }
  for (const tarea of tareas ?? []) {
    if (!tareaEnDigest(tarea.vence, dia)) continue;
    const vencida = (tarea.vence ?? "").slice(0, 10) < dia;
    meter(tarea.comercial_id, {
      titulo: vencida ? `Vencida · ${tarea.titulo}` : tarea.titulo,
      hora: tarea.hora?.slice(0, 5) ?? null,
      tipo: vencida ? "tarea-vencida" : "tarea",
    });
  }
  for (const parte of partes ?? []) {
    const quien = parte.visitante_nombre?.trim() || "Visitante";
    const donde = parte.inmueble_direccion?.trim();
    meter(parte.comercial_id, {
      titulo: donde ? `${quien} · ${donde}` : quien,
      tipo: "parte",
    });
  }
  for (const nota of actividad ?? []) {
    const mencionados = nota.mencionados ?? [];
    if (mencionados.length === 0) continue;
    const tarea = relacionUno(nota.tareas as { titulo?: string | null } | { titulo?: string | null }[] | null);
    const tituloTarea = tarea?.titulo?.trim() || "Tarea";
    const extracto = nota.texto.trim().slice(0, 80);
    for (const userId of mencionados) {
      if (!userId || userId === nota.actor_id) continue;
      meter(userId, {
        titulo: `${tituloTarea}: ${extracto}`,
        hora: horaLocal(nota.created_at),
        tipo: "mencion",
      });
    }
  }

  let enviados = 0;
  let avisos = 0;
  for (const [userId, items] of porUsuario) {
    const grupos = agruparPorCanal(items);
    const { data: subs } = await admin
      .from("crm_push_subs")
      .select("endpoint, p256dh, auth")
      .eq("user_id", userId);

    for (const [canal, delCanal] of Object.entries(grupos) as Array<[keyof typeof grupos, ItemAviso[]]>) {
      const resumen = resumenPorCanal(canal, delCanal);
      if (!resumen) continue;
      const clave = claveDigest(userId, dia, canal);
      const { data: existente } = await admin.from("crm_avisos").select("id").eq("clave", clave).maybeSingle();
      if (existente) continue;
      const { error } = await admin.from("crm_avisos").insert({
        user_id: userId,
        clave,
        titulo: resumen.titulo,
        cuerpo: resumen.cuerpo,
        url: resumen.url,
      });
      if (error) continue;
      avisos += 1;
      for (const sub of subs ?? []) {
        const resultado = await enviarPush(sub, resumen);
        if (resultado === "caducada") {
          await admin.from("crm_push_subs").delete().eq("endpoint", sub.endpoint);
        }
        if (resultado === "ok") enviados += 1;
      }
    }
  }

  return { ok: true as const, dia, avisos, enviados, destinatarios: porUsuario.size };
}
