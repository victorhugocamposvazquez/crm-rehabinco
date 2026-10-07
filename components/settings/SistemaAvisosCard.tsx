"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SISTEMA_AVISOS_ACTUAL, type CheckAvisos } from "@/lib/alertas/estado-sistema";
import { cn } from "@/lib/utils";

const DOT: Record<CheckAvisos["nivel"], string> = {
  ok: "bg-neutral-1000",
  aviso: "bg-amber-500",
  error: "bg-red-500",
};

const TITULO: Record<CheckAvisos["nivel"], string> = {
  ok: "En marcha",
  aviso: "Atención",
  error: "Hay un bloqueo",
};

export function SistemaAvisosCard() {
  const [nivel, setNivel] = useState<CheckAvisos["nivel"]>("ok");
  const [checks, setChecks] = useState<CheckAvisos[]>([]);
  const [digestsHoy, setDigestsHoy] = useState(0);
  const [dispositivos, setDispositivos] = useState(0);
  const [dia, setDia] = useState("");
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    const res = await fetch("/api/alertas/estado");
    const json = (await res.json()) as {
      ok?: boolean;
      error?: string;
      nivel?: CheckAvisos["nivel"];
      checks?: CheckAvisos[];
      digestsHoy?: number;
      dispositivos?: number;
      dia?: string;
    };
    setCargando(false);
    if (!res.ok || !json.ok) {
      toast.error(json.error || "No se pudo leer el sistema de avisos.");
      return;
    }
    setNivel(json.nivel ?? "ok");
    setChecks(json.checks ?? []);
    setDigestsHoy(json.digestsHoy ?? 0);
    setDispositivos(json.dispositivos ?? 0);
    setDia(json.dia ?? "");
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <Card id="sistema-avisos" className="md:col-span-2 scroll-mt-24">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 shrink-0" strokeWidth={1.5} aria-hidden />
              Sistema de avisos push
            </CardTitle>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--text-2)]">
              Solo visible para el superadministrador. Describe <span className="font-medium text-foreground">cómo está montado ahora</span>, no un catálogo de opciones futuras.
            </p>
          </div>
          <Button type="button" variant="secondary" size="sm" disabled={cargando} onClick={() => void cargar()} className="shrink-0 gap-1.5">
            <RefreshCw className={cn("h-3.5 w-3.5", cargando && "animate-spin")} strokeWidth={1.75} aria-hidden />
            Actualizar
          </Button>
        </div>
        <div
          className={cn(
            "rounded-[12px] border px-3.5 py-3",
            nivel === "ok" && "border-border bg-[var(--surface-soft)]",
            nivel === "aviso" && "border-amber-500/40 bg-amber-500/10",
            nivel === "error" && "border-red-500/40 bg-red-500/10"
          )}
        >
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--text-3)]">En uso ahora</p>
          <p className="mt-1 text-[15px] font-semibold tracking-tight">{SISTEMA_AVISOS_ACTUAL.nombre}</p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--text-2)]">{SISTEMA_AVISOS_ACTUAL.resumen}</p>
          <p className="mt-2 text-[12.5px] font-medium">
            Estado: {TITULO[nivel]}
            {dia ? ` · día UTC ${dia}` : ""}
            {` · ${digestsHoy} digest(s) hoy · ${dispositivos} dispositivo(s)`}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <ol className="grid gap-3 sm:grid-cols-2">
          {SISTEMA_AVISOS_ACTUAL.piezas.map((pieza, i) => (
            <li key={pieza.titulo} className="rounded-[12px] border border-border bg-[var(--surface-soft)] px-3.5 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-3)]">
                {String(i + 1).padStart(2, "0")} · {pieza.titulo}
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-2)]">{pieza.texto}</p>
            </li>
          ))}
        </ol>

        <div>
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.07em] text-[var(--text-3)]">Comprobaciones</p>
          {cargando && checks.length === 0 ? (
            <p className="text-sm text-[var(--text-2)]">Leyendo entorno y tablas…</p>
          ) : (
            <ul className="divide-y divide-[var(--border-row)] rounded-[12px] border border-border">
              {checks.map((check) => (
                <li key={check.id} className="flex items-start gap-3 px-3.5 py-2.5">
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", DOT[check.nivel])} aria-hidden />
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-medium">{check.label}</p>
                    <p className="text-[12.5px] leading-relaxed text-[var(--text-2)]">{check.detalle}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-[12.5px] leading-relaxed text-[var(--text-3)]">
          Cada comercial activa el push en su propio perfil (Ajustes → Avisos). Captación tiene su propio canal de notificaciones en Captación → Notificaciones; no entra en este digest.
        </p>
      </CardContent>
    </Card>
  );
}
