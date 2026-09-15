"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function urlBase64ToUint8Array(base64: string): BufferSource {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength);
}

async function registroSw(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
}

export async function activarAvisosPwa(): Promise<string> {
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Este navegador no admite avisos de la PWA.");
  }
  const permiso = await Notification.requestPermission();
  if (permiso !== "granted") throw new Error("Hay que permitir notificaciones en el navegador.");
  const vapid = await fetch("/api/alertas/push").then((r) => r.json() as Promise<{ key: string | null }>);
  const reg = await registroSw();
  if (!reg) throw new Error("No se ha podido registrar la PWA.");
  if (vapid.key) {
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid.key),
    });
    const ok = await fetch("/api/alertas/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
    if (!ok.ok) throw new Error("No se ha podido guardar la suscripción.");
  }
  return vapid.key
    ? "Avisos activados. El cron de Vercel te avisará por la mañana y la PWA los muestra aunque el CRM esté cerrado."
    : "Permiso concedido. Verás avisos con el CRM abierto. Falta la clave VAPID en Vercel para el push en segundo plano.";
}

export function AvisosPwaCard() {
  const [estado, setEstado] = useState<"off" | "on">("off");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "granted") setEstado("on");
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Avisos en el móvil (PWA)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-neutral-500">
          Tareas, recordatorios y citas del día. Instala el CRM como app y activa avisos. Vercel los dispara cada
          mañana; si dejas la app abierta también saltan a su hora.
        </p>
        <p className="text-sm font-medium">
          {estado === "on" ? "Avisos permitidos en este dispositivo." : "Este dispositivo aún no recibe avisos."}
        </p>
        <Button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void activarAvisosPwa()
              .then((msg) => {
                setEstado("on");
                toast.success(msg);
              })
              .catch((error: unknown) => {
                toast.error(error instanceof Error ? error.message : "No se han podido activar los avisos.");
              })
              .finally(() => setBusy(false));
          }}
        >
          {busy ? "Activando…" : "Activar avisos"}
        </Button>
      </CardContent>
    </Card>
  );
}

export function AlertasPwaHost() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    const supabase = createClient();
    const hoy = new Date().toISOString().slice(0, 10);
    const timers: number[] = [];

    void Promise.all([
      supabase
        .from("citas")
        .select("id, titulo, empieza, tipo, estado")
        .eq("comercial_id", user.id)
        .eq("estado", "prevista")
        .gte("empieza", `${hoy}T00:00:00`)
        .lte("empieza", `${hoy}T23:59:59`),
      supabase.from("crm_avisos").select("id, titulo, cuerpo, url, leida").eq("user_id", user.id).eq("leida", false).limit(5),
    ]).then(([citas, avisos]) => {
      for (const aviso of avisos.data ?? []) {
        toast(aviso.titulo, { description: aviso.cuerpo ?? undefined });
        void supabase.from("crm_avisos").update({ leida: true }).eq("id", aviso.id);
      }
      const vistos = new Set<string>();
      for (const cita of citas.data ?? []) {
        const cuando = new Date(cita.empieza).getTime() - Date.now();
        if (cuando <= 0 || cuando > 12 * 60 * 60 * 1000) continue;
        timers.push(
          window.setTimeout(() => {
            if (vistos.has(cita.id)) return;
            vistos.add(cita.id);
            void new Notification(cita.titulo, {
              body: cita.tipo === "recordatorio" ? "Recordatorio del CRM" : "Toca en el calendario",
              icon: "/icon-192.png",
            });
          }, cuando)
        );
      }
    });

    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [user]);

  return null;
}
