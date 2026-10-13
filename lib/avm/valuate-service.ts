import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { buildTwin, type PropertySource, type TwinBuild, type TwinUnit } from "./twin-builder";
import type { Channel, Comparable, Operation, Twin, ZoneLevel, ZoneStats } from "./types";
import { environmentFromAvmRpc } from "./environment-from-rpc";
import { publicView, valuate, type ValuateDeps, type ValuateOptions } from "./valuate";

const TENANT = "00000000-0000-4000-8000-000000000001";

export const solicitudValoracion = z.object({
  input: z.object({
    twin: z.custom<Twin>().optional(),
    fieldSources: z.record(z.string()).optional(),
    prefilledFields: z.array(z.string()).optional(),
    propertySource: z.enum(["catastro_local", "catastro_sede", "listing", "crm", "manual"]).optional(),
    geocodingSource: z.enum(["google", "cartociudad", "postcode_centroid", "pin", "listing", "catastro", "missing"]).optional(),
    warnings: z.array(z.string()).optional(),
    address: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    catastralRef: z.string().optional(),
    listingId: z.string().optional(),
    crmPropertyId: z.string().optional(),
  }),
  channel: z.enum(["crm", "landing"]),
  operation: z.enum(["sale", "rent"]).optional(),
  landingSlug: z.string().optional(),
});

export type SolicitudValoracion = z.infer<typeof solicitudValoracion>;

export type RespuestaValoracion =
  | { status: 200; body: { valuationId: string; result: unknown } }
  | { status: 401; body: { error: string } }
  | { status: 404; body: { error: string } }
  | { status: 409; body: { units: TwinUnit[] } }
  | { status: 429; body: { error: string } };

type Ctx = {
  admin: SupabaseClient;
  userDb?: SupabaseClient;
  userId?: string | null;
  tenantId?: string;
  ip?: string | null;
  construir?: (input: SolicitudValoracion["input"], tenantId: string) => Promise<TwinBuild>;
};

function fila(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) return (data[0] as Record<string, unknown>) ?? null;
  return (data as Record<string, unknown>) ?? null;
}

function numero(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function etiqueta(locality: string | null, level: string, key: string): string {
  const lugar = locality || "A Coruña";
  if (level === "postcode") return `${lugar} · CP ${key}`;
  if (level === "census_section") return `${lugar} · sección ${key}`;
  return `${lugar} · municipio ${key}`;
}

export function depsMercado(db: SupabaseClient): ValuateDeps {
  async function comparablesDe(twin: Twin, op: Operation): Promise<Comparable[]> {
    const lat = twin.address.lat;
    const lng = twin.address.lng;
    const surface = twin.builtSurface ?? twin.livingSurface;
    if (lat == null || lng == null || !twin.mainType || !surface) return [];
    const { data, error } = await db.rpc("avm_comparables", {
      p_lat: lat,
      p_lng: lng,
      p_main_type: twin.mainType,
      p_surface: surface,
      p_operation: op,
    });
    if (error) throw new Error(error.message);
    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      listingId: String(row.listing_id),
      portal: String(row.portal),
      title: row.title == null ? null : String(row.title),
      price: Number(row.price),
      surface: Number(row.surface),
      pricePerM2: Number(row.price_per_m2),
      rooms: numero(row.rooms),
      floor: numero(row.floor),
      hasElevator: row.has_elevator == null ? null : Boolean(row.has_elevator),
      hasGarage: row.has_garage == null ? null : Boolean(row.has_garage),
      hasTerrace: row.has_terrace == null ? null : Boolean(row.has_terrace),
      isExterior: row.is_exterior == null ? null : Boolean(row.is_exterior),
      conditionHint: row.condition_hint == null ? null : String(row.condition_hint),
      lastSeen: String(row.last_seen).slice(0, 10),
      distanceM: Number(row.distance_m),
      radiusM: Number(row.radius_m),
    }));
  }

  return {
    async zoneStats(twin, op) {
      const lat = twin.address.lat;
      const lng = twin.address.lng;
      if (lat == null || lng == null || !twin.mainType) return null;
      const { data, error } = await db.rpc("avm_zone_median", {
        p_lat: lat,
        p_lng: lng,
        p_main_type: twin.mainType,
        p_operation: op,
      });
      if (error) throw new Error(error.message);
      const row = fila(data);
      if (!row?.zone_key) return null;
      const level = String(row.zone_level) as ZoneLevel;
      return {
        zoneLevel: level,
        zoneKey: String(row.zone_key),
        label: etiqueta(twin.address.locality, level, String(row.zone_key)),
        month: String(row.month).slice(0, 10),
        n: Number(row.n),
        medianPpm2: Number(row.median_ppm2),
        p25Ppm2: numero(row.p25_ppm2),
        p75Ppm2: numero(row.p75_ppm2),
        trend12mPct: numero(row.trend_12m_pct),
        source: "market_listings",
      } satisfies ZoneStats;
    },
    zoneStatsFallback: async () => null,
    comparables: comparablesDe,
    rentComparables: (twin) => comparablesDe(twin, "rent"),
    async discountPct(twin) {
      if (!twin.address.municipalityCode || !twin.mainType) return null;
      const { data } = await db
        .from("market_discount")
        .select("discount_pct")
        .eq("zone_level", "municipality")
        .eq("zone_key", twin.address.municipalityCode)
        .eq("main_type", twin.mainType)
        .maybeSingle();
      return data?.discount_pct == null ? null : Number(data.discount_pct);
    },
    async grossYieldPct(twin) {
      if (twin.address.lat == null || twin.address.lng == null || !twin.mainType) return null;
      const { data: zona, error } = await db.rpc("avm_zone_median", {
        p_lat: twin.address.lat,
        p_lng: twin.address.lng,
        p_main_type: twin.mainType,
        p_operation: "sale",
      });
      if (error) throw new Error(error.message);
      const nivel = fila(zona);
      if (!nivel?.zone_key) return null;
      const { data } = await db
        .from("market_zone_trend")
        .select("operation, month, median_ppm2")
        .eq("zone_level", nivel.zone_level)
        .eq("zone_key", nivel.zone_key)
        .eq("main_type", twin.mainType)
        .in("operation", ["sale", "rent"])
        .order("month", { ascending: false });
      const porMes = new Map<string, { sale?: number; rent?: number }>();
      for (const row of data ?? []) {
        const mes = String(row.month);
        const slot = porMes.get(mes) ?? {};
        if (row.operation === "sale") slot.sale = Number(row.median_ppm2);
        if (row.operation === "rent") slot.rent = Number(row.median_ppm2);
        porMes.set(mes, slot);
      }
      for (const slot of porMes.values()) {
        if (slot.sale && slot.rent) return (slot.rent * 12 / slot.sale) * 100;
      }
      return null;
    },
    environment: async (twin) => {
      const lat = twin.address.lat;
      const lng = twin.address.lng;
      if (lat == null || lng == null) return null;
      const { data, error } = await db.rpc("avm_environment", {
        p_lat: lat,
        p_lng: lng,
        p_census_section: twin.address.censusSection ?? null,
        p_municipality_code: twin.address.municipalityCode ?? null,
      });
      if (error) throw new Error(error.message);
      return environmentFromAvmRpc(data);
    },
  };
}

function fuenteMotor(source: PropertySource): ValuateOptions["propertySource"] {
  if (source === "catastro_local") return "catastro_local";
  if (source === "catastro_sede") return "catastro_sede";
  if (source === "listing" || source === "crm") return "listing";
  return "manual";
}

function fuenteTabla(source: PropertySource, channel: Channel): string {
  if (source === "catastro_local" || source === "catastro_sede") return "catastro";
  if (source === "listing") return "listing";
  if (source === "crm") return "crm_property";
  return channel === "landing" ? "landing" : "manual";
}

function refUnidad(ref: string | null | undefined): string | null {
  const limpia = ref?.replace(/\s/g, "") ?? "";
  return limpia.length === 20 ? limpia : null;
}

async function guardar(
  db: SupabaseClient,
  tenantId: string,
  built: TwinBuild,
  result: Awaited<ReturnType<typeof valuate>>,
  channel: Channel,
  operation: Operation,
  userId: string | null,
  listingId: string | undefined,
  crmPropertyId: string | undefined
): Promise<string> {
  const twin = built.twin;
  const ref = refUnidad(twin.address.catastralRef);
  const parcela = (twin.address.catastralRef ?? "").replace(/\s/g, "");
  const filaProp = {
    tenant_id: tenantId,
    source: fuenteTabla(built.propertySource, channel),
    crm_property_id: crmPropertyId ?? null,
    listing_id: listingId ?? null,
    catastral_ref: ref,
    catastral_parcel: parcela.length >= 14 ? parcela.slice(0, 14) : null,
    formatted_address: twin.address.formattedAddress,
    route: twin.address.route,
    street_number: twin.address.streetNumber,
    postcode: twin.address.postcode,
    locality: twin.address.locality,
    municipality_code: twin.address.municipalityCode,
    census_section: twin.address.censusSection,
    province: twin.address.province,
    lat: twin.address.lat,
    lng: twin.address.lng,
    main_type: twin.mainType,
    property_type: twin.propertyType,
    floor_of_flat: twin.floorOfFlat,
    number_of_floors: twin.numberOfFloors,
    has_elevator: twin.hasElevator,
    built_surface: twin.builtSurface,
    living_surface: twin.livingSurface,
    land_surface: twin.landSurface,
    balcony_surface: twin.balconySurface,
    garden_surface: twin.gardenSurface,
    construction_year: twin.constructionYear,
    renovation_year: twin.renovationYear,
    is_renovated: twin.isRenovated,
    building_condition: twin.buildingCondition,
    number_of_rooms: twin.numberOfRooms,
    number_of_bedrooms: twin.numberOfBedrooms,
    number_of_bathrooms: twin.numberOfBathrooms,
    number_of_indoor_parkings: twin.numberOfIndoorParkings,
    number_of_outdoor_parkings: twin.numberOfOutdoorParkings,
    has_view: twin.hasView,
    has_swimming_pool: twin.hasSwimmingPool,
    has_balcony: twin.hasBalcony,
    has_garden: twin.hasGarden,
    has_storage_room: twin.hasStorageRoom,
    has_fireplace: twin.hasFireplace,
    created_by: userId,
  };
  const guardado = ref
    ? await db.from("avm_properties").upsert(filaProp, { onConflict: "tenant_id,catastral_ref" }).select("id").single()
    : await db.from("avm_properties").insert(filaProp).select("id").single();
  if (guardado.error || !guardado.data) throw new Error(guardado.error?.message ?? "No se ha guardado el inmueble");

  const { data, error } = await db
    .from("avm_valuations")
    .insert({
      tenant_id: tenantId,
      property_id: guardado.data.id,
      channel,
      method_version: result.methodVersion,
      inputs: {
        twin,
        fieldSources: built.fieldSources,
        prefilledFields: [...built.prefilledFields],
      },
      operation,
      value_mid: result.valueMid,
      value_low: result.valueLow,
      value_high: result.valueHigh,
      price_per_m2: result.pricePerM2,
      rent_monthly: result.rentMonthly,
      gross_yield: result.grossYield,
      range_method: result.rangeMethod,
      rent_source: result.rentSource,
      confidence: result.confidence,
      precision_score: result.precisionScore,
      sources_used: result.sourcesUsed,
      comparables: result.comparables,
      zone_stats: result.zoneStats,
      environment: result.environment,
      explanation: result.explanation,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "No se ha guardado la valoración");
  return String(data.id);
}

export async function valorar(solicitud: SolicitudValoracion, ctx: Ctx): Promise<RespuestaValoracion> {
  const op: Operation = solicitud.operation ?? "sale";
  let tenantId = ctx.tenantId ?? null;

  if (solicitud.channel === "landing") {
    if (!solicitud.landingSlug) return { status: 404, body: { error: "Landing no encontrada" } };
    const { data } = await ctx.admin
      .from("avm_landing_config")
      .select("tenant_id, active")
      .eq("slug", solicitud.landingSlug)
      .maybeSingle();
    if (!data?.active) return { status: 404, body: { error: "Landing no encontrada" } };
    tenantId = String(data.tenant_id);
    const { data: permitido, error } = await ctx.admin.rpc("avm_rate_limit_hit", {
      p_key: `landing:${ctx.ip || "sin-ip"}`,
      p_limit: 20,
    });
    if (error) throw new Error(error.message);
    if (permitido === false) return { status: 429, body: { error: "Demasiadas valoraciones desde esta dirección" } };
  } else if (!tenantId) {
    if (!ctx.userId || !ctx.userDb) return { status: 401, body: { error: "Debes iniciar sesión" } };
    const { data, error } = await ctx.userDb.rpc("avm_current_tenant");
    if (error) throw new Error(error.message);
    tenantId = typeof data === "string" ? data : null;
    if (!tenantId) return { status: 401, body: { error: "Sin agencia" } };
  }

  const construir = ctx.construir ?? ((input, id) => buildTwin(input, { tenantId: id, db: ctx.userDb }));
  const built = solicitud.input.twin
    ? {
        twin: solicitud.input.twin,
        prefilledFields: new Set((solicitud.input.prefilledFields ?? []) as (keyof Twin)[]),
        fieldSources: (solicitud.input.fieldSources ?? {}) as TwinBuild["fieldSources"],
        propertySource: (solicitud.input.propertySource ?? "manual") as PropertySource,
        geocodingSource: solicitud.input.geocodingSource ?? "missing",
        zone: {
          censusSection: solicitud.input.twin.address.censusSection,
          municipalityCode: solicitud.input.twin.address.municipalityCode,
          postcode: solicitud.input.twin.address.postcode,
        },
        warnings: solicitud.input.warnings ?? [],
      }
    : await construir(solicitud.input, tenantId);

  const ref = refUnidad(solicitud.input.catastralRef) ?? refUnidad(built.twin.address.catastralRef);
  if (built.units && built.units.length > 1 && !ref) {
    return { status: 409, body: { units: built.units } };
  }

  const deps = depsMercado(ctx.admin);
  const { avisoMunicipioSinRastreo, estadoMercadoMunicipio, mensajeMercadoEnCarga } = await import("./market-loading");
  const mercado = await estadoMercadoMunicipio(ctx.admin, built.twin.address.municipalityCode ?? built.zone.municipalityCode);
  const result = await valuate(built.twin, deps, {
    channel: solicitud.channel,
    operation: "sale",
    propertySource: fuenteMotor(built.propertySource),
    propertyStale: built.warnings.some((w) => /caché/i.test(w)),
    geocodingSource: built.geocodingSource === "missing" ? "missing" : built.geocodingSource,
    marketLoading: mercado.loading,
    marketLoadingMessage: mensajeMercadoEnCarga(mercado),
  });
  if (op === "rent") result.operation = "rent";
  const sinMercado = avisoMunicipioSinRastreo(mercado.enRastreo, result.comparables.length, result.zoneStats != null);
  if (sinMercado) result.explanation.unshift(sinMercado);

  const valuationId = await guardar(
    ctx.admin,
    tenantId,
    built,
    result,
    solicitud.channel,
    op,
    solicitud.channel === "crm" ? ctx.userId ?? null : null,
    solicitud.input.listingId,
    solicitud.input.crmPropertyId
  );

  return {
    status: 200,
    body: {
      valuationId,
      result: solicitud.channel === "landing" ? publicView(result) : result,
    },
  };
}

export const TENANT_REHABINCO = TENANT;
