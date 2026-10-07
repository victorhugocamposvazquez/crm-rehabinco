import { createAdminClient } from "@/lib/supabase/admin";
import { vapidPublica } from "./config";

export type CheckAvisos = {
  id: string;
  label: string;
  nivel: "ok" | "aviso" | "error";
  detalle: string;
};

/** Cómo está montado el sistema hoy (para el panel de superadmin). */
export const SISTEMA_AVISOS_ACTUAL = {
  nombre: "Digest diario + Web Push",
  resumen:
    "Cada mañana un cron de Vercel revisa citas, tareas, menciones y partes del día, crea avisos en el CRM y, si el dispositivo está suscrito, lanza un push al móvil o al escritorio.",
  piezas: [
    {
      titulo: "Disparador",
      texto:
        "Cron de Vercel en /api/cron/alertas, horario 0 7 * * * (07:00 UTC ≈ 09:00 en verano / 08:00 en invierno en España). En la cuenta Hobby de Vercel no se puede pedir un cron cada pocos minutos: por eso el resumen es una vez al día.",
    },
    {
      titulo: "Qué mira",
      texto:
        "Citas previstas de hoy, tareas pendientes con vencimiento hoy o atrasado, partes sin firmar y menciones @ del día en comentarios de tareas.",
    },
    {
      titulo: "A quién llega",
      texto:
        "Solo al comercial asignado (comercial_id). Cada persona elige en Ajustes → Avisos qué canales quiere (visitas, recordatorios, agenda, tareas, menciones, partes). No hay aún seguimiento de las tareas de otro del equipo.",
    },
    {
      titulo: "Dónde se ve",
      texto:
        "Aviso en la bombilla del CRM (tabla crm_avisos) y, si el usuario activó push en el dispositivo, notificación del sistema vía Web Push (VAPID).",
    },
    {
      titulo: "Límite del día",
      texto:
        "Un digest por usuario, canal y día (clave digest:user:fecha:canal). Si ya se envió, no se repite hasta el día siguiente.",
    },
  ],
  secretoCron: "CRON_SECRET",
  rutaCron: "/api/cron/alertas",
  horarioCron: "0 7 * * *",
} as const;

export async function estadoSistemaAvisos(): Promise<{
  nivel: CheckAvisos["nivel"];
  checks: CheckAvisos[];
  digestsHoy: number;
  dispositivos: number;
  dia: string;
}> {
  const dia = new Date().toISOString().slice(0, 10);
  const checks: CheckAvisos[] = [];

  if (!process.env.CRON_SECRET?.trim()) {
    checks.push({
      id: "cron_secret",
      label: "CRON_SECRET",
      nivel: "error",
      detalle: "Sin este secreto Vercel no puede llamar al cron de avisos (401).",
    });
  } else {
    checks.push({
      id: "cron_secret",
      label: "CRON_SECRET",
      nivel: "ok",
      detalle: "Configurado. El cron de Vercel autentica con Bearer.",
    });
  }

  const publica = vapidPublica();
  const privada = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publica || !privada) {
    checks.push({
      id: "vapid",
      label: "Claves VAPID",
      nivel: "aviso",
      detalle:
        "Falta VAPID_PRIVATE_KEY (o la pública). Los avisos en la bombilla del CRM siguen; el push en segundo plano no.",
    });
  } else {
    checks.push({
      id: "vapid",
      label: "Claves VAPID",
      nivel: "ok",
      detalle: "Listas para Web Push en móvil y escritorio.",
    });
  }

  checks.push({
    id: "cron_horario",
    label: "Horario del cron",
    nivel: "ok",
    detalle: `${SISTEMA_AVISOS_ACTUAL.horarioCron} → ${SISTEMA_AVISOS_ACTUAL.rutaCron} (una pasada diaria; plan Hobby).`,
  });

  const admin = createAdminClient();
  const [{ count: digestsHoy }, { count: dispositivos }] = await Promise.all([
    admin
      .from("crm_avisos")
      .select("id", { count: "exact", head: true })
      .like("clave", `digest:%:${dia}%`),
    admin.from("crm_push_subs").select("endpoint", { count: "exact", head: true }),
  ]);

  const nDigests = digestsHoy ?? 0;
  const nSubs = dispositivos ?? 0;

  if (nDigests === 0) {
    checks.push({
      id: "digests_hoy",
      label: "Digests de hoy",
      nivel: "aviso",
      detalle:
        "Aún no hay avisos digest de hoy. Normal si el cron no ha corrido (antes de las ~9:00) o si no había nada que avisar.",
    });
  } else {
    checks.push({
      id: "digests_hoy",
      label: "Digests de hoy",
      nivel: "ok",
      detalle: `${nDigests} aviso(s) digest creados hoy (UTC ${dia}).`,
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
