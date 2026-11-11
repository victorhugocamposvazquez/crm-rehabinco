import crypto from "node:crypto";

/**
 * Candado 1: Rutas críticas que JAMÁS pueden auto-fusionarse sin aprobación humana en 1 clic.
 */
export const SUPPORT_PROTECTED_PATH_PATTERNS: readonly RegExp[] = [
  /^supabase\/migrations\//i,
  /^middleware\.ts$/i,
  /^lib\/auth\//i,
  /^lib\/supabase\//i,
  /^lib\/support\//i,
  /^app\/api\/support\//i,
  /^app\/api\/facturas\//i,
  /^app\/\(dashboard\)\/facturas\//i,
  /^app\/\(dashboard\)\/settings\/roles\//i,
  /^app\/\(dashboard\)\/settings\/papelera\//i,
  /^app\/\(dashboard\)\/settings\/soporte\//i,
  /^\.github\//i,
  /^vercel\.(json|ts)$/i,
  /^package(-lock)?\.json$/i,
  /^next\.config\./i,
  /\.env/i,
];

export const SUPPORT_MAX_AUTOMERGE_FILES = 4;
export const SUPPORT_MAX_AUTOMERGE_LINES = 120;

export type DiffEvaluationInput = {
  files: string[];
  additions: number;
  deletions: number;
};

export type DiffEvaluationResult = {
  allowed: boolean;
  reasons: string[];
  protectedFiles: string[];
  totalLines: number;
};

export function esRutaProtegidaSoporte(filePath: string): boolean {
  const normalizada = filePath.trim().replace(/^\/+/, "").replace(/\\/g, "/");
  if (!normalizada || normalizada.includes("..")) return true;
  return SUPPORT_PROTECTED_PATH_PATTERNS.some((re) => re.test(normalizada));
}

export function evaluarCandadosDiff(input: DiffEvaluationInput): DiffEvaluationResult {
  const reasons: string[] = [];
  const files = input.files.map((f) => f.trim()).filter(Boolean);
  const protectedFiles = files.filter(esRutaProtegidaSoporte);
  const totalLines = Math.max(0, input.additions) + Math.max(0, input.deletions);

  if (files.length === 0) {
    reasons.push("El PR no contiene archivos modificados.");
  }
  if (protectedFiles.length > 0) {
    reasons.push(`Toca rutas protegidas que requieren validación humana: ${protectedFiles.join(", ")}`);
  }
  if (files.length > SUPPORT_MAX_AUTOMERGE_FILES) {
    reasons.push(`Modifica ${files.length} archivos (máximo automático: ${SUPPORT_MAX_AUTOMERGE_FILES}).`);
  }
  if (totalLines > SUPPORT_MAX_AUTOMERGE_LINES) {
    reasons.push(`Modifica ${totalLines} líneas en total (máximo automático: ${SUPPORT_MAX_AUTOMERGE_LINES}).`);
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    protectedFiles,
    totalLines,
  };
}

export function extraerTicketIdDeTexto(texto: string | null | undefined): string | null {
  if (!texto) return null;
  const match = texto.match(/Ticket-ID:\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  return match?.[1]?.toLowerCase() ?? null;
}

export function sanitizarTextoNoConfiable(texto: string, maxChars = 4000): string {
  const limpio = (texto || "")
    .replace(/<\/?untrusted_ticket>/gi, "[etiqueta_filtrada]")
    .replace(/\u0000/g, "")
    .trim();
  return limpio.length > maxChars ? `${limpio.slice(0, maxChars)}\n[…recortado]` : limpio;
}

export function firmarPayloadHmac(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

export function verificarFirmaHmac(payload: string, signatureHex: string | null | undefined, secret: string): boolean {
  if (!signatureHex || !secret) return false;
  const limpia = signatureHex.trim().replace(/^sha256=/i, "");
  if (!/^[0-9a-f]{64}$/i.test(limpia)) return false;
  const esperada = firmarPayloadHmac(payload, secret);
  try {
    return crypto.timingSafeEqual(Buffer.from(limpia, "hex"), Buffer.from(esperada, "hex"));
  } catch {
    return false;
  }
}
