import { convertirAnuncioACrm } from "@/lib/captacion/portales/captar";
import { parseFaseAnuncio, type AnuncioCaptacion, type FaseAnuncio } from "@/lib/captacion/portales/modelo";
import { sesionCaptacion } from "@/lib/captacion/portales/sesion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function filaAnuncio(row: Record<string, unknown>): AnuncioCaptacion {
  return {
    id: String(row.id),
    fuente: row.fuente === "fotocasa" || row.fuente === "milanuncios" ? row.fuente : "idealista",
    externo_id: String(row.externo_id),
    url: typeof row.url === "string" ? row.url : null,
    titulo: String(row.titulo ?? ""),
    descripcion: typeof row.descripcion === "string" ? row.descripcion : null,
    operacion: row.operacion === "alquiler" ? "alquiler" : "venta",
    tipo: typeof row.tipo === "string" ? row.tipo : null,
    anunciante:
      row.anunciante === "particular" || row.anunciante === "empresa" || row.anunciante === "banco"
        ? row.anunciante
        : "desconocido",
    precio: row.precio == null ? null : Number(row.precio),
    precio_anterior: row.precio_anterior == null ? null : Number(row.precio_anterior),
    superficie: row.superficie == null ? null : Number(row.superficie),
    habitaciones: row.habitaciones == null ? null : Number(row.habitaciones),
    banos: row.banos == null ? null : Number(row.banos),
    direccion: typeof row.direccion === "string" ? row.direccion : null,
    zona: typeof row.zona === "string" ? row.zona : null,
    municipio: typeof row.municipio === "string" ? row.municipio : null,
    codigo_postal: typeof row.codigo_postal === "string" ? row.codigo_postal : null,
    lat: typeof row.lat === "number" ? row.lat : null,
    lng: typeof row.lng === "number" ? row.lng : null,
    thumb: typeof row.thumb === "string" ? row.thumb : null,
    n_fotos: row.n_fotos == null ? null : Number(row.n_fotos),
    contacto_nombre: typeof row.contacto_nombre === "string" ? row.contacto_nombre : null,
    contacto_telefono: typeof row.contacto_telefono === "string" ? row.contacto_telefono : null,
    contacto_clave: typeof row.contacto_clave === "string" ? row.contacto_clave : null,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    alerta_id: typeof row.alerta_id === "string" ? row.alerta_id : null,
    fase: parseFaseAnuncio(row.fase),
    comercial_id: typeof row.comercial_id === "string" ? row.comercial_id : null,
    proxima_accion: typeof row.proxima_accion === "string" ? row.proxima_accion : null,
    propiedad_id: typeof row.propiedad_id === "string" ? row.propiedad_id : null,
    cliente_id: typeof row.cliente_id === "string" ? row.cliente_id : null,
    publicado_en: typeof row.publicado_en === "string" ? row.publicado_en : null,
    visto_en: String(row.visto_en ?? row.created_at ?? ""),
    desaparecido_en: typeof row.desaparecido_en === "string" ? row.desaparecido_en : null,
    created_at: String(row.created_at ?? ""),
  };
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const sesion = await sesionCaptacion();
  if (!sesion.ok) return Response.json({ ok: false, error: sesion.error }, { status: sesion.status });

  const { id } = await context.params;
  if (!id) return Response.json({ ok: false, error: "Falta el anuncio." }, { status: 400 });

  let cuerpo: {
    comercial_id?: unknown;
    fase?: unknown;
    estado?: unknown;
    nota?: unknown;
    proxima_accion?: unknown;
  } = {};
  try {
    cuerpo = (await request.json()) as typeof cuerpo;
  } catch {
    return Response.json({ ok: false, error: "Cuerpo inválido." }, { status: 400 });
  }

  const { data: fila, error: errFila } = await sesion.supabase
    .from("captacion_anuncios")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (errFila || !fila) return Response.json({ ok: false, error: "Anuncio no encontrado." }, { status: 404 });
  const anuncio = filaAnuncio(fila as Record<string, unknown>);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("comercial_id" in cuerpo) {
    patch.comercial_id = typeof cuerpo.comercial_id === "string" ? cuerpo.comercial_id : null;
  }
  if ("proxima_accion" in cuerpo) {
    patch.proxima_accion = typeof cuerpo.proxima_accion === "string" ? cuerpo.proxima_accion : null;
  }
  const faseRaw = cuerpo.fase ?? cuerpo.estado;
  let fase: FaseAnuncio | null = null;
  if (typeof faseRaw === "string") {
    fase = parseFaseAnuncio(faseRaw);
    patch.fase = fase;
  }

  let convertido: { propiedadId: string; clienteId: string | null; referencia: string } | null = null;
  if (fase === "captado") {
    const resultado = await convertirAnuncioACrm(sesion.supabase as never, anuncio, sesion.user.id);
    if (!resultado.ok) return Response.json({ ok: false, error: resultado.error }, { status: 400 });
    patch.propiedad_id = resultado.propiedadId;
    patch.cliente_id = resultado.clienteId;
    patch.proxima_accion = null;
    convertido = resultado;
  }

  const { error } = await sesion.supabase.from("captacion_anuncios").update(patch).eq("id", id);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  const actor = sesion.user.id;
  const nota = typeof cuerpo.nota === "string" ? cuerpo.nota.trim() : "";
  if (nota) {
    await sesion.supabase.from("captacion_anuncios_actividad").insert({
      anuncio_id: id,
      actor_id: actor,
      tipo: "nota",
      detalle: nota,
    });
  }
  if ("comercial_id" in cuerpo) {
    await sesion.supabase.from("captacion_anuncios_actividad").insert({
      anuncio_id: id,
      actor_id: actor,
      tipo: "asignacion",
      detalle: patch.comercial_id ? "Comercial asignado" : "Sin comercial",
    });
  }
  if (fase === "captado" && convertido) {
    await sesion.supabase.from("captacion_anuncios_actividad").insert({
      anuncio_id: id,
      actor_id: actor,
      tipo: "captado",
      detalle: convertido.referencia
        ? `Mandato firmado → ${convertido.referencia}`
        : "Convertido a inmueble PORTAL",
    });
  } else if (fase) {
    await sesion.supabase.from("captacion_anuncios_actividad").insert({
      anuncio_id: id,
      actor_id: actor,
      tipo: "fase",
      detalle: `Movido a ${fase}`,
    });
  }

  return Response.json({ ok: true, convertido });
}
