import { EMPRESA_DOCUMENTOS } from "@/lib/empresa-documentos";
import { fetchEmisorFacturacion } from "@/lib/empresa-facturacion";
import { createClient } from "@/lib/supabase/server";
import { etiquetaVisita, mapearInmuebleEstudio, type AgenteFila, type FilaEstudio, type FotoFila } from "./mapear";

export async function cargarEstudio() {
  const supabase = await createClient();
  const { data: filas } = await supabase
    .from("propiedades")
    .select(
      "id, referencia, titulo, direccion, localidad, tipo_operacion, precio_venta, precio_alquiler, superficie_m2, superficie_construida, habitaciones, banos, certificado_energetico, comercial_id, user_id"
    )
    .eq("publicar_redes", true)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(300);
  const propiedades = (filas ?? []) as FilaEstudio[];
  const ids = propiedades.map((p) => p.id);
  const agenteIds = [...new Set(propiedades.map((p) => p.comercial_id || p.user_id))];
  const [media, perfiles, citas, emisor] = await Promise.all([
    ids.length
      ? supabase.from("inmueble_media").select("id, propiedad_id, url, orden").in("propiedad_id", ids).eq("tipo", "foto")
      : Promise.resolve({ data: [] as FotoFila[] }),
    agenteIds.length
      ? supabase.from("profiles").select("id, nombre_completo, color").in("id", agenteIds)
      : Promise.resolve({ data: [] as AgenteFila[] }),
    ids.length
      ? supabase
          .from("citas")
          .select("propiedad_id, empieza, termina")
          .in("propiedad_id", ids)
          .gte("empieza", new Date().toISOString())
          .order("empieza", { ascending: true })
          .limit(400)
      : Promise.resolve({ data: [] as { propiedad_id: string | null; empieza: string; termina: string }[] }),
    fetchEmisorFacturacion(supabase).catch(() => null),
  ]);
  const fotos = (media.data ?? []) as FotoFila[];
  const agentes = new Map(((perfiles.data ?? []) as AgenteFila[]).map((p) => [p.id, p]));
  const visitas = new Map<string, { evento: string; hora: string }>();
  for (const cita of citas.data ?? []) {
    if (!cita.propiedad_id || visitas.has(cita.propiedad_id)) continue;
    visitas.set(cita.propiedad_id, etiquetaVisita(cita.empieza, cita.termina));
  }
  const telefono = emisor?.telefono?.trim() || EMPRESA_DOCUMENTOS.telefono;
  const web = EMPRESA_DOCUMENTOS.web.replace(/^https?:\/\//, "").replace(/^www\./, "");
  return {
    inmuebles: propiedades.map((fila) =>
      mapearInmuebleEstudio(fila, fotos, agentes.get(fila.comercial_id || fila.user_id) ?? null, visitas.get(fila.id) ?? null)
    ),
    agencia: { telefono, web, cta: "¿Vendes tu casa? Te la valoramos gratis" },
  };
}
