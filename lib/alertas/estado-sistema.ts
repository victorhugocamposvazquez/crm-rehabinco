import { createAdminClient } from "@/lib/supabase/admin";
import { fechaMadrid } from "./manana";
import { vapidPublica } from "./config";

export type CheckAvisos = {
  id: string;
  label: string;
  nivel: "ok" | "aviso" | "error";
  detalle: string;
};

/** Cómo está montado el sistema hoy (para el panel de superadmin). */
export const SISTEMA_AVISOS_ACTUAL = {
  nombre: "Avisos al momento, una hora antes y resumen a las 10:00",
  resumen:
    "Lo útil sale en el acto (te mencionan o te asignan algo). Cada cita avisa una vez, sobre una hora antes. A las 10:00 (hora de Madrid) llega un solo push: «Tus tareas del día», con enlace al calendario. La pasada frecuente la hace Supabase cada 15 minutos.",
  piezas: [
    {
      titulo: "Al momento",
      texto:
        "Al guardar un comentario con @, o al asignar una cita o una tarea a otra persona, el CRM crea el aviso y lanza el push en ese instante.",
    },
    {
      titulo: "Una hora antes",
      texto:
        "Cada 15 minutos Supabase mira las citas previstas. La primera vez que falta una hora y cuarto o menos, avisa («Empieza en 60 min») y no se repite. Llega entre 60 y 75 minutos antes: una hora antes queda cubierta de sobra.",
    },
    {
      titulo: "A las 10:00",
      texto:
        "Un push al día, a las 10:00 hora de Madrid, solo si esa persona tiene citas o tareas para hoy. Título: «Tus tareas del día». Abre el calendario. No sale si el día está vacío.",
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
  horarioCron: "10:00 Europe/Madrid",
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
    detalle: `Cada 15 min: Supabase llama a ${SISTEMA_AVISOS_ACTUAL.rutaCron}?solo=ventana (una hora antes, y a las ${SISTEMA_AVISOS_ACTUAL.horarioCron} el resumen del día).`,
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
      label: "Resumen de las 10:00",
      nivel: "aviso",
      detalle: `Aún no hay «Tus tareas del día» del ${fecha}. Normal antes de las 10:00, o si nadie tenía citas ni tareas hoy.`,
    });
  } else {
    checks.push({
      id: "digests_hoy",
      label: "Resumen de las 10:00",
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
