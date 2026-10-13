import type { SupabaseClient } from "@supabase/supabase-js";
import type { MarketListingCard, PortalRastreo } from "../market/card";
import { fotocasaTieneMas, parseListingCardsFotocasa, urlListadoFotocasa } from "../market/fotocasa-cards";
import { parseListingCardsHabitaclia, urlListadoHabitaclia } from "../market/habitaclia-cards";
import { portalTieneSlug, slugsDesdePortalMap, slugsSiFaltan } from "../market/portal-urls";
import { parseListingCardsPisos, pisosTieneMas, urlListadoPisos } from "../market/pisos-cards";
import { slugsPortalPorMunicipio } from "./portal-slugs";
import { guardarTarjetas, retirarNoVistos } from "./upsert";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const TOPE_PAGINAS = 60;

export type FiltroRastreo = {
  municipalityCode?: string;
  portal?: PortalRastreo;
  operation?: "sale" | "rent";
  /** Tope de páginas por listado. El cron usa 60. */
  maxPages?: number;
  /** Espera entre páginas. Por defecto 1,5–3 s. */
  pausaMs?: number;
  /** La pasada corta de una valoración no recalcula todas las zonas. */
  skipDerive?: boolean;
};

export type InformePasada = {
  municipalityCode: string;
  portal: PortalRastreo;
  operation: "sale" | "rent";
  pages: number;
  cardsSeen: number;
  cardsUpserted: number;
  cardsExact: number;
  cardsZone: number;
  cardsUnlocated: number;
  error: string | null;
};

type Zona = { lat: number | null; lng: number | null; postcode: string | null; level: string };
type Consulta = {
  kind: string;
  url: (pagina: number) => string;
  parse: (html: string) => { cards: MarketListingCard[]; hasMore: boolean };
};

const PORTALES: PortalRastreo[] = ["fotocasa", "habitaclia", "pisos"];

function esPortal(value: string): value is PortalRastreo {
  return (PORTALES as string[]).includes(value);
}

function consultas(
  portal: PortalRastreo,
  operation: "sale" | "rent",
  municipalityCode: string,
  slugs = slugsDesdePortalMap(new Map()),
): Consulta[] {
  if (portal === "fotocasa") {
    let vistos = 0;
    return [
      {
        kind: "viviendas",
        url: (pagina) => urlListadoFotocasa(operation, pagina, slugs),
        parse: (html) => {
          const page = parseListingCardsFotocasa(html, operation, municipalityCode);
          vistos += page.pageSize;
          return { cards: page.cards, hasMore: fotocasaTieneMas(page.total, vistos, page.pageSize) };
        },
      },
    ];
  }
  if (portal === "habitaclia") {
    return (["viviendas", "casas"] as const).map((kind) => ({
      kind,
      url: (pagina: number) => urlListadoHabitaclia(operation, kind, pagina, slugs),
      parse: (html: string) => {
        const page = parseListingCardsHabitaclia(html, operation, municipalityCode);
        return { cards: page.cards, hasMore: page.hasMore };
      },
    }));
  }
  return (["piso", "casas"] as const).map((kind) => {
    let vistos = 0;
    return {
      kind,
      url: (pagina: number) => urlListadoPisos(operation, kind, pagina, slugs),
      parse: (html: string) => {
        const page = parseListingCardsPisos(html, operation, kind, municipalityCode);
        vistos += page.pageSize;
        return { cards: page.cards, hasMore: pisosTieneMas(page.total, vistos, page.pageSize) };
      },
    };
  });
}

function bloqueado(status: number, html: string): boolean {
  if (status === 403 || status === 429) return true;
  const cabeza = html.slice(0, 4000).toLowerCase();
  return cabeza.includes("datadome") || cabeza.includes("captcha-delivery") || cabeza.includes("attention required");
}

function conZona(cards: MarketListingCard[], zonas: Map<string, Zona>): MarketListingCard[] {
  return cards.map((card) => {
    if (card.lat != null && card.lng != null) return { ...card, locationPrecision: "exact" };
    if (!card.zoneSlug) return { ...card, lat: null, lng: null, locationPrecision: null };
    const zona = zonas.get(`${card.portal}|${card.zoneSlug}`);
    if (!zona || zona.level === "municipality" || zona.lat == null || zona.lng == null) {
      return { ...card, lat: null, lng: null, locationPrecision: null };
    }
    return {
      ...card,
      lat: zona.lat,
      lng: zona.lng,
      locationPrecision: "zone",
      postcode: card.postcode ?? zona.postcode,
    };
  });
}

function pausa(fija?: number): Promise<void> {
  const ms = fija ?? 1500 + Math.floor(Math.random() * 1501);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function bajar(url: string): Promise<{ status: number; html: string }> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "es-ES,es;q=0.9", Accept: "text/html" },
    redirect: "follow",
  });
  return { status: res.status, html: await res.text() };
}

async function centroides(db: SupabaseClient, municipalityCode: string): Promise<Map<string, Zona>> {
  const { data, error } = await db
    .from("market_zones")
    .select("portal, zone_slug, lat, lng, postcode, level")
    .or(`municipality_code.eq.${municipalityCode},level.eq.municipality`);
  if (error) throw new Error(error.message);
  const map = new Map<string, Zona>();
  for (const row of data ?? []) {
    const lat = row.lat == null ? null : Number(row.lat);
    const lng = row.lng == null ? null : Number(row.lng);
    map.set(`${row.portal}|${row.zone_slug}`, {
      lat: lat != null && Number.isFinite(lat) ? lat : null,
      lng: lng != null && Number.isFinite(lng) ? lng : null,
      postcode: row.postcode ?? null,
      level: String(row.level ?? "zone"),
    });
  }
  return map;
}

async function abrirRun(db: SupabaseClient, municipalityCode: string, portal: string, operation: string): Promise<string> {
  const { data, error } = await db
    .from("market_crawl_runs")
    .insert({ municipality_code: municipalityCode, portal, operation, pages: 0, cards_seen: 0, cards_upserted: 0, cards_exact: 0, cards_zone: 0 })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Sin fila de pasada");
  return String(data.id);
}

async function cerrarRun(
  db: SupabaseClient,
  id: string,
  patch: { pages: number; cards_seen: number; cards_upserted: number; cards_exact: number; cards_zone: number; error: string | null }
): Promise<void> {
  const { error } = await db
    .from("market_crawl_runs")
    .update({ ...patch, finished_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function rastrearMercado(
  db: SupabaseClient,
  filtro: FiltroRastreo = {},
  onPage?: (linea: string) => void
): Promise<InformePasada[]> {
  const hoy = new Date().toISOString().slice(0, 10);
  const tope = Math.min(TOPE_PAGINAS, Math.max(1, filtro.maxPages ?? TOPE_PAGINAS));
  let consulta = db.from("market_crawl_targets").select("municipality_code, portals, operations").eq("active", true);
  if (filtro.municipalityCode) consulta = consulta.eq("municipality_code", filtro.municipalityCode);
  const { data: targets, error } = await consulta;
  if (error) throw new Error(error.message);

  const informes: InformePasada[] = [];
  for (const target of targets ?? []) {
    const municipalityCode = String(target.municipality_code);
    const portalSlugs = slugsSiFaltan(municipalityCode, slugsDesdePortalMap(await slugsPortalPorMunicipio(db, municipalityCode)));
    const zonas = await centroides(db, municipalityCode);
    const portales = (target.portals as string[]).filter(esPortal).filter((p) => !filtro.portal || p === filtro.portal);
    const operations = ((target.operations as string[]) ?? ["sale", "rent"]).filter(
      (op): op is "sale" | "rent" => (op === "sale" || op === "rent") && (!filtro.operation || op === filtro.operation)
    );
    const bloqueados = new Set<PortalRastreo>();
    const completos = new Map<PortalRastreo, boolean>();

    for (const portal of portales) {
      if (!portalTieneSlug(portal, portalSlugs)) {
        informes.push({
          municipalityCode,
          portal,
          operation: operations[0] ?? "sale",
          pages: 0,
          cardsSeen: 0,
          cardsUpserted: 0,
          cardsExact: 0,
          cardsZone: 0,
          cardsUnlocated: 0,
          error: "Sin slug del portal para este municipio",
        });
        continue;
      }
      let portalOk = true;
      for (const operation of operations) {
        const runId = await abrirRun(db, municipalityCode, portal, operation);
        const vistos = new Set<string>();
        let pages = 0;
        let cardsExact = 0;
        let cardsZone = 0;
        let cardsUnlocated = 0;
        let cardsUpserted = 0;
        let recortado = false;
        let fallo: string | null = bloqueados.has(portal) ? "Portal parado por bloqueo" : null;

        if (!fallo) {
          for (const consultaPortal of consultas(portal, operation, municipalityCode, portalSlugs)) {
            if (fallo || pages >= tope) break;
            for (let pagina = 1; pagina <= tope && pages < tope; pagina += 1) {
              if (pagina > 1 || pages > 0) await pausa(filtro.pausaMs);
              let status = 0;
              let html = "";
              try {
                const bajada = await bajar(consultaPortal.url(pagina));
                status = bajada.status;
                html = bajada.html;
              } catch (err) {
                fallo = err instanceof Error ? err.message : "No se pudo descargar el listado";
                break;
              }
              if (bloqueado(status, html)) {
                fallo = status === 429 ? "429" : status === 403 ? "403" : "captcha";
                bloqueados.add(portal);
                break;
              }
              const page = consultaPortal.parse(html);
              pages += 1;
              const cards = conZona(page.cards, zonas);
              const nuevas = cards.filter((card) => {
                if (vistos.has(card.portalId)) return false;
                vistos.add(card.portalId);
                if (card.locationPrecision === "exact") cardsExact += 1;
                else if (card.locationPrecision === "zone") cardsZone += 1;
                else cardsUnlocated += 1;
                return true;
              });
              cardsUpserted += await guardarTarjetas(db, nuevas, hoy);
              onPage?.(`${portal} ${operation} ${consultaPortal.kind} p${pagina} ${nuevas.length}`);
              if (page.cards.length === 0 || !page.hasMore) break;
              if (pages >= tope) recortado = true;
            }
          }
          if (!fallo && recortado && tope >= TOPE_PAGINAS) fallo = "Tope de 60 páginas";
        }
        if (fallo) portalOk = false;
        await cerrarRun(db, runId, {
          pages,
          cards_seen: vistos.size,
          cards_upserted: cardsUpserted,
          cards_exact: cardsExact,
          cards_zone: cardsZone,
          error: fallo,
        });
        informes.push({
          municipalityCode,
          portal,
          operation,
          pages,
          cardsSeen: vistos.size,
          cardsUpserted,
          cardsExact,
          cardsZone,
          cardsUnlocated,
          error: fallo,
        });
      }
      completos.set(portal, portalOk);
    }

    for (const [portal, ok] of completos) {
      if (ok) await retirarNoVistos(db, portal, municipalityCode, hoy);
    }
    const { error: marca } = await db.from("market_crawl_targets").update({ last_run: new Date().toISOString() }).eq("municipality_code", municipalityCode);
    if (marca) throw new Error(marca.message);
  }
  if (!filtro.skipDerive) {
    const derivado = await db.rpc("market_zones_derive");
    if (derivado.error) throw new Error(derivado.error.message);
  }
  return informes;
}
