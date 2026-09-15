import type { AnunciantePortal, AnuncioCaptacion } from "./modelo";
import { payloadMediaExterna, urlsDeFotosPortal } from "@/lib/inmuebles/media";

export function siguienteReferencia(refs: Array<string | null | undefined>, year: number): string {
  const re = new RegExp(`^RHB-${year}-(\\d+)$`);
  let max = 0;
  for (const ref of refs) {
    const m = ref?.trim().match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `RHB-${year}-${String(max + 1).padStart(4, "0")}`;
}

export function tipoInmuebleDesdeAnuncio(tipo: string | null | undefined): string | null {
  if (tipo === "piso") return "piso";
  if (tipo === "casa") return "chalet";
  if (tipo === "local") return "local";
  if (tipo === "terreno") return "solar";
  if (tipo === "edificio") return "piso";
  return null;
}

export function tipoClienteDesdeAnunciante(anunciante: AnunciantePortal | string): "particular" | "empresa" {
  return anunciante === "empresa" || anunciante === "banco" ? "empresa" : "particular";
}

export function nombreClienteDesdeAnuncio(anuncio: {
  contacto_nombre: string | null;
  titulo: string;
  municipio: string | null;
}): string {
  const nombre = anuncio.contacto_nombre?.trim();
  if (nombre) return nombre;
  if (anuncio.municipio) return `Ofertante · ${anuncio.municipio}`;
  return anuncio.titulo.trim() || "Ofertante portal";
}

export function payloadClienteDesdeAnuncio(
  anuncio: Pick<
    AnuncioCaptacion,
    "contacto_nombre" | "contacto_telefono" | "titulo" | "direccion" | "codigo_postal" | "municipio" | "anunciante" | "fuente" | "url"
  >,
  userId: string
) {
  return {
    user_id: userId,
    nombre: nombreClienteDesdeAnuncio(anuncio),
    telefono: anuncio.contacto_telefono,
    tipo_cliente: tipoClienteDesdeAnunciante(anuncio.anunciante),
    direccion: anuncio.direccion,
    codigo_postal: anuncio.codigo_postal,
    localidad: anuncio.municipio,
    notas: anuncio.url
      ? `Captado desde ${anuncio.fuente}: ${anuncio.url}`
      : `Captado desde ${anuncio.fuente}`,
  };
}

export function payloadPropiedadDesdeAnuncio(
  anuncio: Pick<
    AnuncioCaptacion,
    | "titulo"
    | "direccion"
    | "municipio"
    | "operacion"
    | "precio"
    | "superficie"
    | "habitaciones"
    | "tipo"
    | "fuente"
    | "url"
    | "comercial_id"
  > &
    Partial<Pick<AnuncioCaptacion, "descripcion" | "banos" | "codigo_postal" | "lat" | "lng">>,
  input: { userId: string; referencia: string; ofertanteId: string | null }
) {
  return {
    user_id: input.userId,
    comercial_id: anuncio.comercial_id || input.userId,
    ofertante_id: input.ofertanteId,
    titulo: anuncio.titulo,
    direccion: anuncio.direccion,
    localidad: anuncio.municipio,
    codigo_postal: anuncio.codigo_postal,
    tipo_operacion: anuncio.operacion === "alquiler" ? "alquiler" : "venta",
    precio_venta: anuncio.operacion === "venta" ? anuncio.precio : null,
    precio_alquiler: anuncio.operacion === "alquiler" ? anuncio.precio : null,
    superficie_m2: anuncio.superficie,
    habitaciones: anuncio.habitaciones,
    banos: anuncio.banos,
    tipo_inmueble: tipoInmuebleDesdeAnuncio(anuncio.tipo),
    descripcion: anuncio.descripcion,
    lat: anuncio.lat,
    lng: anuncio.lng,
    estado: "disponible",
    origen: "PORTAL" as const,
    publicado: false,
    referencia: input.referencia,
    notas: anuncio.url ? `Origen ${anuncio.fuente}: ${anuncio.url}` : `Origen ${anuncio.fuente}`,
  };
}

function digitos(telefono: string | null | undefined): string {
  return (telefono ?? "").replace(/\D/g, "");
}

type ResultadoConsulta<T> = { data: T | null; error: { message: string } | null };

type DbCaptar = {
  from: (table: string) => {
    select: (cols: string) => PromiseLike<ResultadoConsulta<Array<Record<string, unknown>>>>;
    insert: (row: Record<string, unknown>) => {
      select: (cols: string) => {
        single: () => Promise<ResultadoConsulta<Record<string, unknown>>>;
      };
    };
  };
};

export async function convertirAnuncioACrm(
  db: DbCaptar,
  anuncio: AnuncioCaptacion,
  userId: string
): Promise<{ ok: true; propiedadId: string; clienteId: string | null; referencia: string } | { ok: false; error: string }> {
  let clienteId = anuncio.cliente_id;
  if (!clienteId) {
    const tel = digitos(anuncio.contacto_telefono);
    if (tel.length >= 9) {
      const { data: clientes } = await db.from("clientes").select("id, telefono");
      const match = (clientes ?? []).find((row) => digitos(String(row.telefono ?? "")) === tel);
      if (match?.id) clienteId = String(match.id);
    }
  }
  if (!clienteId) {
    const { data: creado, error } = await db
      .from("clientes")
      .insert(payloadClienteDesdeAnuncio(anuncio, userId))
      .select("id")
      .single();
    if (!error && creado?.id) clienteId = String(creado.id);
  }

  if (anuncio.propiedad_id) {
    return { ok: true, propiedadId: anuncio.propiedad_id, clienteId, referencia: "" };
  }

  const year = new Date().getFullYear();
  const { data: refs } = await db.from("propiedades").select("referencia");
  const referencia = siguienteReferencia((refs ?? []).map((r) => (typeof r.referencia === "string" ? r.referencia : null)), year);
  const { data, error } = await db
    .from("propiedades")
    .insert(payloadPropiedadDesdeAnuncio(anuncio, { userId, referencia, ofertanteId: clienteId }))
    .select("id, referencia")
    .single();
  if (error || !data?.id) {
    return { ok: false, error: error?.message ?? "No se ha podido crear el inmueble." };
  }
  const propiedadId = String(data.id);
  const fotos = urlsDeFotosPortal({ thumb: anuncio.thumb, fotos: anuncio.fotos });
  for (const [i, url] of fotos.entries()) {
    await db
      .from("inmueble_media")
      .insert(
        payloadMediaExterna({
          propiedadId,
          userId,
          url,
          orden: i,
          portada: i === 0,
        })
      )
      .select("id")
      .single();
  }
  return {
    ok: true,
    propiedadId,
    clienteId,
    referencia: typeof data.referencia === "string" ? data.referencia : referencia,
  };
}
