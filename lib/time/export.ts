import { jsPDF } from "jspdf";
import JSZip from "jszip";
import { fechaMadrid } from "./calendar";
import { etiquetaPunch, formatoDuracion, replayDia } from "./replay";
import type { Punch } from "./types";

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function csvPunches(
  punches: Array<Punch & { nombre?: string; centro?: string | null }>
): string {
  const header = [
    "usuario",
    "nombre",
    "fecha",
    "hora",
    "tipo",
    "modalidad",
    "centro",
    "origen",
    "id",
  ];
  const lines = [header.join(",")];
  for (const p of punches) {
    const d = new Date(p.at);
    const fecha = fechaMadrid(p.at);
    const hora = d.toLocaleTimeString("es-ES", {
      timeZone: "Europe/Madrid",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    lines.push(
      [
        p.user_id,
        csvEscape(p.nombre ?? ""),
        fecha,
        hora,
        p.type,
        p.mode,
        csvEscape(p.centro ?? p.work_center_id ?? ""),
        csvEscape(p.source),
        p.id,
      ].join(",")
    );
  }
  return lines.join("\n");
}

export function csvAudit(
  rows: Array<{ at: string; actor_label: string; action: string; detail: string; origin: string }>
): string {
  const lines = ["fecha_hora,quien,accion,detalle,origen"];
  for (const r of rows) {
    lines.push(
      [r.at, csvEscape(r.actor_label), csvEscape(r.action), csvEscape(r.detail), csvEscape(r.origin)].join(",")
    );
  }
  return lines.join("\n");
}

export function pdfResumenMes(input: {
  month: string;
  personas: Array<{
    nombre: string;
    days: number;
    ordinaryMin: number;
    extraMin: number;
    remoteDays: number;
    signedAt?: string | null;
  }>;
}): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFontSize(14);
  doc.text(`Registro de jornada · ${input.month}`, 40, 40);
  doc.setFontSize(10);
  let y = 70;
  for (const p of input.personas) {
    if (y > 760) {
      doc.addPage();
      y = 40;
    }
    doc.text(
      `${p.nombre} — ${p.days} días · ordinarias ${formatoDuracion(p.ordinaryMin * 60_000)} · extra ${formatoDuracion(p.extraMin * 60_000)} · teletrabajo ${p.remoteDays} · firma ${p.signedAt ? "sí" : "pendiente"}`,
      40,
      y,
      { maxWidth: 520 }
    );
    y += 28;
  }
  return new Uint8Array(doc.output("arraybuffer"));
}

export async function zipInspeccion(input: {
  month: string;
  punchesCsv: string;
  auditCsv: string;
  pdfBytes: Uint8Array;
}): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file(`fichajes_${input.month}.csv`, input.punchesCsv);
  zip.file(`log_cambios_${input.month}.csv`, input.auditCsv);
  zip.file(`registro_jornada_${input.month}.pdf`, input.pdfBytes);
  const buf = await zip.generateAsync({ type: "uint8array" });
  return buf;
}

export function resumenDiaLinea(punches: Punch[], nowIso: string): string {
  const r = replayDia(punches, nowIso);
  const parts = r.events.map((e) => {
    const h = new Date(e.at).toLocaleTimeString("es-ES", {
      timeZone: "Europe/Madrid",
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${h} ${etiquetaPunch(e.type)}`;
  });
  return `${formatoDuracion(r.effectiveMs)} · ${parts.join(" · ")}`;
}
