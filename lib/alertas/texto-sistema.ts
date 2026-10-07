export type CheckAvisos = {
  id: string;
  label: string;
  nivel: "ok" | "aviso" | "error";
  detalle: string;
};

/** Cómo está montado el sistema hoy (para el panel de superadmin). Sin imports de servidor. */
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
