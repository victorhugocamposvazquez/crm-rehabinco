import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluarCruce, pideAscensor, pideRequisito, precioDeCruce } from "./cruce";
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
  requisitos?: string | null;
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
    requisitos: row.requisitos ?? null,
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
  ascensor?: boolean | null;
  garaje?: boolean | null;
  terraza?: boolean | null;
  exterior?: boolean | null;
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
    ascensor: row.ascensor ?? null,
    garaje: row.garaje ?? null,
    terraza: row.terraza ?? null,
    exterior: row.exterior ?? null,
  };
}

type FilaPropuesta = {
  id: string;
  propiedad_id: string;
  origen: string;
  estado: string;
};

/** Propone inmuebles disponibles. Devuelve cuántos entran nuevos. */
export async function proponerStockParaDemanda(
  supabase: Cliente,
  demandaId: string,
  criterios: CriteriosDemanda
): Promise<number> {
  const [{ data: stock }, { data: ya }] = await Promise.all([
    supabase
      .from("propiedades")
      .select(
        "id, tipo_operacion, tipo_inmueble, localidad, codigo_postal, precio_venta, precio_alquiler, superficie_m2, superficie_util, habitaciones, banos, ascensor, garaje, terraza, exterior, estado, publicado"
      )
      .eq("estado", "disponible"),
    supabase.from("demanda_inmuebles").select("id, propiedad_id, origen, estado").eq("demanda_id", demandaId),
  ]);
  const filas = (ya ?? []) as FilaPropuesta[];
  const existentes = new Set(filas.map((row) => row.propiedad_id));
  const resultados = matchingDemandas(criterios, (stock ?? []).map(mapStock));
  const encajan = new Set(resultados.map((item) => item.propiedadId));
  let nuevos = 0;
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
    nuevos += 1;
  }
  const sobran = filas
    .filter((row) => row.origen === "automatico" && row.estado === "propuesto" && !encajan.has(row.propiedad_id))
    .map((row) => row.id);
  if (sobran.length > 0) {
    await supabase.from("demanda_inmuebles").delete().in("id", sobran);
  }
  return nuevos;
}

const SELECT_PARA_CRUCE =
  "id, tipo_operacion, tipo_inmueble, localidad, codigo_postal, precio_venta, precio_alquiler, superficie_m2, superficie_util, habitaciones, banos, ascensor, garaje, terraza, exterior, estado";

/** Cuando entra o pasa a disponible un inmueble, lo propone a las demandas en automático. */
export async function proponerInmuebleADemandas(supabase: Cliente, propiedadId: string): Promise<number> {
  try {
  const { data: row, error } = await supabase.from("propiedades").select(SELECT_PARA_CRUCE).eq("id", propiedadId).maybeSingle();
  if (error || !row || row.estado !== "disponible") return 0;

  const [{ data: demandas }, { data: ya }] = await Promise.all([
    supabase
      .from("demandas")
      .select(
        "id, tipo_operacion, tipos_inmueble, zonas, presupuesto_min, presupuesto_max, superficie_min, superficie_max, habitaciones_min, banos_min, requisitos, asignacion_auto, asignacion_casi"
      )
      .eq("estado", "activa")
      .eq("asignacion_auto", true),
    supabase.from("demanda_inmuebles").select("demanda_id").eq("propiedad_id", propiedadId),
  ]);

  const existentes = new Set((ya ?? []).map((fila) => fila.demanda_id));
  const inmueble = {
    tipoOperacion: row.tipo_operacion,
    tipoInmueble: row.tipo_inmueble,
    localidad: row.localidad,
    codigoPostal: row.codigo_postal,
    precio: null as number | null,
    superficie: row.superficie_util ?? row.superficie_m2,
    habitaciones: row.habitaciones,
    banos: row.banos,
    ascensor: row.ascensor,
    garaje: row.garaje,
    terraza: row.terraza,
    exterior: row.exterior,
  };
  let nuevos = 0;
  for (const demanda of demandas ?? []) {
    if (existentes.has(demanda.id)) continue;
    const precio = precioDeCruce(demanda.tipo_operacion, row.precio_venta, row.precio_alquiler);
    const evaluacion = evaluarCruce(
      { ...inmueble, precio },
      {
        tipoOperacion: demanda.tipo_operacion,
        tiposInmueble: demanda.tipos_inmueble ?? [],
        presupuestoMin: demanda.presupuesto_min,
        presupuestoMax: demanda.presupuesto_max,
        zonas: demanda.zonas ?? [],
        habitacionesMin: demanda.habitaciones_min,
        superficieMin: demanda.superficie_min,
        superficieMax: demanda.superficie_max,
        banosMin: demanda.banos_min,
        pideAscensor: pideAscensor(demanda.requisitos),
        pideGaraje: pideRequisito(demanda.requisitos, "garaje"),
        pideTerraza: pideRequisito(demanda.requisitos, "terraza"),
        pideExterior: pideRequisito(demanda.requisitos, "exterior"),
      }
    );
    if (!evaluacion.perfect && !(demanda.asignacion_casi && evaluacion.near)) continue;
    const { error: alta } = await supabase.from("demanda_inmuebles").insert({
      demanda_id: demanda.id,
      propiedad_id: propiedadId,
      origen: "automatico",
      puntuacion: evaluacion.passed,
      estado: "propuesto",
    });
    if (!alta) nuevos += 1;
  }
  return nuevos;
  } catch {
    return 0;
  }
}
