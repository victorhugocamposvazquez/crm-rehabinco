import { createAdminClient } from "@/lib/supabase/admin";
import { fechaMadrid } from "./madrid";
import { vapidPublica } from "./config";
import { secretoAviso } from "./secretos";
import { SISTEMA_AVISOS_ACTUAL, type CheckAvisos } from "./texto-sistema";

export type { CheckAvisos };
export { SISTEMA_AVISOS_ACTUAL };

export async function estadoSistemaAvisos(): Promise<{
  nivel: CheckAvisos["nivel"];
  checks: CheckAvisos[];
  digestsHoy: number;
  dispositivos: number;
  dia: string;
}> {
  const dia = new Date().toISOString().slice(0, 10);
  const checks: CheckAvisos[] = [];

  const [cronDb, vapidDb] = await Promise.all([secretoAviso("cron_secret"), secretoAviso("vapid_private")]);

  if (!process.env.CRON_SECRET?.trim() && !cronDb) {
    checks.push({
      id: "cron_secret",
      label: "CRON_SECRET",
      nivel: "error",
      detalle: "Sin este secreto el cron de avisos responde 401.",
    });
  } else {
    checks.push({
      id: "cron_secret",
      label: "CRON_SECRET",
      nivel: "ok",
      detalle: cronDb
        ? "El cron de cada 15 minutos autentica con el secreto de Supabase."
        : "Configurado en el servidor. El cron autentica con Bearer.",
    });
  }

  const publica = vapidPublica();
  const privada = vapidDb || process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publica || !privada) {
    checks.push({
      id: "vapid",
      label: "Claves VAPID",
      nivel: "aviso",
      detalle:
        "Falta la clave privada VAPID. Los avisos en la bombilla del CRM siguen; el push en segundo plano no.",
    });
  } else {
    checks.push({
      id: "vapid",
      label: "Claves VAPID",
      nivel: "ok",
      detalle: vapidDb
        ? "La clave privada está en la base y este servidor puede enviar el push."
        : "Listas para Web Push en móvil y escritorio.",
    });
  }

  checks.push({
    id: "cron_horario",
    label: "Horario del cron",
    nivel: "ok",
    detalle: `Cada 15 min: Supabase llama a ${SISTEMA_AVISOS_ACTUAL.rutaCron}?solo=ventana. Avisa una hora antes, y manda el resumen del día a la hora que eligió cada persona (por defecto las 10:00).`,
  });

  const admin = createAdminClient();
  const fecha = fechaMadrid();
  const [{ count: digestsHoy }, { count: dispositivos }] = await Promise.all([
    admin
      .from("crm_avisos")
      .select("id", { count: "exact", head: true })
      .like("clave", `dia:%:${fecha}`),
    admin.from("crm_push_subs").select("endpoint", { count: "exact", head: true }),
  ]);

  const nDigests = digestsHoy ?? 0;
  const nSubs = dispositivos ?? 0;

  if (nDigests === 0) {
    checks.push({
      id: "digests_hoy",
      label: "Recordatorio del día",
      nivel: "aviso",
      detalle: `Aún no hay «Tus tareas del día» del ${fecha}. Normal si todavía no ha llegado la hora de nadie, o si el día estaba vacío.`,
    });
  } else {
    checks.push({
      id: "digests_hoy",
      label: "Recordatorio del día",
      nivel: "ok",
      detalle: `${nDigests} aviso(s) «Tus tareas del día» del ${fecha}.`,
    });
  }

  if (nSubs === 0) {
    checks.push({
      id: "dispositivos",
      label: "Dispositivos push",
      nivel: "aviso",
      detalle: "Nadie tiene el push activado en un dispositivo. Cada usuario lo enciende en Ajustes → Avisos.",
    });
  } else {
    checks.push({
      id: "dispositivos",
      label: "Dispositivos push",
      nivel: "ok",
      detalle: `${nSubs} suscripción(es) activa(s) en crm_push_subs.`,
    });
  }

  const nivel: CheckAvisos["nivel"] = checks.some((c) => c.nivel === "error")
    ? "error"
    : checks.some((c) => c.nivel === "aviso")
      ? "aviso"
      : "ok";

  return { nivel, checks, digestsHoy: nDigests, dispositivos: nSubs, dia };
}
