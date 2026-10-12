export type CandidatoCarto = {
  address: string;
  lat: number;
  lng: number;
  postcode: string | null;
  municipality: string | null;
  province: string | null;
  muniCode?: string;
};

export type ContextoGeocoder = {
  /** Nombres de municipio de la agencia (ej. A Coruña). */
  municipalityNames: string[];
  /** Códigos INE (ej. 15030). */
  municipalityCodes: string[];
  /** Provincia por defecto (15 = A Coruña). */
  provinceCode?: string;
};

type RawCarto = {
  address?: string;
  lat?: number;
  lng?: number;
  postalCode?: string;
  municipality?: string;
  muni?: string;
  muniCode?: string;
  province?: string;
  provinceCode?: string;
};

export function parseCartoRow(c: RawCarto): CandidatoCarto | null {
  if (typeof c.lat !== "number" || typeof c.lng !== "number") return null;
  const address = c.address ?? "";
  const postcode = c.postalCode ?? extraerCp(address);
  const municipality = c.municipality ?? c.muni ?? extraerMunicipio(address);
  const province =
    c.provinceCode ??
    (c.province && /^\d{2}$/.test(c.province) ? c.province : null) ??
    (postcode ? postcode.slice(0, 2) : null);
  return {
    address,
    lat: c.lat,
    lng: c.lng,
    postcode,
    municipality,
    province,
    ...(c.muniCode ? { muniCode: c.muniCode } : {}),
  };
}

function extraerCp(address: string): string | null {
  const m = address.match(/\b(\d{5})\b/);
  return m ? m[1] : null;
}

function extraerMunicipio(address: string): string | null {
  const m = address.match(/\(([^)]+)\)\s*$/);
  if (m) return m[1].trim();
  const parts = address.split(",").map((p) => p.trim());
  return parts.length >= 2 ? parts[parts.length - 1] : null;
}

function normaliza(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

function pareceMunicipioAgencia(c: CandidatoCarto, ctx: ContextoGeocoder): boolean {
  const muniCode = c.muniCode;
  if (muniCode && ctx.municipalityCodes.some((code) => muniCode === code || muniCode.startsWith(code))) return true;
  const muni = normaliza(c.municipality ?? "");
  for (const n of ctx.municipalityNames) {
    if (muni.includes(normaliza(n))) return true;
  }
  if (c.postcode && ctx.provinceCode && c.postcode.startsWith(ctx.provinceCode)) {
    if (ctx.municipalityCodes.some((code) => c.postcode!.startsWith(code.slice(0, 2)))) return true;
  }
  const addr = normaliza(c.address);
  for (const n of ctx.municipalityNames) {
    if (addr.includes(normaliza(n))) return true;
  }
  return false;
}

function pareceProvinciaAgencia(c: CandidatoCarto, ctx: ContextoGeocoder): boolean {
  if (!ctx.provinceCode) return false;
  if (c.province === ctx.provinceCode) return true;
  if (c.postcode?.startsWith(ctx.provinceCode)) return true;
  return false;
}

function relevanciaConsulta(q: string, c: CandidatoCarto): number {
  const nq = normaliza(q);
  const na = normaliza(c.address);
  let s = 0;
  if (/montserra/i.test(q)) {
    if (na.includes("montserrat")) s += 100;
    if (na.includes("montseny") || na.includes("montero")) s -= 35;
  }
  const tokens = nq.split(/\s+/).filter((t) => t.length > 2 && !/^\d+$/.test(t));
  for (const t of tokens) {
    if (na.includes(t)) s += 8;
  }
  const num = q.match(/\b\d+[a-zA-Z]?\b/)?.[0];
  if (num) {
    const re = new RegExp(`\\b${num.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    if (re.test(c.address)) s += 15;
  }
  return s;
}

/** Reordena: municipio agencia → provincia agencia → resto; dentro del mismo tier, por similitud con la consulta. */
export function reordenarCandidatos(candidatos: CandidatoCarto[], ctx: ContextoGeocoder, q = ""): CandidatoCarto[] {
  const tier = (c: CandidatoCarto) => {
    if (pareceMunicipioAgencia(c, ctx)) return 0;
    if (pareceProvinciaAgencia(c, ctx)) return 1;
    return 2;
  };
  return [...candidatos].sort((a, b) => {
    const d = tier(a) - tier(b);
    if (d !== 0) return d;
    return relevanciaConsulta(q, b) - relevanciaConsulta(q, a);
  });
}

function variantesMontserrat(base: string, hint: string | null): string[] {
  if (!/montserra/i.test(base)) return [];
  const out: string[] = [];
  const conT = base.replace(/montserra(?![t])/gi, "montserrat");
  if (conT !== base) {
    out.push(conT);
    if (hint) out.push(`${conT} ${hint}`);
  }
  const num = base.match(/\b\d+[a-zA-Z]?\b/)?.[0];
  if (num && hint && !/^(avenida|avinguda|av\.?\s)/i.test(base)) {
    out.push(`avenida montserrat ${num} ${hint}`);
    out.push(`montserrat ${num} ${hint}`);
  }
  return out;
}

export function consultasGeocoder(q: string, municipalityHint: string | null): string[] {
  const base = q.trim();
  const out = new Set<string>();
  if (!base) return [];
  out.add(base);
  if (municipalityHint && !normaliza(base).includes(normaliza(municipalityHint))) {
    out.add(`${base} ${municipalityHint}`);
  }
  for (const v of variantesMontserrat(base, municipalityHint)) out.add(v);
  const words = base.split(/\s+/).filter(Boolean);
  if (words.length > 2) out.add(words.slice(0, -1).join(" "));
  return [...out];
}

export function urlCandidates(q: string, limit: number): string {
  return `https://www.cartociudad.es/geocoder/api/geocoder/candidates?limit=${limit}&autocancel=true&q=${encodeURIComponent(q)}`;
}

export async function fetchCartoCandidates(
  q: string,
  ctx: ContextoGeocoder,
  fetchFn: typeof fetch = fetch,
): Promise<CandidatoCarto[]> {
  const hint = ctx.municipalityNames[0] ?? null;
  const queries = consultasGeocoder(q, hint);
  const seen = new Set<string>();
  const rows: CandidatoCarto[] = [];
  for (const query of queries) {
    const res = await fetchFn(urlCandidates(query, 25), { signal: AbortSignal.timeout(5000) });
    if (!res.ok) continue;
    const json = (await res.json()) as unknown;
    const data = (Array.isArray(json) ? json : []) as RawCarto[];
    for (const raw of data) {
      const c = parseCartoRow(raw);
      if (!c) continue;
      const key = `${c.lat.toFixed(5)}:${c.lng.toFixed(5)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(c);
    }
  }
  return reordenarCandidatos(rows, ctx, q).slice(0, 25);
}
