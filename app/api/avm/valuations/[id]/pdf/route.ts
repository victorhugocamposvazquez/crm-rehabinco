import { z } from "zod";
import { marcaDeAgencia, BUCKET_INFORMES } from "@/lib/avm/pdf/branding";
import { nombreDescargaPdf, rutaPdfGuardado, type MarcaPdf, type PdfThemeName, type PdfVariant } from "@/lib/avm/pdf/model";
import { renderInformePdf } from "@/lib/avm/pdf/render";
import { hydrateEnvironmentForInforme } from "@/lib/avm/environment-hydrate";
import type { Environment, Twin, ValuationResult } from "@/lib/avm/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const cuerpo = z.object({
  variant: z.enum(["propietario", "interno"]),
  theme: z.enum(["light", "dark"]).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = cuerpo.safeParse(json);
  if (!parsed.success) return Response.json({ error: "Cuerpo no válido" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Debes iniciar sesión" }, { status: 401 });

  const { data: tenantId, error: tenantError } = await supabase.rpc("avm_current_tenant");
  if (tenantError || typeof tenantId !== "string") return Response.json({ error: "Sin agencia" }, { status: 401 });

  const { data, error } = await supabase
    .from("avm_valuations")
    .select(
      "created_at, deleted_at, channel, method_version, operation, value_mid, value_low, value_high, price_per_m2, rent_monthly, gross_yield, confidence, precision_score, sources_used, comparables, zone_stats, environment, explanation, inputs, range_method, rent_source, created_by",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return Response.json({ error: "No está la valoración" }, { status: 404 });
  if (data.deleted_at) return Response.json({ error: "La valoración está en la papelera" }, { status: 410 });

  const variant = parsed.data.variant;
  let agente: { nombre: string | null; telefono: string | null } | null = null;
  if (data.created_by) {
    const { data: perfil } = await supabase
      .from("profiles")
      .select("nombre_completo, telefono")
      .eq("id", data.created_by)
      .maybeSingle();
    agente = perfil ? { nombre: perfil.nombre_completo, telefono: perfil.telefono } : null;
  }
  const marcaBase: MarcaPdf = {
    name: "REHABINCO, S.L.",
    phone: null,
    email: null,
    web: null,
    color: "#121214",
    pdfTheme: "dark",
    logoLight: null,
    logoDark: null,
    agentName: agente?.nombre?.trim() || "Comercial de la agencia",
    agentPhone: agente?.telefono ?? null,
  };
  let admin: ReturnType<typeof createAdminClient> | null = null;
  let marca = marcaBase;
  try {
    admin = createAdminClient();
    marca = await marcaDeAgencia(admin, tenantId, agente);
  } catch (err) {
    console.error("pdf marca", err instanceof Error ? err.message : err);
  }
  const theme: PdfThemeName = parsed.data.theme ?? marca.pdfTheme;
  const ruta = rutaPdfGuardado(tenantId, id, variant, theme);
  const twin = ((data.inputs as { twin?: Twin } | null)?.twin ?? {
    address: { formattedAddress: null, route: null, streetNumber: null, countryCode: "es" },
  }) as Twin;
  const filename = nombreDescargaDe(twin, data.created_at);

  const stored = data.environment as Environment | null;
  const hydrated = await hydrateEnvironmentForInforme(supabase, twin, stored).catch(() => ({
    environment: stored,
    coverage: null,
  }));
  const result = filaAResultado(data, hydrated.environment);
  let buffer: Buffer;
  try {
    ({ buffer } = await renderInformePdf({
      variant: variant as PdfVariant,
      theme,
      marca,
      valuationId: id,
      createdAt: data.created_at,
      result,
      twin,
      fieldSources: (data.inputs as { fieldSources?: Record<string, string> } | null)?.fieldSources ?? {},
      layers: hydrated.coverage?.layers_loaded,
      channel: data.channel,
    }));
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se ha podido generar el PDF";
    return Response.json({ error: message }, { status: 500 });
  }

  if (admin) {
    void admin.storage
      .from(BUCKET_INFORMES)
      .upload(ruta, buffer, { contentType: "application/pdf", upsert: true })
      .then(({ error }) => {
        if (error) console.error("pdf upload", error.message);
      });
  }

  const encoded = encodeURIComponent(filename);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="valoracion.pdf"; filename*=UTF-8''${encoded}`,
      "Cache-Control": "private, no-store",
    },
  });
}

function nombreDescargaDe(twin: Twin, createdAt: string): string {
  const calle = [twin.address?.route, twin.address?.streetNumber].filter(Boolean).join(" ");
  return nombreDescargaPdf(calle || twin.address?.formattedAddress || "valoracion", createdAt);
}

function filaAResultado(
  data: {
    method_version: string;
    operation: ValuationResult["operation"];
    value_mid: number | string | null;
    value_low: number | string | null;
    value_high: number | string | null;
    price_per_m2: number | string | null;
    rent_monthly: number | string | null;
    rent_source: ValuationResult["rentSource"];
    range_method: ValuationResult["rangeMethod"];
    gross_yield: number | string | null;
    confidence: number;
    precision_score: number;
    sources_used: ValuationResult["sourcesUsed"] | null;
    comparables: ValuationResult["comparables"] | null;
    zone_stats: ValuationResult["zoneStats"];
    explanation: string[] | null;
  },
  environment: Environment | null,
): ValuationResult {
  return {
    methodVersion: data.method_version,
    operation: data.operation,
    valueMid: Number(data.value_mid),
    valueLow: Number(data.value_low),
    valueHigh: Number(data.value_high),
    pricePerM2: data.price_per_m2 == null ? null : Number(data.price_per_m2),
    rentMonthly: data.rent_monthly == null ? null : Number(data.rent_monthly),
    rentSource: data.rent_source,
    rangeMethod: data.range_method,
    grossYield: data.gross_yield == null ? null : Number(data.gross_yield),
    confidence: data.confidence,
    precisionScore: data.precision_score,
    sourcesUsed: data.sources_used ?? [],
    comparables: (data.comparables ?? []).map((c) => ({
      ...c,
      price: Number(c.price),
      surface: Number(c.surface),
      pricePerM2: Number(c.pricePerM2),
      adjustedPpm2: Number(c.adjustedPpm2),
      weight: Number(c.weight),
      distanceM: Number(c.distanceM),
    })),
    zoneStats: data.zone_stats,
    environment,
    explanation: data.explanation ?? [],
  };
}
