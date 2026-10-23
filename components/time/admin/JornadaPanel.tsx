"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { formatoDuracion, etiquetaPunch } from "@/lib/time/replay";
import type { Punch } from "@/lib/time/types";
import { TF } from "../tokens";

type Tab = "hoy" | "calendario" | "solicitudes" | "informes" | "auditoria";

type TeamMember = {
  id: string;
  nombre: string;
  color: string | null;
  phase: string;
  replay: { phase: string; effectiveMs: number; pauseMs: number; openSince: string | null; events: Punch[]; overNineHours: boolean };
  punchesHoy: Punch[];
  punchesMes: Punch[];
  kpis: { trabajadasMs: number; previstasMs: number; extraMs: number; remoteDays: number; daysWithWork: number };
  signedAt: string | null;
  extraCompensation: string | null;
};

type TeamPayload = {
  hoy: string;
  month: string;
  nowIso: string;
  counts: { working: number; paused: number; out: number; sinFichar: number };
  team: TeamMember[];
  corrections: Array<{
    id: string;
    user_id: string;
    date: string;
    type: string;
    proposed_at: string;
    reason: string;
    note: string | null;
    status: string;
    requested_at: string;
  }>;
  audit: Array<{ id: string; at: string; actor_label: string; action: string; detail: string; origin: string }>;
  protocolo: { pdf_path: string | null; uploaded_at: string | null } | null;
  festivos: string[];
};

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" });
}

function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function TimelineBar({ punches }: { punches: Punch[] }) {
  const startMin = 7 * 60;
  const endMin = 21 * 60;
  const span = endMin - startMin;
  const segs: Array<{ left: number; width: number; kind: "work" | "pause" }> = [];
  let openWork: number | null = null;
  let openPause: number | null = null;
  const toMin = (iso: string) => {
    const p = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Madrid",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(iso));
    const h = Number(p.find((x) => x.type === "hour")?.value ?? 0);
    const m = Number(p.find((x) => x.type === "minute")?.value ?? 0);
    return h * 60 + m;
  };
  for (const e of punches.filter((p) => !p.superseded_by).sort((a, b) => +new Date(a.at) - +new Date(b.at))) {
    const t = Math.min(endMin, Math.max(startMin, toMin(e.at)));
    if (e.type === "in") openWork = t;
    if (e.type === "pause_start" && openWork != null) {
      segs.push({ left: ((openWork - startMin) / span) * 100, width: ((t - openWork) / span) * 100, kind: "work" });
      openWork = null;
      openPause = t;
    }
    if (e.type === "pause_end" && openPause != null) {
      segs.push({ left: ((openPause - startMin) / span) * 100, width: ((t - openPause) / span) * 100, kind: "pause" });
      openPause = null;
      openWork = t;
    }
    if (e.type === "out") {
      if (openWork != null) {
        segs.push({ left: ((openWork - startMin) / span) * 100, width: ((t - openWork) / span) * 100, kind: "work" });
        openWork = null;
      }
      if (openPause != null) {
        segs.push({ left: ((openPause - startMin) / span) * 100, width: ((t - openPause) / span) * 100, kind: "pause" });
        openPause = null;
      }
    }
  }
  const now = toMin(new Date().toISOString());
  if (openWork != null) {
    segs.push({ left: ((openWork - startMin) / span) * 100, width: ((Math.min(endMin, now) - openWork) / span) * 100, kind: "work" });
  }
  if (openPause != null) {
    segs.push({ left: ((openPause - startMin) / span) * 100, width: ((Math.min(endMin, now) - openPause) / span) * 100, kind: "pause" });
  }
  return (
    <div className="relative h-3 w-full overflow-hidden rounded-full bg-[#1A1A1C]">
      {segs.map((s, i) => (
        <span
          key={i}
          className={cn("absolute top-0 h-full rounded-full", s.kind === "work" ? "bg-[#7EE2A0]/70" : "bg-[#F2C66D]/80")}
          style={{ left: `${s.left}%`, width: `${Math.max(s.width, 0.8)}%` }}
        />
      ))}
    </div>
  );
}

export function JornadaPanel() {
  const [tab, setTab] = useState<Tab>("hoy");
  const [data, setData] = useState<TeamPayload | null>(null);
  const [personId, setPersonId] = useState<string | null>(null);
  const [month, setMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });
  const [adminCorr, setAdminCorr] = useState<{ userId: string; date: string } | null>(null);
  const [corrTime, setCorrTime] = useState("18:00");
  const [corrType, setCorrType] = useState("out");
  const [corrReason, setCorrReason] = useState("Ajuste administrativo");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/time/team?month=${month}`);
    const json = await res.json();
    if (json.ok) {
      setData(json);
      if (!personId && json.team[0]) setPersonId(json.team[0].id);
    }
  }, [month, personId]);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = data?.corrections.length ?? 0;
  const selected = data?.team.find((t) => t.id === personId) ?? data?.team[0];

  async function decidir(id: string, decision: "approved" | "rejected") {
    setBusy(true);
    try {
      const res = await fetch("/api/time/corrections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, decision }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      toast.success(decision === "approved" ? "Corrección aprobada" : "Corrección rechazada");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function corregirAdmin() {
    if (!adminCorr) return;
    setBusy(true);
    try {
      const res = await fetch("/api/time/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: adminCorr.userId,
          date: adminCorr.date,
          type: corrType,
          proposedAt: `${adminCorr.date}T${corrTime}:00+02:00`,
          reason: corrReason,
          resolveNow: true,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      toast.success("Corrección aplicada");
      setAdminCorr(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function exportar() {
    const res = await fetch(`/api/time/export?month=${month}`);
    if (!res.ok) {
      toast.error("No se pudo exportar");
      return;
    }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `inspeccion_jornada_${month}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Paquete de Inspección descargado");
  }

  async function subirProtocolo(file: File) {
    const fd = new FormData();
    fd.set("file", file);
    const res = await fetch("/api/time/protocol", { method: "POST", body: fd });
    const json = await res.json();
    if (!json.ok) {
      toast.error(json.error ?? "Error");
      return;
    }
    toast.success("Protocolo subido");
    await load();
  }

  const tabs: Array<[Tab, string]> = useMemo(
    () => [
      ["hoy", "Hoy"],
      ["calendario", "Calendario"],
      ["solicitudes", `Solicitudes${pending ? ` (${pending})` : ""}`],
      ["informes", "Informes"],
      ["auditoria", "Auditoría"],
    ],
    [pending]
  );

  return (
    <div className={cn("min-h-[100dvh] px-4 py-6 md:px-8", TF.page)}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className={cn("text-[13px]", TF.soft)}>
            <Link href="/settings" className="hover:underline">
              Equipo
            </Link>{" "}
            / Registro de jornada
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-[28px] font-medium tracking-tight">Registro de jornada</h1>
            <span className={cn("rounded-full px-3 py-1 text-[12px] font-medium", data?.protocolo?.pdf_path ? TF.okSoft : TF.warn)}>
              {data?.protocolo?.pdf_path ? "Cumple · registro digital" : `Cumple · ${pending || 1} pendiente`}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={cn(TF.ghostBtn, "h-10 px-4 text-[13px]")} onClick={() => void exportar()}>
            Exportar para Inspección
          </button>
          <button
            type="button"
            className={cn(TF.primaryBtn, "h-10 px-4 text-[13px]")}
            onClick={() => {
              setTab("informes");
              toast.message("Genera los resúmenes desde Informes o espera al cron del día 1.");
            }}
          >
            Informe mensual
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-1 border-b border-[#232326] pb-px">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "rounded-t-[10px] px-3.5 py-2.5 text-[14px]",
              tab === id ? "bg-[#161617] text-[#EDEDED]" : "text-[#8A8A90] hover:text-[#EDEDED]"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "hoy" && data ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ["Trabajando", data.counts.working, TF.ok],
                ["En pausa", data.counts.paused, TF.warn],
                ["Fuera", data.counts.out, "bg-[#1E1E20] text-[#B0B0B5]"],
                ["Sin fichar hoy", data.counts.sinFichar, TF.err],
              ].map(([l, n, cls]) => (
                <div key={String(l)} className={cn(TF.card, "p-4")}>
                  <p className={cn("text-[12px]", TF.soft)}>{l}</p>
                  <p className={cn("mt-2 text-[28px] font-medium", TF.mono)}>{n as number}</p>
                  <span className={cn("mt-2 inline-block rounded-full px-2 py-0.5 text-[11px]", cls as string)}>estado</span>
                </div>
              ))}
            </div>

            {(pending > 0 || !data.protocolo?.pdf_path) && (
              <div className={cn("rounded-[14px] border px-4 py-3", TF.warn)}>
                <p className="text-[14px] font-medium">Necesita tu atención</p>
                {data.corrections[0] ? (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[13px]">
                    <span>
                      Hay {pending} solicitud(es) de corrección pendientes.
                    </span>
                    <button type="button" className="underline" onClick={() => setTab("solicitudes")}>
                      Revisar solicitud
                    </button>
                  </div>
                ) : null}
                {!data.protocolo?.pdf_path ? (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[13px]">
                    <span>Falta el protocolo de registro firmado.</span>
                    <label className="cursor-pointer underline">
                      Subir PDF
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void subirProtocolo(f);
                        }}
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            )}

            <section className={cn(TF.card, "overflow-hidden")}>
              <div className="border-b border-[#1F1F22] px-4 py-3 text-[15px] font-medium">Equipo hoy</div>
              <ul className="divide-y divide-[#1F1F22]">
                {data.team.map((m) => (
                  <li key={m.id} className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center">
                    <div className="flex min-w-[180px] items-center gap-3">
                      <span
                        className="grid h-10 w-10 place-items-center rounded-full text-[12px] font-semibold text-white"
                        style={{ background: m.color || "#2B3E73" }}
                      >
                        {iniciales(m.nombre)}
                      </span>
                      <div>
                        <p className="text-[14px] font-medium">{m.nombre}</p>
                        <p className={cn("text-[12px]", TF.soft)}>
                          {m.phase === "absent"
                            ? "Sin fichar"
                            : m.phase === "working"
                              ? `Trabajando desde ${m.replay.openSince ? hora(m.replay.openSince) : "—"}`
                              : m.phase === "paused"
                                ? "En pausa"
                                : "Fuera"}
                          {m.replay.overNineHours ? " · supera 9 h" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <TimelineBar punches={m.punchesHoy} />
                      <p className={cn("mt-1 text-[11px]", TF.dim)}>07:00 — 21:00</p>
                    </div>
                    <div className="flex items-center gap-3 md:w-[140px] md:justify-end">
                      <span className={cn("text-[14px]", TF.mono)}>{formatoDuracion(m.replay.effectiveMs)}</span>
                      <button
                        type="button"
                        className="text-[13px] text-[#9FC0F2] underline-offset-2 hover:underline"
                        onClick={() => {
                          setPersonId(m.id);
                          setTab("calendario");
                        }}
                      >
                        Ver mes
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <aside className="flex flex-col gap-4">
            <div className={cn(TF.card, "p-4")}>
              <h2 className="text-[15px] font-medium">Cumplimiento normativo</h2>
              <ul className="mt-3 space-y-2 text-[13px]">
                {[
                  ["Registro digital", true],
                  ["Inalterable (append-only)", true],
                  ["Trazabilidad / auditoría", true],
                  ["Pausas registradas", true],
                  ["Modalidad oficina/remoto", true],
                  ["Acceso remoto ITSS (export)", true],
                  ["Protocolo documentado", Boolean(data.protocolo?.pdf_path)],
                ].map(([label, ok]) => (
                  <li key={String(label)} className="flex items-center gap-2">
                    <span className={ok ? "text-[#7EE2A0]" : "text-[#F2C66D]"}>{ok ? "✓" : "!"}</span>
                    <span className={ok ? undefined : "text-[#F2C66D]"}>{label}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={cn(TF.card, "p-4")}>
              <h2 className="text-[15px] font-medium">Si viene la Inspección</h2>
              <p className={cn("mt-2 text-[13px] leading-relaxed", TF.soft)}>
                El ZIP incluye CSV de fichajes, PDF resumen por persona/día y log de cambios. Plazo de entrega orientativo: 24 h.
              </p>
            </div>
          </aside>
        </div>
      ) : null}

      {tab === "calendario" && data ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {data.team.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setPersonId(m.id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[13px]",
                  personId === m.id ? "bg-[#EDEDED] text-[#0E0E0F]" : "border border-[#2A2A2E] text-[#B0B0B5]"
                )}
              >
                {m.nombre.split(" ")[0]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className={cn(TF.input, "h-10 px-3")}
            />
            <span className={cn("text-[13px]", TF.soft)}>Selecciona persona y mes</span>
          </div>
          {selected ? (
            <div className={cn(TF.card, "p-4")}>
              <h2 className="text-[16px] font-medium">{selected.nombre}</h2>
              <p className={cn("text-[13px]", TF.soft)}>
                {formatoDuracion(selected.kpis.trabajadasMs)} trabajadas · extra {formatoDuracion(selected.kpis.extraMs)} · teletrabajo{" "}
                {selected.kpis.remoteDays} días
              </p>
              <ul className="mt-4 max-h-[420px] space-y-2 overflow-y-auto">
                {selected.punchesMes
                  .filter((p) => !p.superseded_by)
                  .map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-3 border-b border-[#1F1F22] py-2 text-[13px]">
                      <span className={TF.mono}>{new Date(p.at).toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}</span>
                      <span>{etiquetaPunch(p.type as never)}</span>
                      <span className={TF.dim}>{p.mode}</span>
                      <button
                        type="button"
                        className="ml-auto text-[#9FC0F2] underline-offset-2 hover:underline"
                        onClick={() =>
                          setAdminCorr({
                            userId: selected.id,
                            date: new Date(p.at).toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" }),
                          })
                        }
                      >
                        Corregir como admin
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "solicitudes" && data ? (
        <div className="flex flex-col gap-3">
          {data.corrections.length === 0 ? (
            <p className={cn(TF.card, "p-6 text-[14px]", TF.soft)}>Todo al día</p>
          ) : (
            data.corrections.map((c) => {
              const quien = data.team.find((t) => t.id === c.user_id)?.nombre ?? c.user_id;
              return (
                <article key={c.id} className={cn(TF.card, "p-4")}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[15px] font-medium">{quien}</p>
                      <p className={cn("text-[13px]", TF.soft)}>
                        {c.date} · enviada {new Date(c.requested_at).toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}
                      </p>
                    </div>
                    <span className={cn("rounded-full px-2.5 py-1 text-[11px]", TF.warn)}>Pendiente</span>
                  </div>
                  <p className="mt-3 text-[14px]">
                    {etiquetaPunch(c.type as never)} propuesta → <span className={TF.mono}>{hora(c.proposed_at)}</span>
                  </p>
                  <p className={cn("mt-1 text-[13px]", TF.soft)}>
                    {c.reason}
                    {c.note ? ` · ${c.note}` : ""}
                  </p>
                  <div className="mt-4 flex gap-2">
                    <button type="button" disabled={busy} className={cn(TF.ghostBtn, "h-10 px-4 text-[13px]")} onClick={() => void decidir(c.id, "rejected")}>
                      Rechazar
                    </button>
                    <button type="button" disabled={busy} className={cn(TF.primaryBtn, "h-10 px-4 text-[13px]")} onClick={() => void decidir(c.id, "approved")}>
                      Aprobar corrección
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      ) : null}

      {tab === "informes" && data ? (
        <div className={cn(TF.card, "overflow-x-auto")}>
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="border-b border-[#1F1F22] text-[#8A8A90]">
              <tr>
                {["Persona", "Días", "Ordinarias", "Extra", "Compensación", "Teletrabajo", "Firma"].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.team.map((m) => (
                <tr key={m.id} className="border-b border-[#1F1F22]">
                  <td className="px-4 py-3">{m.nombre}</td>
                  <td className={cn("px-4 py-3", TF.mono)}>{m.kpis.daysWithWork}</td>
                  <td className={cn("px-4 py-3", TF.mono)}>{formatoDuracion(m.kpis.trabajadasMs - m.kpis.extraMs)}</td>
                  <td className={cn("px-4 py-3", TF.mono, m.kpis.extraMs > 0 && "text-[#F2C66D]")}>{formatoDuracion(m.kpis.extraMs)}</td>
                  <td className="px-4 py-3">{m.extraCompensation === "pay" ? "Abono en nómina" : m.extraCompensation === "rest" ? "Descanso" : "—"}</td>
                  <td className="px-4 py-3">{m.kpis.remoteDays} días</td>
                  <td className="px-4 py-3">{m.signedAt ? `Firmado ${new Date(m.signedAt).toLocaleDateString("es-ES")}` : "Pendiente"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={cn("px-4 py-3 text-[12px]", TF.dim)}>
            Compensación de extras según convenio. Los PDF individuales se generan el día 1 (cron) o con forceSummaries.
          </p>
        </div>
      ) : null}

      {tab === "auditoria" && data ? (
        <div className={cn(TF.card, "overflow-x-auto")}>
          <p className={cn("border-b border-[#1F1F22] px-4 py-3 text-[13px]", TF.soft)}>
            Nadie puede editar ni borrar entradas, tampoco un administrador.
          </p>
          <table className="w-full min-w-[800px] text-left text-[13px]">
            <thead className="border-b border-[#1F1F22] text-[#8A8A90]">
              <tr>
                {["Fecha y hora", "Quién", "Acción", "Detalle", "Origen"].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.audit.map((a) => (
                <tr key={a.id} className="border-b border-[#1F1F22]">
                  <td className={cn("px-4 py-3", TF.mono)}>
                    {new Date(a.at).toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}
                  </td>
                  <td className="px-4 py-3">{a.actor_label}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px]",
                        a.action === "aprobada" || a.action === "firma"
                          ? TF.okSoft
                          : a.action === "rechazada" || a.action === "incidencia"
                            ? TF.err
                            : a.action === "solicitud"
                              ? TF.warn
                              : "bg-[#1E1E20] text-[#B0B0B5]"
                      )}
                    >
                      {a.action}
                    </span>
                  </td>
                  <td className="px-4 py-3">{a.detail}</td>
                  <td className={cn("px-4 py-3", TF.dim)}>{a.origin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <Sheet open={Boolean(adminCorr)} onOpenChange={(o) => !o && setAdminCorr(null)}>
        <div className="space-y-4 p-5 pb-8">
          <h3 className="text-[18px] font-medium">Corregir como admin</h3>
          <p className={cn("text-[13px]", TF.soft)}>Motivo obligatorio. Queda en auditoría con valor nuevo.</p>
          <select value={corrType} onChange={(e) => setCorrType(e.target.value)} className={cn(TF.input, "h-11 w-full px-3")}>
            <option value="in">Entrada</option>
            <option value="out">Salida</option>
            <option value="pause_start">Pausa</option>
            <option value="pause_end">Reanudar</option>
          </select>
          <input type="time" value={corrTime} onChange={(e) => setCorrTime(e.target.value)} className={cn(TF.input, "h-11 w-full px-3", TF.mono)} />
          <input value={corrReason} onChange={(e) => setCorrReason(e.target.value)} className={cn(TF.input, "h-11 w-full px-3")} placeholder="Motivo" />
          <button type="button" disabled={busy || !corrReason.trim()} className={cn(TF.primaryBtn, "h-12 w-full")} onClick={() => void corregirAdmin()}>
            Aplicar corrección
          </button>
        </div>
      </Sheet>
    </div>
  );
}
