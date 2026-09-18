import { telefonoE164 } from "@/lib/captacion/contacto";
import type { AnunciantePortal } from "@/lib/captacion/portales/modelo";

const TIPOS = new Set([
  "piso",
  "casa",
  "chalet",
  "atico",
  "duplex",
  "local",
  "oficina",
  "garaje",
  "trastero",
  "terreno",
  "nave",
  "otro",
]);

export function normalizarPrecio(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export function normalizarM2(v: unknown): number | null {
  const n = normalizarPrecio(v);
  return n;
}

export function normalizarTipo(raw: string | null | undefined): string | null {
  const t = (raw ?? "").toLowerCase().trim();
  if (!t) return null;
  if (TIPOS.has(t)) return t;
  if (t.includes("piso") || t.includes("flat")) return "piso";
  if (t.includes("casa") || t.includes("chalet")) return "casa";
  if (t.includes("ático") || t.includes("atico")) return "atico";
  if (t.includes("local")) return "local";
  if (t.includes("garaje")) return "garaje";
  if (t.includes("terreno") || t.includes("solar")) return "terreno";
  return "otro";
}

export function normalizarOperacion(raw: string | null | undefined): "venta" | "alquiler" {
  const t = (raw ?? "").toLowerCase();
  return t.includes("alquil") || t === "rent" ? "alquiler" : "venta";
}

export function normalizarAnunciante(raw: string | null | undefined): AnunciantePortal {
  const t = (raw ?? "").toLowerCase();
  if (t === "particular" || t === "private") return "particular";
  if (t === "profesional" || t === "professional" || t === "empresa" || t === "agency") return "empresa";
  if (t === "banco" || t === "bank") return "banco";
  return "desconocido";
}

const ENTIDADES_HTML: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Convierte entidades HTML (`&#xF3;`, `&#243;`, `&amp;`) a Unicode. */
export function decodificarEntidadesHtml(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  if (!raw.includes("&")) return raw;

  return raw
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const cp = parseInt(hex, 16);
      try {
        return String.fromCodePoint(cp);
      } catch {
        return `&#x${hex};`;
      }
    })
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const cp = parseInt(dec, 10);
      try {
        return String.fromCodePoint(cp);
      } catch {
        return `&#${dec};`;
      }
    })
    .replace(/&([a-z]+);/gi, (full, name: string) => ENTIDADES_HTML[name.toLowerCase()] ?? full);
}

export function normalizarTexto(raw: string | null | undefined): string | null {
  const t = decodificarEntidadesHtml(raw)?.trim();
  return t ? t : null;
}

export function normalizarMunicipio(raw: string | null | undefined): string | null {
  return normalizarTexto(raw);
}

export function normalizarTelefono(raw: string | null | undefined): string | null {
  return telefonoE164(raw);
}
