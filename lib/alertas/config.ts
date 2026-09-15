import { VAPID_PUBLICA_CRM } from "./vapid-public";

export function cronAutorizado(request: Request): boolean {
  const esperado = process.env.CRON_SECRET?.trim();
  if (!esperado) return false;
  return request.headers.get("authorization") === `Bearer ${esperado}`;
}

export function vapidPublica(): string | null {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || process.env.VAPID_PUBLIC_KEY?.trim() || VAPID_PUBLICA_CRM;
  return key || null;
}
