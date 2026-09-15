import type { SupabaseClient } from "@supabase/supabase-js";
import { matchingDemandas, type CriteriosDemanda, type InmuebleParaMatching } from "./matching";

type Cliente = SupabaseClient;

export function criteriosDeDemanda(row: {
  tipo_operacion: string;
  tipos_inmueble?: string[] | null;
  zonas?: string[] | null;
  presupuesto_min?: number | null;
  presupuesto_max?: number | null;
  superficie_min?: number | null;
  superficie_max?: number | null;
  habitaciones_min?: number | null;
  banos_min?: number | null;
}): CriteriosDemanda {
  return {
    tipoOperacion: row.tipo_operacion,
    tiposInmueble: row.tipos_inmueble ?? [],
    zonas: row.zonas ?? [],
    presupuestoMin: row.presupuesto_min ?? null,
    presupuestoMax: row.presupuesto_max ?? null,
    superficieMin: row.superficie_min ?? null,
    superficieMax: row.superficie_max ?? null,
    habitacionesMin: row.habitaciones_min ?? null,
    banosMin: row.banos_min ?? null,
  };
}

function mapStock(row: {
  id: string;
  tipo_operacion: string | null;
  tipo_inmueble: string | null;
  localidad: string | null;
  codigo_postal: string | null;
  precio_venta: number | null;
  precio_alquiler: number | null;
  superficie_m2: number | null;
  superficie_util: number | null;
  habitaciones: number | null;
  banos: number | null;
  estado: string | null;
  publicado: boolean | null;
}): InmuebleParaMatching {
  return {
    id: row.id,
    tipoOperacion: row.tipo_operacion,
    tipoInmueble: row.tipo_inmueble,
    localidad: row.localidad,
    codigoPostal: row.codigo_postal,
    precioVenta: row.precio_venta,
    precioAlquiler: row.precio_alquiler,
    superficie: row.superficie_util ?? row.superficie_m2,
    habitaciones: row.habitaciones,
    banos: row.banos,
    estado: row.estado,
    publicado: row.publicado,
  };
}

/** Propone inmuebles publicados y disponibles. No confirma el match. */
export async function proponerStockParaDemanda(
  supabase: Cliente,
  demandaId: string,
  criterios: CriteriosDemanda
): Promise<number> {
  const [{ data: stock }, { data: ya }] = await Promise.all([
    supabase
      .from("propiedades")
      .select(
        "id, tipo_operacion, tipo_inmueble, localidad, codigo_postal, precio_venta, precio_alquiler, superficie_m2, superficie_util, habitaciones, banos, estado, publicado"
      )
      .eq("estado", "disponible")
      .eq("publicado", true),
    supabase.from("demanda_inmuebles").select("propiedad_id").eq("demanda_id", demandaId),
  ]);
  const existentes = new Set((ya ?? []).map((row) => row.propiedad_id));
  const resultados = matchingDemandas(criterios, (stock ?? []).map(mapStock));
  for (const item of resultados) {
    if (existentes.has(item.propiedadId)) {
      await supabase
        .from("demanda_inmuebles")
        .update({ puntuacion: item.puntuacion })
        .eq("demanda_id", demandaId)
        .eq("propiedad_id", item.propiedadId);
      continue;
    }
    await supabase.from("demanda_inmuebles").insert({
      demanda_id: demandaId,
      propiedad_id: item.propiedadId,
      origen: "automatico",
      puntuacion: item.puntuacion,
      estado: "propuesto",
    });
  }
  return resultados.length;
}
