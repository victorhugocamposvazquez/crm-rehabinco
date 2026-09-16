"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BUILD_ID } from "@/lib/build-id";

/** Comprobación periódica mientras la pestaña sigue abierta. */
const INTERVALO_MS = 60 * 1000;

async function buildIdRemoto(): Promise<string | null> {
  try {
    const res = await fetch(`/api/version?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { buildId?: string };
    return data.buildId ?? null;
  } catch {
    return null;
  }
}

async function limpiarCaches(): Promise<void> {
  if (!("caches" in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.map((k) => caches.delete(k)));
}

async function forzarServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration("/");
  if (!reg) return;
  if (reg.waiting) {
    reg.waiting.postMessage({ type: "SKIP_WAITING" });
  }
  await reg.update().catch(() => undefined);
}

export function AvisoNuevaVersion() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [actualizando, setActualizando] = useState(false);
  const avisadoRef = useRef(false);
  const buildLocalRef = useRef(BUILD_ID);

  const marcarNuevaVersion = useCallback(() => {
    if (avisadoRef.current) return;
    avisadoRef.current = true;
    setOpen(true);
  }, []);

  const comprobarVersion = useCallback(async () => {
    const remoto = await buildIdRemoto();
    if (remoto && remoto !== buildLocalRef.current) {
      marcarNuevaVersion();
      return;
    }

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      const reg = await navigator.serviceWorker.getRegistration("/");
      await reg?.update().catch(() => undefined);
    }
  }, [marcarNuevaVersion]);

  const enlazarServiceWorker = useCallback(
    (reg: ServiceWorkerRegistration) => {
      const avisarSiEsperando = () => {
        if (reg.waiting && navigator.serviceWorker.controller) {
          marcarNuevaVersion();
        }
      };

      avisarSiEsperando();

      reg.addEventListener("updatefound", () => {
        const nuevo = reg.installing;
        if (!nuevo) return;
        nuevo.addEventListener("statechange", () => {
          if (nuevo.state === "installed") avisarSiEsperando();
        });
      });
    },
    [marcarNuevaVersion]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    void comprobarVersion();

    const onVisible = () => {
      if (document.visibilityState === "visible") void comprobarVersion();
    };
    const onPageShow = () => void comprobarVersion();
    const onOnline = () => void comprobarVersion();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("online", onOnline);

    const intervalo = window.setInterval(() => void comprobarVersion(), INTERVALO_MS);

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((reg) => {
          enlazarServiceWorker(reg);
          return reg.update();
        })
        .catch(() => undefined);

      const onControllerChange = () => {
        if (avisadoRef.current) {
          window.location.reload();
        }
      };
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

      return () => {
        document.removeEventListener("visibilitychange", onVisible);
        window.removeEventListener("focus", onVisible);
        window.removeEventListener("pageshow", onPageShow);
        window.removeEventListener("online", onOnline);
        window.clearInterval(intervalo);
        navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      };
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("online", onOnline);
      window.clearInterval(intervalo);
    };
  }, [comprobarVersion, enlazarServiceWorker]);

  useEffect(() => {
    void comprobarVersion();
  }, [pathname, comprobarVersion]);

  const actualizarFuerte = async () => {
    setActualizando(true);
    try {
      await limpiarCaches();
      await forzarServiceWorker();
      const url = new URL(window.location.href);
      url.searchParams.set("_v", String(Date.now()));
      window.location.replace(url.toString());
    } catch {
      window.location.reload();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="nueva-version-titulo"
        aria-describedby="nueva-version-desc"
        className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-2xl"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
          <RefreshCw className="h-6 w-6" strokeWidth={1.75} />
        </div>
        <h2 id="nueva-version-titulo" className="mt-4 text-center text-lg font-semibold tracking-tight">
          Nueva versión del CRM
        </h2>
        <p id="nueva-version-desc" className="mt-2 text-center text-[13.5px] leading-relaxed text-[var(--text-2)]">
          Hay una actualización publicada. Pulsa el botón para cargar la versión nueva y no seguir con la anterior en
          caché.
        </p>
        <Button
          type="button"
          className="mt-6 h-11 w-full gap-2 text-[15px] font-semibold"
          disabled={actualizando}
          onClick={() => void actualizarFuerte()}
        >
          <RefreshCw className={`h-4 w-4 ${actualizando ? "animate-spin" : ""}`} strokeWidth={1.75} />
          {actualizando ? "Actualizando…" : "Actualizar ahora"}
        </Button>
      </div>
    </div>
  );
}
