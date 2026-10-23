"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { formatoDuracion, formatoRelojVivo, etiquetaPunch, replayDia } from "@/lib/time/replay";
import { sugerirModalidad } from "@/lib/time/geo";
import { encolarPunch, sincronizarPendientes } from "@/lib/time/offline-queue";
import type { DayReplay, Punch, PunchMode, PunchType, WorkCenter } from "@/lib/time/types";
import { TF } from "./tokens";

type GeoCache = { lat: number; lng: number; accuracy: number | null; at: number };

type Tab = "hoy" | "mes";

type TodayPayload = {
  hoy: string;
  nowIso: string;
  centros: WorkCenter[];
  punches: Punch[];
  replay: DayReplay;
  incidenciaAyer: { date: string; type: "out" } | null;
  correctionsPending: Array<{ id: string; date: string; type: string; status: string }>;
};

type MonthPayload = {
  month: string;
  hoy: string;
  nowIso: string;
  kpis: { trabajadasMs: number; previstasMs: number; extraMs: number };
  celdas: Array<{
    date: string;
    day: number;
    weekend: boolean;
    holiday: boolean;
    future: boolean;
    effectiveMs: number;
    missingOut: boolean;
    remote: boolean;
    phase: string;
  }>;
  punches: Punch[];
  resumenAnterior: {
    month: string;
    ordinary_min: number;
    extra_min: number;
    days: number;
    signed_at: string | null;
  } | null;
  corrections: Array<{ id: string; date: string; status: string; type: string }>;
};

function clientId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `c-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function horaCorta(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function labelFecha(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export function FichajePwa({ nombre, iniciales }: { nombre: string; iniciales: string }) {
  const [tab, setTab] = useState<Tab>("hoy");
  const [today, setToday] = useState<TodayPayload | null>(null);
  const [month, setMonth] = useState<MonthPayload | null>(null);
  const [monthKey, setMonthKey] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });
  const [mode, setMode] = useState<PunchMode>("office");
  /** Si true, el GPS no pisa la modalidad elegida a mano. */
  const [modeManual, setModeManual] = useState(false);
  const [centerId, setCenterId] = useState<string | null>(null);
  const [geoLabel, setGeoLabel] = useState("Detectando ubicación…");
  const [confirmOut, setConfirmOut] = useState(false);
  const [corrOpen, setCorrOpen] = useState(false);
  const [corrDate, setCorrDate] = useState("");
  const [corrType, setCorrType] = useState<PunchType>("out");
  const [corrTime, setCorrTime] = useState("18:00");
  const [corrReason, setCorrReason] = useState("Olvidé fichar");
  const [signOpen, setSignOpen] = useState(false);
  const [selDay, setSelDay] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [geo, setGeo] = useState<GeoCache | null>(null);
  const [monthLoaded, setMonthLoaded] = useState<string | null>(null);

  const aplicarPunchLocal = useCallback((punch: Punch) => {
    setToday((prev) => {
      if (!prev) return prev;
      if (prev.punches.some((p) => p.id === punch.id || (punch.client_id && p.client_id === punch.client_id))) {
        return prev;
      }
      const punches = [...prev.punches, punch];
      const nowIso = new Date().toISOString();
      return { ...prev, nowIso, punches, replay: replayDia(punches, nowIso) };
    });
  }, []);

  const cargarHoy = useCallback(async () => {
    const res = await fetch("/api/time/day?scope=today");
    const json = await res.json();
    if (json.ok) setToday(json as TodayPayload);
  }, []);

  const cargarMes = useCallback(async (m: string) => {
    const res = await fetch(`/api/time/day?scope=month&month=${m}`);
    const json = await res.json();
    if (json.ok) {
      setMonth(json as MonthPayload);
      setMonthLoaded(m);
      setSelDay((prev) => {
        if (prev?.startsWith(m)) return prev;
        return json.hoy?.startsWith(m) ? json.hoy : `${m}-01`;
      });
    }
  }, []);

  useEffect(() => {
    void cargarHoy();
    void sincronizarPendientes().then((n) => {
      if (n > 0) void cargarHoy();
    });
  }, [cargarHoy]);

  useEffect(() => {
    if (tab === "mes" && monthLoaded !== monthKey) void cargarMes(monthKey);
  }, [tab, monthKey, monthLoaded, cargarMes]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!today?.centros?.length) return;
    if (!navigator.geolocation) {
      setGeoLabel("Sin GPS · elige modalidad");
      setMode("office");
      setCenterId(today.centros[0]?.id ?? null);
      return;
    }

    const aplicarPos = (pos: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = pos.coords;
      setGeo({ lat: latitude, lng: longitude, accuracy, at: Date.now() });
      const s = sugerirModalidad(latitude, longitude, today.centros, null, accuracy);
      setMode(s.mode);
      setCenterId(s.workCenter?.id ?? today.centros[0]?.id ?? null);
      if (s.mode === "office" && s.workCenter) {
        setGeoLabel(`Oficina · ${s.workCenter.name} detectada`);
      } else if (s.distanceM != null) {
        setGeoLabel(`A ${Math.round(s.distanceM)} m · Teletrabajo`);
      } else {
        setGeoLabel("Fuera de oficina · Teletrabajo");
      }
    };

    // Primera lectura rápida; si falla o es burda, reintento con más precisión.
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        aplicarPos(pos);
        if (pos.coords.accuracy > 80) {
          navigator.geolocation.getCurrentPosition(aplicarPos, () => undefined, {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 0,
          });
        }
      },
      () => {
        setGeoLabel("Sin señal · elige modalidad");
        setMode("office");
        setCenterId(today.centros[0]?.id ?? null);
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 15_000 }
    );
  }, [today?.centros]);

  const phase = today?.replay.phase ?? "out";
  const effectiveMs = useMemo(() => {
    void tick;
    if (!today) return 0;
    if (phase === "paused") return today.replay.pauseMs;
    if (phase === "working" && today.replay.openSince) {
      const base = today.replay.effectiveMs;
      // replay ya incluye hasta nowIso del payload; recontamos con reloj local.
      return replayDia(today.punches, new Date().toISOString()).effectiveMs || base;
    }
    return today.replay.effectiveMs;
  }, [today, phase, tick]);

  const centroNombre = today?.centros.find((c) => c.id === centerId)?.name ?? "Oficina";

  async function fichar(type: PunchType) {
    if (busy) return;
    setBusy(true);
    setConfirmOut(false);
    const cid = clientId();
    const payload = {
      type,
      mode,
      workCenterId: mode === "office" ? centerId : null,
      clientAt: new Date().toISOString(),
      clientId: cid,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      accuracy: geo?.accuracy ?? null,
      source: navigator.onLine ? "pwa" : "pwa-offline",
    };

    // Refresco GPS en segundo plano (no bloquea el POST).
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setGeo({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            at: Date.now(),
          }),
        () => undefined,
        { enableHighAccuracy: false, timeout: 2000, maximumAge: 60_000 }
      );
    }

    try {
      if (!navigator.onLine) throw new Error("offline");
      const res = await fetch("/api/time/punch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      aplicarPunchLocal(json.punch as Punch);
      toast.success(
        `${etiquetaPunch(type)} registrada a las ${horaCorta(json.punch.at)} · ${mode === "office" ? centroNombre : "Teletrabajo"}`
      );
      if (tab === "mes") setMonthLoaded(null);
    } catch {
      await encolarPunch(payload);
      toast.message("Sin conexión: fichaje guardado y se enviará al recuperar red.");
    } finally {
      setBusy(false);
    }
  }

  async function enviarCorreccion() {
    if (!corrDate) return;
    setBusy(true);
    try {
      const proposedAt = `${corrDate}T${corrTime}:00+02:00`;
      const res = await fetch("/api/time/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: corrDate,
          type: corrType,
          proposedAt,
          reason: corrReason,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      toast.success("Corrección enviada");
      setCorrOpen(false);
      void cargarHoy();
      setMonthLoaded(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar");
    } finally {
      setBusy(false);
    }
  }

  async function firmar() {
    if (!month?.resumenAnterior?.month) return;
    setBusy(true);
    try {
      const res = await fetch("/api/time/summaries/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: month.resumenAnterior.month }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      toast.success("Resumen firmado");
      setSignOpen(false);
      setMonthLoaded(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo firmar");
    } finally {
      setBusy(false);
    }
  }

  const pill =
    phase === "working"
      ? { label: "Trabajando", className: TF.ok }
      : phase === "paused"
        ? { label: "En pausa", className: TF.warn }
        : { label: "Fuera", className: "bg-[#1E1E20] text-[#8A8A90]" };

  const dayPunches = useMemo(() => {
    if (!month || !selDay) return [];
    return month.punches.filter((p) => {
      const d = new Date(p.at).toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
      return d === selDay && !p.superseded_by;
    });
  }, [month, selDay]);

  const selCelda = month?.celdas.find((c) => c.date === selDay);

  const fechaHoyLabel = new Date().toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Madrid",
  });

  return (
    <div className={cn("mx-auto flex min-h-[100dvh] max-w-[430px] flex-col", TF.page)}>
      <header className="flex flex-col gap-3 px-4 pb-1 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-[15px] text-[#B0B0B5]">
            ‹ Inicio
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[14px] text-[#B0B0B5]">{nombre.split(" ")[0]}</span>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#2B3E73] text-[12px] font-semibold">
              {iniciales}
            </span>
          </div>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold tracking-tight">Fichaje</h1>
            <p className={cn("text-[13px] capitalize", TF.soft)}>{fechaHoyLabel}</p>
          </div>
          <div className="flex shrink-0 gap-0.5 rounded-[10px] border border-[#232326] bg-[#161617] p-[3px]">
            <button
              type="button"
              onClick={() => setTab("hoy")}
              className={cn(
                "h-9 rounded-lg px-3.5 text-[13px] font-medium transition-colors",
                tab === "hoy" ? "bg-[#1E1E20] text-[#EDEDED]" : "bg-transparent text-[#8A8A90]"
              )}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => setTab("mes")}
              className={cn(
                "h-9 rounded-lg px-3.5 text-[13px] font-medium transition-colors",
                tab === "mes" ? "bg-[#1E1E20] text-[#EDEDED]" : "bg-transparent text-[#8A8A90]"
              )}
            >
              Mi mes
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3">
        {tab === "hoy" ? (
          <div className="flex flex-col gap-4">

            {today?.incidenciaAyer ? (
              <button
                type="button"
                className={cn("flex w-full items-start justify-between gap-3 rounded-[14px] px-4 py-3 text-left", TF.warn)}
                onClick={() => {
                  setCorrDate(today.incidenciaAyer!.date);
                  setCorrType("out");
                  setCorrOpen(true);
                }}
              >
                <span className="text-[14px] leading-snug">
                  Ayer no fichaste la salida — {labelFecha(today.incidenciaAyer.date)} · toca para indicar la hora
                </span>
                <span className="shrink-0 text-[13px] font-medium">Corregir ›</span>
              </button>
            ) : null}

            <section className={cn(TF.cardHero, "flex flex-col gap-5 p-5")}>
              <span className={cn("self-start rounded-full px-3 py-1 text-[12px] font-medium", pill.className)}>
                {pill.label}
              </span>
              <p className={cn("text-[56px] font-medium leading-none tracking-tight", TF.mono)}>
                {formatoRelojCorto(effectiveMs)}
              </p>
              <p className={cn("text-[14px]", TF.soft)}>
                {phase === "out"
                  ? geoLabel
                  : `desde las ${today?.replay.openSince ? horaCorta(today.replay.openSince) : "—"} · ${mode === "office" ? centroNombre : "Teletrabajo"}`}
              </p>

              {phase === "out" ? (
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    className={cn(TF.primaryBtn, "h-16 text-[17px]")}
                    onClick={() => void fichar("in")}
                  >
                    Fichar entrada
                  </button>
                  <p className={cn("text-center text-[13px]", TF.soft)}>
                    📍 {geoLabel} ·{" "}
                    <button
                      type="button"
                      className="underline underline-offset-2"
                      onClick={() => setMode((m) => (m === "office" ? "remote" : "office"))}
                    >
                      {mode === "office" ? "¿Teletrabajo?" : "Estoy en la oficina"}
                    </button>
                  </p>
                </div>
              ) : null}

              {phase === "working" ? (
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" disabled={busy} className={cn(TF.ghostBtn, "h-[60px]")} onClick={() => void fichar("pause_start")}>
                    Pausa
                  </button>
                  <button type="button" disabled={busy} className={cn(TF.primaryBtn, "h-[60px]")} onClick={() => setConfirmOut(true)}>
                    Fichar salida
                  </button>
                </div>
              ) : null}

              {phase === "paused" ? (
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" disabled={busy} className={cn(TF.primaryBtn, "h-[60px]")} onClick={() => void fichar("pause_end")}>
                    Reanudar
                  </button>
                  <button type="button" disabled={busy} className={cn(TF.ghostBtn, "h-[60px]")} onClick={() => setConfirmOut(true)}>
                    Salida
                  </button>
                </div>
              ) : null}
            </section>

            <section className={cn(TF.card, "p-4")}>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-[15px] font-medium">Hoy</h2>
                <span className={cn("text-[12px]", TF.soft)}>
                  {formatoDuracion(today?.replay.effectiveMs ?? 0)}
                  {(today?.replay.pauseMs ?? 0) > 0 ? ` · pausas ${formatoDuracion(today!.replay.pauseMs)}` : ""}
                </span>
              </div>
              <ul className="flex flex-col gap-2.5">
                {(today?.replay.events ?? []).length === 0 ? (
                  <li className={cn("text-[14px]", TF.dim)}>Todavía no hay fichajes hoy.</li>
                ) : (
                  today!.replay.events.map((e) => (
                    <li key={e.id} className="flex items-center gap-3 text-[14px]">
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          e.type === "pause_start" ? "bg-[#F2C66D]" : e.type === "out" ? "bg-[#6B6B70]" : "bg-[#7EE2A0]"
                        )}
                      />
                      <span className={cn(TF.mono)}>{horaCorta(e.at)}</span>
                      <span>
                        {etiquetaPunch(e.type)}
                        <span className={cn("ml-1", TF.dim)}>
                          · {e.mode === "remote" ? "Teletrabajo" : centroNombre}
                        </span>
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="px-2 text-[22px] text-[#B0B0B5]"
                onClick={() => {
                  const [y, m] = monthKey.split("-").map(Number);
                  const d = new Date(y, m - 2, 1);
                  setMonthKey(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
                }}
              >
                ‹
              </button>
              <h1 className="text-[22px] font-medium capitalize">
                {new Date(`${monthKey}-01T12:00:00`).toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
              </h1>
              <button
                type="button"
                className={cn("px-2 text-[22px]", monthKey >= (today?.hoy.slice(0, 7) ?? monthKey) ? "text-[#4A4A4E]" : "text-[#B0B0B5]")}
                disabled={monthKey >= (today?.hoy.slice(0, 7) ?? monthKey)}
                onClick={() => {
                  const [y, m] = monthKey.split("-").map(Number);
                  const d = new Date(y, m, 1);
                  setMonthKey(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
                }}
              >
                ›
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                ["Trabajadas", formatoDuracion(month?.kpis.trabajadasMs ?? 0)],
                ["Previstas", formatoDuracion(month?.kpis.previstasMs ?? 0)],
                ["Extra", formatoDuracion(month?.kpis.extraMs ?? 0)],
              ].map(([l, v]) => (
                <div key={l} className={cn(TF.card, "px-3 py-3")}>
                  <p className={cn("text-[11px]", TF.soft)}>{l}</p>
                  <p className={cn("mt-1 text-[15px] font-medium", TF.mono)}>{v}</p>
                </div>
              ))}
            </div>

            <div className={cn(TF.card, "p-3")}>
              <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] text-[#6B6B70]">
                {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {(() => {
                  const first = month?.celdas[0]?.date;
                  if (!first) return null;
                  const [y, m, d] = first.split("-").map(Number);
                  const dow = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
                  const pad = (dow + 6) % 7;
                  return (
                    <>
                      {Array.from({ length: pad }).map((_, i) => (
                        <span key={`pad-${i}`} />
                      ))}
                      {(month?.celdas ?? []).map((c) => {
                        const active = c.date === selDay;
                        const dot =
                          c.weekend || c.holiday || c.future
                            ? null
                            : c.missingOut
                              ? "bg-[#F2C66D]"
                              : c.remote
                                ? "bg-[#9FC0F2]"
                                : c.effectiveMs > 0
                                  ? "bg-[#7EE2A0]"
                                  : null;
                        return (
                          <button
                            key={c.date}
                            type="button"
                            disabled={c.weekend || c.holiday || c.future}
                            onClick={() => setSelDay(c.date)}
                            className={cn(
                              "flex h-[46px] flex-col items-center justify-center rounded-[10px] text-[13px]",
                              c.date === today?.hoy && "bg-[#1E1E20]",
                              active && "border border-[#EDEDED]",
                              (c.weekend || c.holiday || c.future) && "text-[#4A4A4E]"
                            )}
                          >
                            {c.day}
                            {dot ? <span className={cn("mt-0.5 h-1.5 w-1.5 rounded-full", dot)} /> : null}
                          </button>
                        );
                      })}
                    </>
                  );
                })()}
              </div>
              <p className={cn("mt-3 flex flex-wrap gap-3 text-[11px]", TF.dim)}>
                <span>● Completo</span>
                <span className="text-[#F2C66D]">● Incidencia</span>
                <span className="text-[#9FC0F2]">● Teletrabajo</span>
              </p>
            </div>

            {selDay ? (
              <section className={cn(TF.card, "p-4")}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-[16px] font-medium capitalize">{labelFecha(selDay)}</h2>
                    <p className={cn("text-[13px]", TF.soft)}>
                      {selCelda?.missingOut
                        ? "Falta la salida"
                        : `${formatoDuracion(selCelda?.effectiveMs ?? 0)}${selCelda?.remote ? " · teletrabajo" : ""}`}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-medium",
                      selCelda?.missingOut ? TF.warn : selCelda?.remote ? TF.info : TF.okSoft
                    )}
                  >
                    {selCelda?.missingOut ? "Incidencia" : selCelda?.remote ? "Teletrabajo" : "Completo"}
                  </span>
                </div>
                <ul className="mt-3 flex flex-col gap-2">
                  {dayPunches.map((e) => (
                    <li key={e.id} className="flex gap-3 text-[14px]">
                      <span className={TF.mono}>{horaCorta(e.at)}</span>
                      <span>{etiquetaPunch(e.type)}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={cn(TF.ghostBtn, "mt-4 h-11 w-full text-[14px]")}
                  onClick={() => {
                    setCorrDate(selDay);
                    setCorrType(selCelda?.missingOut ? "out" : "in");
                    setCorrOpen(true);
                  }}
                >
                  {selCelda?.missingOut ? "Indicar la hora de salida" : "Solicitar corrección"}
                </button>
              </section>
            ) : null}

            {month?.resumenAnterior && !month.resumenAnterior.signed_at ? (
              <button
                type="button"
                className={cn("flex w-full items-center justify-between rounded-[14px] px-4 py-3 text-left", TF.warn)}
                onClick={() => setSignOpen(true)}
              >
                <span className="text-[14px]">
                  Resumen de {month.resumenAnterior.month} sin firmar · {formatoDuracion(month.resumenAnterior.ordinary_min * 60_000)} ·{" "}
                  {formatoDuracion(month.resumenAnterior.extra_min * 60_000)} extra
                </span>
                <span className="shrink-0 text-[13px] font-medium">Firmar ›</span>
              </button>
            ) : null}
            {month?.resumenAnterior?.signed_at ? (
              <div className={cn("rounded-[14px] px-4 py-3 text-[14px]", TF.okSoft)}>
                {month.resumenAnterior.month} firmado ·{" "}
                {new Date(month.resumenAnterior.signed_at).toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <Sheet open={confirmOut} onOpenChange={setConfirmOut}>
        <div className="space-y-4 p-5 pb-8">
          <h3 className="text-[18px] font-medium">¿Fichar salida?</h3>
          <p className={cn("text-[14px]", TF.muted)}>
            Jornada de hoy: {formatoDuracion(today?.replay.effectiveMs ?? 0)}
            {(today?.replay.pauseMs ?? 0) > 0 ? ` · pausas ${formatoDuracion(today!.replay.pauseMs)}` : ""}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={cn(TF.ghostBtn, "h-12")} onClick={() => setConfirmOut(false)}>
              Seguir
            </button>
            <button type="button" className={cn(TF.primaryBtn, "h-12")} disabled={busy} onClick={() => void fichar("out")}>
              Confirmar salida
            </button>
          </div>
        </div>
      </Sheet>

      <Sheet open={corrOpen} onOpenChange={setCorrOpen}>
        <div className="space-y-4 p-5 pb-8">
          <div>
            <h3 className="text-[18px] font-medium">Corregir {etiquetaPunch(corrType).toLowerCase()}</h3>
            <p className={cn("mt-1 text-[13px]", TF.soft)}>
              {corrDate ? labelFecha(corrDate) : ""} · Se mantiene el registro original hasta que se apruebe.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["in", "out", "pause_start"] as PunchType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setCorrType(t)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[13px]",
                  corrType === t ? "bg-[#EDEDED] text-[#0E0E0F]" : "border border-[#2A2A2E] text-[#B0B0B5]"
                )}
              >
                {etiquetaPunch(t)}
              </button>
            ))}
          </div>
          <input type="time" value={corrTime} onChange={(e) => setCorrTime(e.target.value)} className={cn(TF.input, "h-14 w-full px-4 text-[22px]", TF.mono)} />
          <div className="flex flex-col gap-2">
            {["Olvidé fichar", "Fiché tarde", "Fiché por error", "Otro"].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setCorrReason(r)}
                className={cn(
                  "rounded-[10px] border px-3 py-2.5 text-left text-[14px]",
                  corrReason === r ? "border-[#EDEDED] bg-[#1E1E20]" : "border-[#2A2A2E]"
                )}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={cn(TF.ghostBtn, "h-12")} onClick={() => setCorrOpen(false)}>
              Cancelar
            </button>
            <button type="button" className={cn(TF.primaryBtn, "h-12")} disabled={busy} onClick={() => void enviarCorreccion()}>
              Enviar
            </button>
          </div>
        </div>
      </Sheet>

      <Sheet open={signOpen} onOpenChange={setSignOpen}>
        <div className="space-y-4 p-5 pb-8">
          <h3 className="text-[18px] font-medium">Firmar resumen</h3>
          <p className={cn("text-[14px]", TF.muted)}>
            {month?.resumenAnterior?.days ?? 0} días · {formatoDuracion((month?.resumenAnterior?.ordinary_min ?? 0) * 60_000)} ordinarias ·{" "}
            {formatoDuracion((month?.resumenAnterior?.extra_min ?? 0) * 60_000)} extra
          </p>
          <p className={cn("text-[13px] leading-relaxed", TF.soft)}>
            Confirmas que el registro de jornada del mes es correcto. La firma queda auditada con fecha, IP y dispositivo.
          </p>
          <button type="button" className={cn(TF.primaryBtn, "h-12 w-full")} disabled={busy} onClick={() => void firmar()}>
            Firmar conformidad
          </button>
        </div>
      </Sheet>
    </div>
  );
}
