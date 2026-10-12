"use server";

import { solicitudValoracion, valorar } from "@/lib/avm/valuate-service";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function construirGemelo(input: {
  address?: string;
  lat?: number;
  lng?: number;
  carto?: import("@/lib/avm/carto-catastro").CartoCandidatoNormalizado;
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
  if (consulta.length < 4) return [];
  const supabase = await createClient();
  const { data: targets } = await supabase
    .from("market_crawl_targets")
    .select("municipality_code, name")
    .eq("active", true);
  const municipalityNames = (targets ?? []).map((t) => String(t.name)).filter(Boolean);
  const municipalityCodes = (targets ?? []).map((t) => String(t.municipality_code)).filter(Boolean);
  if (!municipalityNames.length) municipalityNames.push("A Coruña");
  if (!municipalityCodes.length) municipalityCodes.push("15030");

  const { fetchCartoCandidates } = await import("@/lib/avm/geocoder-carto");
  const lista = await fetchCartoCandidates(consulta, {
    municipalityNames,
    municipalityCodes,
    provinceCode: municipalityCodes[0]?.slice(0, 2) ?? "15",
  });
  return lista.map((c) => ({
    address: c.address,
    lat: c.lat,
    lng: c.lng,
    postcode: c.postcode,
    municipality: c.municipality,
    province: c.province,
    streetType: c.streetType,
    streetName: c.streetName,
    streetNumber: c.streetNumber,
  }));
}

export type ResultadoBusquedaCrm = {
  id: string;
  tipo: "inmueble" | "anuncio";
  titulo: string;
  subtitulo: string;
};

export async function buscarEnCrm(q: string): Promise<ResultadoBusquedaCrm[]> {
  const consulta = q.trim();
  if (consulta.length < 2) return [];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const like = `%${consulta.replace(/%/g, "")}%`;
  const [propiedades, anuncios] = await Promise.all([
    supabase
      .from("propiedades")
      .select("id, titulo, direccion, referencia, codigo_postal")
      .or(`direccion.ilike.${like},titulo.ilike.${like},referencia.ilike.${like}`)
      .limit(6),
    supabase
      .from("captacion_anuncios")
      .select("id, titulo, direccion, referencia_catastral")
      .or(`titulo.ilike.${like},direccion.ilike.${like},referencia_catastral.ilike.${like}`)
      .limit(6),
  ]);
  const filas: ResultadoBusquedaCrm[] = [];
  for (const row of propiedades.data ?? []) {
    filas.push({
      id: String(row.id),
      tipo: "inmueble",
      titulo: row.direccion ?? row.titulo ?? "Inmueble",
      subtitulo: [row.codigo_postal, row.referencia].filter(Boolean).join(" · ") || row.id,
    });
  }
  for (const row of anuncios.data ?? []) {
    filas.push({
      id: String(row.id),
      tipo: "anuncio",
      titulo: row.titulo ?? row.direccion ?? "Anuncio captado",
      subtitulo: [row.direccion, row.referencia_catastral].filter(Boolean).join(" · ") || row.id,
    });
  }
  return filas.slice(0, 8);
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
