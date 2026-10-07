import { createAdminClient } from "@/lib/supabase/admin";
import { prefsCompletas, SELECT_PREFS_AVISO, type CanalAviso } from "./prefs";
import { tituloAjeno } from "./seguir";
import { enviarPush } from "./web-push";

type Aviso = {
  userId: string;
  clave: string;
  titulo: string;
  cuerpo: string;
  url: string;
  canal: CanalAviso;
};

async function nombreDe(userId: string): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("nombre_completo, email").eq("id", userId).maybeSingle();
  const nombre = data?.nombre_completo?.trim();
  if (nombre) return nombre.split(/\s+/)[0] ?? nombre;
  const email = data?.email?.trim();
  if (email) return email.split("@")[0] ?? "Otra persona";
  return "Otra persona";
}

async function publicarUno(input: Aviso): Promise<"nuevo" | "repetido" | "apagado"> {
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

export async function publicarAviso(input: Aviso): Promise<"nuevo" | "repetido" | "apagado"> {
  const propio = await publicarUno(input);
  try {
    const admin = createAdminClient();
    const { data: seguidores } = await admin
      .from("crm_aviso_seguir")
      .select("user_id")
      .eq("seguido_id", input.userId);
    const ids = [...new Set((seguidores ?? []).map((fila) => fila.user_id).filter((id) => id && id !== input.userId))];
    if (ids.length === 0) return propio;
    const nombre = await nombreDe(input.userId);
    for (const userId of ids) {
      await publicarUno({
        ...input,
        userId,
        clave: `${input.clave}:para:${userId}`,
        titulo: tituloAjeno(nombre, input.titulo),
      });
    }
  } catch {
    // El aviso del dueño ya está enviado. Seguir a alguien no puede tumbarlo.
  }
  return propio;
}
