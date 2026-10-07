import webpush from "web-push";
import { vapidPublica } from "./config";
import { secretoAviso } from "./secretos";

export type PushSub = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

let vapidListo = false;

async function asegurarVapid(): Promise<boolean> {
  const publica = vapidPublica();
  const privada = (await secretoAviso("vapid_private")) || process.env.VAPID_PRIVATE_KEY?.trim() || "";
  const subject =
    (await secretoAviso("vapid_subject")) || process.env.VAPID_SUBJECT?.trim() || "mailto:avisos@rehabinco.es";
  if (!publica || !privada) return false;
  if (!vapidListo) {
    webpush.setVapidDetails(subject, publica, privada);
    vapidListo = true;
  }
  return true;
}

export async function enviarPush(
  sub: PushSub,
  payload: { titulo: string; cuerpo: string; url: string }
): Promise<"ok" | "caducada" | "error"> {
  if (!(await asegurarVapid())) return "error";
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify({
        title: payload.titulo,
        body: payload.cuerpo,
        url: payload.url,
      })
    );
    return "ok";
  } catch (error) {
    const status = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
    if (status === 404 || status === 410) return "caducada";
    return "error";
  }
}
