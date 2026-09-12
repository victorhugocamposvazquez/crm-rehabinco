import { INSPIRE_AD_MAX_FEATURES } from "./constants";
import { getFincaReference } from "./references";

export type DireccionInspire = {
  numero: string;
  codigoPostal: string | null;
  referenciaParcela: string | null;
};

const RC_PARCELA = /\b(\d{7}[A-Z0-9]{7})\b/;

/**
 * Extrae solo campos presentes en la respuesta WFS AD oficial:
 * locator designator, componente de código postal y localId.
 */
export function parsearDireccionesInspire(gml: string): {
  direcciones: DireccionInspire[];
  posibleCorte: boolean;
} {
  const miembros = gml.split(/<gml:featureMember>/i).slice(1);
  const direcciones: DireccionInspire[] = [];

  for (const miembro of miembros) {
    const locator = miembro.match(
      /<ad:LocatorDesignator>[\s\S]*?<ad:designator>([^<]*)<\/ad:designator>/i
    );
    const numero = locator?.[1]?.trim();
    if (!numero) continue;

    const postal = miembro.match(/#ES\.SDGC\.PD\.[^.]+\.[^.]+\.(\d+)/);
    const localId = miembro.match(/<base:localId>([^<]+)<\/base:localId>/i);
    const parcela = getFincaReference(localId?.[1]?.match(RC_PARCELA)?.[1]);

    direcciones.push({
      numero,
      codigoPostal: postal?.[1] ?? null,
      referenciaParcela: parcela,
    });
  }

  const unicas = new Map<string, DireccionInspire>();
  for (const item of direcciones) {
    const clave = `${item.numero}|${item.referenciaParcela ?? ""}`;
    if (!unicas.has(clave)) unicas.set(clave, item);
  }

  return {
    direcciones: [...unicas.values()],
    posibleCorte: hayCorteWfs(gml, direcciones.length),
  };
}

/** Señales oficiales de WFS 2.0 / techo documentado de 5000 features. */
export function hayCorteWfs(gml: string, features: number): boolean {
  if (features >= INSPIRE_AD_MAX_FEATURES) return true;
  const attrs = gml.match(/<gml:FeatureCollection\b([^>]*)>/i)?.[1] ?? "";
  if (/\btruncated\s*=\s*["']true["']/i.test(attrs)) return true;
  const matched = Number(attrs.match(/numberMatched\s*=\s*["'](\d+)["']/i)?.[1]);
  const returned = Number(attrs.match(/numberReturned\s*=\s*["'](\d+)["']/i)?.[1]);
  if (Number.isFinite(matched) && Number.isFinite(returned) && matched > returned) {
    return true;
  }
  return false;
}

export function numerosOficiales(direcciones: DireccionInspire[]): string[] {
  return [...new Set(direcciones.map((item) => item.numero))].sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
    return a.localeCompare(b, "es");
  });
}
