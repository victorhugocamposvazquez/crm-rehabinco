"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  canalDeTipo,
  CANALES_AVISO,
  itemPermitido,
  prefsCompletas,
  SELECT_PREFS_AVISO,
  type CanalAviso,
  type PrefsAviso,
} from "@/lib/alertas/prefs";

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

export async function estadoAvisosDispositivo(): Promise<"off" | "on"> {
  if (typeof window === "undefined" || !("Notification" in window)) return "off";
  if (Notification.permission !== "granted") return "off";
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "on";
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    if (!reg) return "off";
    const sub = await reg.pushManager.getSubscription();
    return sub ? "on" : "off";
  } catch {
    return "off";
  }
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
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid.key),
      });
    }
    const ok = await fetch("/api/alertas/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
    if (!ok.ok) throw new Error("No se ha podido guardar la suscripción.");
  }
  return vapid.key
    ? "Avisos activados en este dispositivo. Elige abajo qué tipos quieres recibir."
    : "Permiso concedido. Verás avisos con el CRM abierto. Falta la clave VAPID en Vercel para el push en segundo plano.";
}

export async function desactivarAvisosPwa(): Promise<void> {
  if ("serviceWorker" in navigator && "PushManager" in window) {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/alertas/push", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    } else {
      await fetch("/api/alertas/push", { method: "DELETE" });
    }
  }
}

function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
      style={{ background: on ? "#0B7461" : "#CFCBC2" }}
    >
      <span
        className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] duration-150"
        style={{ left: on ? 22 : 2 }}
      />
    </button>
  );
}

export function AvisosPwaCard() {
  const { user } = useAuth();
  const [estado, setEstado] = useState<"off" | "on">("off");
  const [busy, setBusy] = useState(false);
  const [prefs, setPrefs] = useState<PrefsAviso>(prefsCompletas(null));
  const [guardando, setGuardando] = useState<CanalAviso | null>(null);

  const refrescarEstado = useCallback(() => {
    void estadoAvisosDispositivo().then(setEstado);
  }, []);

  useEffect(() => {
    refrescarEstado();
    if (!user?.id) return;
    const supabase = createClient();
    void supabase
      .from("crm_aviso_prefs")
      .select(SELECT_PREFS_AVISO)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.warn("crm_aviso_prefs", error.message);
          return;
        }
        setPrefs(prefsCompletas(data));
      });
  }, [user?.id, refrescarEstado]);

  const toggle = async (canal: CanalAviso) => {
    if (!user?.id) return;
    const prev = prefs;
    const next = { ...prefs, [canal]: !prefs[canal] };
    setPrefs(next);
    setGuardando(canal);
    const supabase = createClient();
    const { error } = await supabase.from("crm_aviso_prefs").upsert(
      {
        user_id: user.id,
        ...next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    setGuardando(null);
    if (error) {
      setPrefs(prev);
      toast.error("No se ha podido guardar esa preferencia.");
      return;
    }
    toast.success(next[canal] ? `${CANALES_AVISO.find((c) => c.id === canal)?.label ?? "Aviso"} activado.` : `${CANALES_AVISO.find((c) => c.id === canal)?.label ?? "Aviso"} desactivado.`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Avisos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-neutral-500">
          Elige qué te llega al móvil o al navegador. Los de portales se configuran en{" "}
          <Link href="/captacion" className="font-medium text-accent hover:underline">
            Captación → Notificaciones
          </Link>
          .
        </p>
        <div className="divide-y divide-[var(--border-row)] rounded-[10px] border border-border">
          {CANALES_AVISO.map((canal) => (
            <div key={canal.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="text-[13.5px] font-medium">{canal.label}</p>
                <p className="text-[12px] text-[var(--text-2)]">{canal.hint}</p>
              </div>
              <Switch
                on={prefs[canal.id]}
                label={canal.label}
                onClick={() => {
                  if (guardando) return;
                  void toggle(canal.id);
                }}
              />
            </div>
          ))}
        </div>
        <div className="rounded-[10px] border border-border bg-[var(--surface-soft)] px-3.5 py-3">
          <p className="text-sm font-medium">
            {estado === "on" ? "Este dispositivo recibe avisos push." : "Este dispositivo aún no recibe avisos push."}
          </p>
          <p className="mt-1 text-[12px] text-[var(--text-2)]">
            {estado === "on"
              ? "Puedes desactivarlos aquí sin perder tus preferencias de arriba."
              : "Actívalos para recibir el resumen de la mañana y avisos aunque el CRM esté cerrado."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {estado === "on" ? (
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void desactivarAvisosPwa()
                    .then(() => {
                      setEstado("off");
                      toast.success("Avisos desactivados en este dispositivo.");
                    })
                    .catch(() => toast.error("No se han podido desactivar los avisos."))
                    .finally(() => setBusy(false));
                }}
              >
                {busy ? "Desactivando…" : "Desactivar avisos"}
              </Button>
            ) : (
              <Button
                type="button"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void activarAvisosPwa()
                    .then((msg) => {
                      setEstado("on");
                      refrescarEstado();
                      toast.success(msg);
                    })
                    .catch((error: unknown) => {
                      toast.error(error instanceof Error ? error.message : "No se han podido activar los avisos.");
                    })
                    .finally(() => setBusy(false));
                }}
              >
                {busy ? "Activando…" : "Activar avisos en este dispositivo"}
              </Button>
            )}
          </div>
        </div>
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
      supabase.from("crm_avisos").select("id, titulo, cuerpo, url, leida").eq("user_id", user.id).eq("leida", false).limit(8),
      supabase.from("crm_aviso_prefs").select(SELECT_PREFS_AVISO).eq("user_id", user.id).maybeSingle(),
    ]).then(([citas, avisos, prefsRow]) => {
      const prefs = prefsCompletas(prefsRow.data);
      for (const aviso of avisos.data ?? []) {
        toast(aviso.titulo, { description: aviso.cuerpo ?? undefined });
        void supabase.from("crm_avisos").update({ leida: true }).eq("id", aviso.id);
      }
      const vistos = new Set<string>();
      for (const cita of citas.data ?? []) {
        if (!itemPermitido(cita.tipo, prefs)) continue;
        const cuando = new Date(cita.empieza).getTime() - Date.now();
        if (cuando <= 0 || cuando > 12 * 60 * 60 * 1000) continue;
        timers.push(
          window.setTimeout(() => {
            if (vistos.has(cita.id)) return;
            vistos.add(cita.id);
            void new Notification(cita.titulo, {
              body: canalDeTipo(cita.tipo) === "visitas" ? "Visita en el calendario" : "Recordatorio del CRM",
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
