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
  nombre: "Avisos al momento + recordatorio de la hora",
  resumen:
    "Lo útil sale en el acto (te mencionan o te asignan algo). Lo que está a punto de empezar se revisa cada 15 minutos. Por la mañana sigue habiendo un resumen del día. El plan Hobby de Vercel no permite un cron cada pocos minutos: esa pasada frecuente la hace Supabase.",
  piezas: [
    {
      titulo: "Al momento",
      texto:
        "Al guardar un comentario con @, o al asignar una cita o una tarea a otra persona, el CRM crea el aviso y lanza el push en ese instante. No espera al cron.",
    },
    {
      titulo: "Cada 15 minutos",
      texto:
        "Supabase (pg_cron) llama a /api/cron/alertas?solo=ventana. Avisa al comercial de las citas previstas que empiezan en la próxima hora («Empieza en 40 min»). Si se mueve la hora, vuelve a avisar. Una vez por cita y hora de inicio.",
    },
    {
      titulo: "Resumen de la mañana",
      texto:
        "Cron de Vercel, 0 7 * * * (07:00 UTC ≈ 09:00 en verano). Una pasada al día con el resto: tareas de hoy y vencidas, partes sin firmar y lo que queda en la agenda. No sustituye a los avisos de arriba.",
    },
    {
      titulo: "A quién llega",
      texto:
        "Al comercial asignado, y las menciones a quien nombras con @. Cada persona elige los canales en Ajustes → Avisos. Si te asignas algo a ti mismo no hay push de «te han asignado»; sí el de «empieza en X min».",
    },
    {
      titulo: "Dónde se ve",
      texto:
        "Bombilla del CRM (crm_avisos) y, si el usuario activó el push en ese móvil o navegador, notificación del sistema (Web Push / VAPID).",
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
    detalle: `Mañana: ${SISTEMA_AVISOS_ACTUAL.horarioCron} (resumen). Cada 15 min: Supabase llama a ${SISTEMA_AVISOS_ACTUAL.rutaCron}?solo=ventana.`,
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
