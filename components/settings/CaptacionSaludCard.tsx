"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Check = { id: string; label: string; nivel: "ok" | "aviso" | "error"; detalle: string };
type Rafaga = {
  iniciada_en: string;
  terminada_en: string | null;
  paginas: number;
  errores: number;
  ok: boolean | null;
  motivo: string | null;
  duracion_ms: number | null;
};

const DOT: Record<Check["nivel"], string> = {
  ok: "bg-emerald-500",
  aviso: "bg-amber-500",
  error: "bg-red-500",
};

const TITULO: Record<Check["nivel"], string> = {
  ok: "Correcto",
  aviso: "Atención",
  error: "Problema",
};

function cuando(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
}

export function CaptacionSaludCard() {
  const [nivel, setNivel] = useState<Check["nivel"]>("ok");
  const [checks, setChecks] = useState<Check[]>([]);
  const [rafaga, setRafaga] = useState<Rafaga | null>(null);
  const [rafagaEnCurso, setRafagaEnCurso] = useState(false);
  const [pendientes, setPendientes] = useState(0);
  const [recogidaAbierta, setRecogidaAbierta] = useState(false);
  const [accionLinea, setAccionLinea] = useState<string | null>(null);
  const [lanzandoRecogida, setLanzandoRecogida] = useState(false);
  const [procesandoRafaga, setProcesandoRafaga] = useState(false);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    const res = await fetch("/api/captacion/brightdata/estado");
    const json = (await res.json()) as {
      ok?: boolean;
      error?: string;
      nivel?: Check["nivel"];
      checks?: Check[];
      ultimaRafaga?: Rafaga | null;
      rafagaEnCurso?: boolean;
      recogidaAbiertaReciente?: boolean;
      paginasPendientes?: number;
    };
    setCargando(false);
    if (!res.ok || !json.ok) {
      toast.error(json.error || "No se pudo leer el estado de captación.");
      return;
    }
    setNivel(json.nivel ?? "ok");
    setChecks(json.checks ?? []);
    setRafaga(json.ultimaRafaga ?? null);
    setRafagaEnCurso(Boolean(json.rafagaEnCurso));
    setRecogidaAbierta(Boolean(json.recogidaAbiertaReciente));
    setPendientes(json.paginasPendientes ?? 0);
  }, []);

  const lanzarRecogida = async () => {
    setLanzandoRecogida(true);
    setAccionLinea(null);
    const res = await fetch("/api/captacion/brightdata/trigger", { method: "POST" });
    const json = (await res.json()) as { ok?: boolean; error?: string; recogidaId?: string; zonas?: number };
    setLanzandoRecogida(false);
    if (!res.ok || !json.ok) {
      setAccionLinea(json.error ?? "No se pudo abrir la recogida.");
      return;
    }
    setAccionLinea(
      `Recogida abierta · ${json.zonas ?? 0} zonas${json.recogidaId ? ` · ${json.recogidaId.slice(0, 8)}…` : ""}.`
    );
    void cargar();
  };

  const procesarRafaga = async () => {
    setProcesandoRafaga(true);
    setAccionLinea(null);
    const res = await fetch("/api/captacion/brightdata/procesar", { method: "POST" });
    const json = (await res.json()) as {
      ok?: boolean;
      error?: string;
      paginas?: number;
      errores?: number;
      cerradas?: string[];
      omitida?: boolean;
      motivo?: string | null;
    };
    setProcesandoRafaga(false);
    if (!res.ok || !json.ok) {
      setAccionLinea(json.error ?? "No se pudo procesar.");
      void cargar();
      return;
    }
    if (json.omitida) {
      setAccionLinea("Ráfaga omitida: lock ocupado.");
    } else {
      const cerr = json.cerradas?.length ?? 0;
      setAccionLinea(
        `Ráfaga hecha · ${json.paginas ?? 0} pág.${json.errores ? ` · ${json.errores} error(es)` : ""}${cerr ? ` · ${cerr} recogida(s) cerrada(s)` : ""}.`
      );
    }
    void cargar();
  };

  useEffect(() => {
    void cargar();
    const t = setInterval(() => void cargar(), 60_000);
    return () => clearInterval(t);
  }, [cargar]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${DOT[nivel]}`} aria-hidden />
          <CardTitle>Estado de captación</CardTitle>
          <span className="text-[12px] text-[var(--text-3)]">({TITULO[nivel]})</span>
        </div>
        <CardDescription>
          Cron de Supabase, ráfagas Unlocker, listado diario, saldo y cola de teléfonos. Se actualiza cada minuto.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {cargando && checks.length === 0 ? <p className="text-sm text-neutral-500">Comprobando…</p> : null}
        <ul className="space-y-2">
          {checks.map((c) => (
            <li key={c.id} className="flex gap-2 text-[13px]">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[c.nivel]}`} aria-hidden />
              <div>
                <p className="font-medium text-[var(--text-1)]">{c.label}</p>
                <p className="text-[var(--text-2)]">{c.detalle}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[13px]">
          <p className="font-medium">Última ráfaga (procesar)</p>
          {rafagaEnCurso ? <p className="text-[var(--text-2)]">En curso ahora…</p> : null}
          {rafaga ? (
            <p className="text-[var(--text-2)]">
              {cuando(rafaga.iniciada_en)}
              {rafaga.duracion_ms != null ? ` · ${Math.round(rafaga.duracion_ms / 1000)} s` : ""}
              {` · ${rafaga.paginas} pág.`}
              {rafaga.errores ? ` · ${rafaga.errores} error(es)` : ""}
              {rafaga.motivo === "lock_ocupado" ? " · omitida (lock)" : ""}
              {rafaga.ok === false && rafaga.motivo && rafaga.motivo !== "lock_ocupado" ? ` · ${rafaga.motivo}` : ""}
            </p>
          ) : (
            <p className="text-[var(--text-2)]">Sin registros (aplica la migración captacion_rafagas).</p>
          )}
          <p className="mt-1 text-[12px] text-[var(--text-3)]">{pendientes} páginas pendientes en cola</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="default"
            disabled={cargando || lanzandoRecogida || recogidaAbierta}
            title={recogidaAbierta ? "Hay una recogida abierta de menos de 6 h." : undefined}
            onClick={() => void lanzarRecogida()}
          >
            {lanzandoRecogida ? "Abriendo…" : "Lanzar recogida ahora"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={cargando || procesandoRafaga || rafagaEnCurso}
            title={rafagaEnCurso ? "Hay una ráfaga en curso." : undefined}
            onClick={() => void procesarRafaga()}
          >
            {procesandoRafaga ? "Procesando…" : "Procesar ráfaga ahora"}
          </Button>
          <Button type="button" variant="secondary" disabled={cargando} onClick={() => void cargar()}>
            {cargando ? "Actualizando…" : "Actualizar"}
          </Button>
        </div>
        {accionLinea ? <p className="text-[13px] text-[var(--text-2)]">{accionLinea}</p> : null}
      </CardContent>
    </Card>
  );
}
