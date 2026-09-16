"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BUILD_ID } from "@/lib/build-id";

/** Comprobación periódica mientras la pestaña sigue abierta. */
const INTERVALO_MS = 3 * 60 * 1000;

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

function limpiarParamActualizacion(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("_v")) return;
  url.searchParams.delete("_v");
  const qs = url.searchParams.toString();
  window.history.replaceState(null, "", `${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`);
}

export function AvisoNuevaVersion() {
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
    const params = new URLSearchParams(window.location.search);
    if (params.has("_v")) {
      const remoto = await buildIdRemoto();
      if (remoto) buildLocalRef.current = remoto;
      limpiarParamActualizacion();
      return;
    }

    const remoto = await buildIdRemoto();
    if (remoto && remoto !== buildLocalRef.current) {
      marcarNuevaVersion();
    }
  }, [marcarNuevaVersion]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    void comprobarVersion();

    const onVisible = () => {
      if (document.visibilityState === "visible") void comprobarVersion();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    const intervalo = window.setInterval(() => void comprobarVersion(), INTERVALO_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.clearInterval(intervalo);
    };
  }, [comprobarVersion]);

  const actualizarFuerte = async () => {
    setActualizando(true);
    try {
      await limpiarCaches();

      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration("/");
        if (reg?.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
          await new Promise<void>((resolve) => {
            const timeout = window.setTimeout(resolve, 2500);
            navigator.serviceWorker.addEventListener(
              "controllerchange",
              () => {
                window.clearTimeout(timeout);
                resolve();
              },
              { once: true }
            );
          });
        } else {
          await reg?.update().catch(() => undefined);
        }
      }

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
