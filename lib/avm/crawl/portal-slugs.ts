import type { SupabaseClient } from "@supabase/supabase-js";
import { ineProvinciaDeMunicipio, provinciaCatastroPorCodigo } from "../../catastro/provincias-espana";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

export type PortalSlugRow = {
  portal: string;
  ine_code: string;
  slug: string | null;
  url_base: string | null;
  status: "pending" | "resolved" | "manual" | "failed";
  notes: string | null;
};

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function probe(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": UA, "Accept-Language": "es-ES,es;q=0.9" },
      signal: AbortSignal.timeout(12_000),
    });
    if (res.status !== 200) return false;
    const html = await res.text();
    return html.length > 5000 && !/captcha|datadome/i.test(html.slice(0, 4000));
  } catch {
    return false;
  }
}

function candidatosFotocasa(nameCatastro: string, nameIne: string | null): string[] {
  const base = slugify(nameIne ?? nameCatastro);
  const out = new Set<string>();
  out.add(`${base}-capital`);
  out.add(base);
  if (/^a /i.test(nameCatastro)) out.add(`${slugify(nameCatastro.replace(/^a\s+/i, ""))}-capital`);
  return [...out];
}

/** Nombre que escribe el usuario o CartoCiudad: primero el municipio, luego «-capital». */
export function candidatosFotocasaDeNombre(nombre: string): string[] {
  const base = slugify(nombre);
  if (!base || /^\d+$/.test(base)) return [];
  return [base, `${base}-capital`];
}

function candidatosHabitaclia(provSlug: string, muniSlug: string, capitalPrimero = true): string[] {
  const pueblo = `${provSlug}-provincia/${muniSlug}`;
  const capital = `${pueblo}-capital`;
  return capitalPrimero ? [capital, pueblo] : [pueblo, capital];
}

function candidatosPisos(muniSlug: string): string[] {
  const u = muniSlug.replace(/-/g, "_");
  return [`${u}_capital`, u];
}

export async function resolverSlugsPortal(
  db: SupabaseClient,
  ineCode: string,
  nombreLibre?: string | null,
): Promise<PortalSlugRow[]> {
  const { data: muni, error: eM } = await db
    .from("catastro_municipios")
    .select("ine_code, name_catastro, name_ine, province_name")
    .eq("ine_code", ineCode)
    .maybeSingle();
  if (eM) throw new Error(eM.message);

  const nameCatastro = String(muni?.name_catastro ?? nombreLibre ?? ineCode);
  const nameIne = muni?.name_ine == null ? null : String(muni.name_ine);
  const provSlug = slugify(
    String(muni?.province_name ?? provinciaCatastroPorCodigo(ineProvinciaDeMunicipio(ineCode)) ?? "espana"),
  );
  const muniSlug = slugify(nameIne ?? nameCatastro);
  const porNombre = !muni && candidatosFotocasaDeNombre(nombreLibre ?? "").length > 0;

  const portales: PortalSlugRow[] = [];

  for (const portal of ["fotocasa", "habitaclia", "pisos"] as const) {
    let slug: string | null = null;
    let url_base: string | null = null;
    let status: PortalSlugRow["status"] = "manual";
    let notes: string | null = "Sin nombre de municipio; rellenar slug a mano.";

    if (muni || porNombre) {
      notes = null;
      status = "failed";
      const tries =
        portal === "fotocasa"
          ? porNombre
            ? candidatosFotocasaDeNombre(nombreLibre ?? nameCatastro)
            : candidatosFotocasa(nameCatastro, nameIne)
          : portal === "habitaclia"
            ? candidatosHabitaclia(provSlug, muniSlug, !porNombre)
            : candidatosPisos(muniSlug);

      for (const t of tries) {
        const url =
          portal === "fotocasa"
            ? `https://www.fotocasa.es/es/comprar/viviendas/${t}/todas-las-zonas/l`
            : portal === "habitaclia"
              ? `https://www.habitaclia.com/comprar/viviendas/${t}/s`
              : `https://www.pisos.com/venta/pisos-${t}/asc/`;
        if (await probe(url)) {
          slug = t;
          url_base = url;
          status = "resolved";
          break;
        }
      }
      if (!slug) {
        status = "manual";
        notes = `Probar slugs: ${tries.join(", ")}`;
      }
    }

    const row: PortalSlugRow = { portal, ine_code: ineCode, slug, url_base, status, notes };
    portales.push(row);
    const { error } = await db.from("portal_municipalities").upsert(
      {
        portal,
        ine_code: ineCode,
        slug,
        url_base,
        status,
        notes,
        resolved_at: status === "resolved" ? new Date().toISOString() : null,
      },
      { onConflict: "portal,ine_code" },
    );
    if (error) throw new Error(error.message);
  }

  return portales;
}

export async function slugsPortalPorMunicipio(
  db: SupabaseClient,
  ineCode: string,
): Promise<Map<string, { slug: string; url_base: string | null }>> {
  const { data, error } = await db.from("portal_municipalities").select("portal, slug, url_base, status").eq("ine_code", ineCode);
  if (error) throw new Error(error.message);
  const map = new Map<string, { slug: string; url_base: string | null }>();
  for (const row of data ?? []) {
    if (row.status === "resolved" && row.slug) {
      map.set(String(row.portal), { slug: String(row.slug), url_base: row.url_base == null ? null : String(row.url_base) });
    }
  }
  return map;
}
