import { createClient } from "@/lib/supabase/client";
import { relacionUno } from "@/lib/citas/citas";

export const SELECT_INMUEBLE_PANEL =
  "id, titulo, direccion, localidad, tipo_operacion, precio_venta, precio_alquiler, estado, referencia, tipo_inmueble, origen, superficie_m2, anio_construccion, referencia_catastral, descripcion, publicado, ofertante_id, comercial_id, habitaciones, banos, planta, clientes:ofertante_id(nombre), profiles:comercial_id(nombre_completo, color), inmueble_media(url, portada), catastro_property_links(finca_reference)";

export type InmueblePanel = {
  id: string;
  titulo: string | null;
  direccion: string | null;
  localidad: string | null;
  tipo_operacion: string;
  precio_venta: number | null;
  precio_alquiler: number | null;
  estado: string;
  ofertanteNombre: string;
  referencia: string | null;
  tipo_inmueble: string | null;
  portadaUrl: string | null;
  nFotos: number;
  origen: string | null;
  dhStatus: string | null;
  superficie_m2: number | null;
  anio_construccion: number | null;
  referencia_catastral: string | null;
  descripcion: string | null;
  publicado: boolean;
  ofertante_id: string | null;
  comercialNombre: string | null;
  comercialColor: string | null;
  fincaReference: string | null;
  habitaciones: number | null;
  banos: number | null;
  planta: string | null;
};

export type InmueblePanelRow = {
  id: string;
  titulo: string | null;
  direccion: string | null;
  localidad: string | null;
  tipo_operacion: string;
  precio_venta: number | null;
  precio_alquiler: number | null;
  estado: string;
  referencia: string | null;
  tipo_inmueble: string | null;
  origen: string | null;
  superficie_m2: number | null;
  anio_construccion: number | null;
  referencia_catastral: string | null;
  descripcion: string | null;
  publicado: boolean;
  ofertante_id: string | null;
  habitaciones?: number | null;
  banos?: number | null;
  planta?: string | null;
  clientes: { nombre: string } | { nombre: string }[] | null;
  profiles:
    | { nombre_completo: string | null; color: string | null }
    | { nombre_completo: string | null; color: string | null }[]
    | null;
  inmueble_media: Array<{ url: string; portada: boolean }> | null;
  catastro_property_links: { finca_reference: string } | { finca_reference: string }[] | null;
};

export function mapInmueblePanel(r: InmueblePanelRow, dhPorFinca?: Map<string, string>): InmueblePanel {
  const c = relacionUno(r.clientes);
  const com = relacionUno(r.profiles);
  const fotos = r.inmueble_media ?? [];
  const portada = fotos.find((f) => f.portada) ?? fotos[0];
  const link = relacionUno(r.catastro_property_links);
  const fincaReference = link?.finca_reference ?? null;
  return {
    id: r.id,
    titulo: r.titulo,
    direccion: r.direccion,
    localidad: r.localidad,
    tipo_operacion: r.tipo_operacion,
    precio_venta: r.precio_venta,
    precio_alquiler: r.precio_alquiler,
    estado: r.estado,
    ofertanteNombre: c?.nombre ?? "—",
    referencia: r.referencia,
    tipo_inmueble: r.tipo_inmueble,
    portadaUrl: portada?.url ?? null,
    nFotos: fotos.length,
    origen: r.origen ?? null,
    dhStatus: fincaReference ? dhPorFinca?.get(fincaReference) ?? null : null,
    superficie_m2: r.superficie_m2,
    anio_construccion: r.anio_construccion,
    referencia_catastral: r.referencia_catastral,
    descripcion: r.descripcion,
    publicado: r.publicado,
    ofertante_id: r.ofertante_id,
    comercialNombre: com?.nombre_completo ?? null,
    comercialColor: com?.color ?? null,
    fincaReference,
    habitaciones: r.habitaciones ?? null,
    banos: r.banos ?? null,
    planta: r.planta ?? null,
  };
}

export async function cargarDhPorFincas(refs: string[]): Promise<Map<string, string>> {
  const dhPorFinca = new Map<string, string>();
  if (refs.length === 0) return dhPorFinca;
  const supabase = createClient();
  const { data: fincas } = await supabase.from("catastro_fincas").select("finca_reference, dh_status").in("finca_reference", refs);
  for (const finca of fincas ?? []) {
    dhPorFinca.set(finca.finca_reference, finca.dh_status);
  }
  return dhPorFinca;
}

export async function cargarInmueblePanel(id: string): Promise<InmueblePanel | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from("propiedades").select(SELECT_INMUEBLE_PANEL).eq("id", id).maybeSingle();
  if (error || !data) return null;
  const row = data as InmueblePanelRow;
  const ref = relacionUno(row.catastro_property_links)?.finca_reference;
  const dh = await cargarDhPorFincas(ref ? [ref] : []);
  return mapInmueblePanel(row, dh);
}

export function precioDeInmueble(p: Pick<InmueblePanel, "tipo_operacion" | "precio_alquiler" | "precio_venta">) {
  return p.tipo_operacion === "alquiler" ? p.precio_alquiler : p.precio_venta;
}
