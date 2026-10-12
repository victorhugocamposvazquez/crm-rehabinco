"use server";

import { solicitudValoracion, valorar } from "@/lib/avm/valuate-service";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function construirGemelo(input: {
  address?: string;
  lat?: number;
  lng?: number;
  catastralRef?: string;
  listingId?: string;
  crmPropertyId?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Debes iniciar sesión" };
  const { data: tenantId, error } = await supabase.rpc("avm_current_tenant");
  if (error || typeof tenantId !== "string") return { ok: false as const, error: "Sin agencia" };
  try {
    const { buildTwin } = await import("@/lib/avm/twin-builder");
    const built = await buildTwin(input, { tenantId, db: supabase });
    return {
      ok: true as const,
      twin: built.twin,
      prefilledFields: [...built.prefilledFields],
      fieldSources: built.fieldSources,
      propertySource: built.propertySource,
      geocodingSource: built.geocodingSource,
      units: built.units ?? [],
      warnings: built.warnings,
    };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "No se ha podido consultar Catastro" };
  }
}

export async function candidatosDireccion(q: string) {
  const consulta = q.trim();
  if (consulta.length < 3) return [];
  const url = `https://www.cartociudad.es/geocoder/api/geocoder/candidates?limit=6&q=${encodeURIComponent(consulta)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) return [];
  const json = (await res.json()) as unknown;
  const data = (Array.isArray(json) ? json : []) as { address?: string; lat?: number; lng?: number; postalCode?: string }[];
  return data
    .filter((c) => typeof c.lat === "number" && typeof c.lng === "number")
    .map((c) => ({
      address: c.address ?? "",
      lat: c.lat as number,
      lng: c.lng as number,
      postcode: c.postalCode ?? null,
    }));
}

export async function valorarInmueble(body: unknown) {
  const parsed = solicitudValoracion.safeParse(body);
  if (!parsed.success) return { status: 400 as const, body: { error: "Cuerpo no válido" } };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return valorar({ ...parsed.data, channel: "crm" }, {
    admin: createAdminClient(),
    userDb: supabase,
    userId: user?.id ?? null,
  });
}
