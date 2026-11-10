/**
 * Tras una pasada completa: anuncios activos de la zona no vistos en esta pasada
 * y con visto_en anterior al inicio de la recogida → candidatos a retirada
 * (rezagados que el merge con la pasada anterior podía dejar vivos).
 */
export function idsRezagadosParaRetirar(
  anuncios: Array<{
    id: string;
    externo_id: string;
    desaparecido_en?: string | null;
    fase?: string;
    visto_en?: string | null;
    anunciante?: string | null;
  }>,
  vistosEstaPasada: Set<string>,
  iniciadaIso: string,
  opciones?: { soloParticularesNovedad?: boolean }
): string[] {
  const inicio = new Date(iniciadaIso).getTime();
  if (!Number.isFinite(inicio)) return [];
  const fases = new Set(["novedad", "contacto", "visita", "negociando"]);
  const soloPartNovedad = opciones?.soloParticularesNovedad === true;
  const out: string[] = [];
  for (const a of anuncios) {
    if (a.desaparecido_en) continue;
    if (a.fase && !fases.has(a.fase)) continue;
    if (vistosEstaPasada.has(a.externo_id)) continue;
    if (soloPartNovedad) {
      if (a.anunciante !== "particular" || a.fase !== "novedad") continue;
    }
    const visto = a.visto_en ? new Date(a.visto_en).getTime() : NaN;
    if (!Number.isFinite(visto) || visto >= inicio) continue;
    out.push(a.id);
  }
  return out;
}
