import { createAdminClient } from "@/lib/supabase/admin";
import { claveDigest, resumenAvisosDia, type ItemAviso } from "@/lib/alertas/digest";
import { enviarPush } from "@/lib/alertas/web-push";

function horaLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(11, 16);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export async function dispararDigestAlertas(dia = new Date().toISOString().slice(0, 10)) {
  const admin = createAdminClient();
  const inicio = `${dia}T00:00:00`;
  const fin = `${dia}T23:59:59`;

  const [{ data: citas }, { data: tareas }] = await Promise.all([
    admin
      .from("citas")
      .select("id, comercial_id, titulo, empieza, tipo, estado")
      .gte("empieza", inicio)
      .lte("empieza", fin)
      .eq("estado", "prevista"),
    admin
      .from("tareas")
      .select("id, comercial_id, titulo, vence, hora, estado")
      .eq("vence", dia)
      .eq("estado", "pendiente"),
  ]);

  const porUsuario = new Map<string, ItemAviso[]>();
  for (const cita of citas ?? []) {
    const lista = porUsuario.get(cita.comercial_id) ?? [];
    lista.push({ titulo: cita.titulo, hora: horaLocal(cita.empieza), tipo: cita.tipo });
    porUsuario.set(cita.comercial_id, lista);
  }
  for (const tarea of tareas ?? []) {
    const lista = porUsuario.get(tarea.comercial_id) ?? [];
    lista.push({ titulo: tarea.titulo, hora: tarea.hora?.slice(0, 5) ?? null, tipo: "tarea" });
    porUsuario.set(tarea.comercial_id, lista);
  }

  let enviados = 0;
  let avisos = 0;
  for (const [userId, items] of porUsuario) {
    const resumen = resumenAvisosDia(items);
    if (!resumen) continue;
    const clave = claveDigest(userId, dia);
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
    const { data: subs } = await admin
      .from("crm_push_subs")
      .select("endpoint, p256dh, auth")
      .eq("user_id", userId);
    for (const sub of subs ?? []) {
      const resultado = await enviarPush(sub, resumen);
      if (resultado === "caducada") {
        await admin.from("crm_push_subs").delete().eq("endpoint", sub.endpoint);
      }
      if (resultado === "ok") enviados += 1;
    }
  }

  return { ok: true as const, dia, avisos, enviados, destinatarios: porUsuario.size };
}
