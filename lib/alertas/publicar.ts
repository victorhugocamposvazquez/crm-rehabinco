import { createAdminClient } from "@/lib/supabase/admin";
import { prefsCompletas, SELECT_PREFS_AVISO, type CanalAviso } from "./prefs";
import { enviarPush } from "./web-push";

export async function publicarAviso(input: {
  userId: string;
  clave: string;
  titulo: string;
  cuerpo: string;
  url: string;
  canal: CanalAviso;
}): Promise<"nuevo" | "repetido" | "apagado"> {
  const admin = createAdminClient();
  const { data: prefsRow } = await admin
    .from("crm_aviso_prefs")
    .select(SELECT_PREFS_AVISO)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (prefsCompletas(prefsRow)[input.canal] === false) return "apagado";

  const { error } = await admin.from("crm_avisos").insert({
    user_id: input.userId,
    clave: input.clave,
    titulo: input.titulo,
    cuerpo: input.cuerpo,
    url: input.url,
  });
  if (error) {
    if (error.code === "23505") return "repetido";
    throw new Error(error.message);
  }

  const { data: subs } = await admin
    .from("crm_push_subs")
    .select("endpoint, p256dh, auth")
    .eq("user_id", input.userId);
  for (const sub of subs ?? []) {
    const resultado = await enviarPush(sub, {
      titulo: input.titulo,
      cuerpo: input.cuerpo,
      url: input.url,
    });
    if (resultado === "caducada") {
      await admin.from("crm_push_subs").delete().eq("endpoint", sub.endpoint);
    }
  }
  return "nuevo";
}
