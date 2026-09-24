import { descargarSnapshot } from "@/lib/captacion/brightdata/disparar";
import { mapearBrightDataIdealista, registrosBrightData } from "@/lib/captacion/brightdata/idealista";
import { entraEnRetirados, zonaIdDeListado } from "@/lib/captacion/brightdata/zonas";
import { desaparecidosTrasSync, type AnuncioGuardado } from "@/lib/captacion/pipeline/upsert";
import { createAdminClient } from "@/lib/supabase/admin";

const SEIS_HORAS = 6 * 60 * 60 * 1000;

type Recogida = {
  collection_id: string;
  zonas: string[];
  iniciada: string;
  completada: string | null;
  incompleta?: boolean | null;
  registros: number;
  externos: string[];
  conteos?: Record<string, number> | null;
  sospechosas?: Record<string, MotivoSospecha> | null;
};

/** Última página llena y con «siguiente»: la zona no se leyó entera. */
export function listadoIncompleto(filas: Record<string, unknown>[]): boolean {
  const paginas = new Map<string, { n: number; sigue: boolean }>();
  for (const row of filas) {
    const pagina = Number(row.page);
    if (!Number.isFinite(pagina)) continue;
    const clave = `${String(row.listing_url ?? "zona")}|${pagina}`;
    const medido = Number(row.page_items);
    const sigue = row.has_next_page === true;
    const previo = paginas.get(clave);
    paginas.set(clave, {
      n: Number.isFinite(medido) ? medido : (previo?.n ?? 0) + 1,
      sigue: sigue || previo?.sigue === true,
    });
  }
  for (const grupo of paginas.values()) {
    if (grupo.sigue && grupo.n > 0 && grupo.n % 30 === 0) return true;
  }
  return false;
}

export type MotivoSospecha = "vacia" | "caida" | "pagina_invalida";

/** 0 anuncios, menos del 50 % de la recogida anterior, o página sin bloque de listado. */
export function evaluarZonas(
  filas: Record<string, unknown>[],
  conteosAnteriores: Record<string, number>
): { conteos: Record<string, number>; sospechosas: Record<string, MotivoSospecha> } {
  const conteos: Record<string, number> = {};
  const invalidas = new Set<string>();
  const vistas = new Map<string, Set<string>>();
  for (const row of filas) {
    const listing = String(row.listing_url ?? "");
    if (/publicado_/i.test(listing)) continue;
    const zona = zonaIdDeListado(listing);
    if (!zona) continue;
    const sinListado = row.sin_listado === true || row.sin_listado === "true";
    if (sinListado) {
      invalidas.add(zona);
      conteos[zona] = conteos[zona] ?? 0;
      continue;
    }
    const id = String(row.externo_id ?? "");
    if (!/^\d{5,}$/.test(id)) {
      conteos[zona] = conteos[zona] ?? 0;
      continue;
    }
    const ids = vistas.get(zona) ?? new Set<string>();
    ids.add(id);
    vistas.set(zona, ids);
    conteos[zona] = ids.size;
  }
  const sospechosas: Record<string, MotivoSospecha> = {};
  for (const zona of invalidas) sospechosas[zona] = "pagina_invalida";
  for (const [zona, n] of Object.entries(conteos)) {
    if (sospechosas[zona]) continue;
    const antes = conteosAnteriores[zona];
    if (n === 0) sospechosas[zona] = "vacia";
    else if (typeof antes === "number" && antes > 0 && n < antes * 0.5) sospechosas[zona] = "caida";
  }
  return { conteos, sospechosas };
}

function admin() {
  return createAdminClient();
}

export async function abrirRecogida(collectionId: string, zonas: string[]): Promise<void> {
  await admin().from("captacion_recogidas").upsert(
    { collection_id: collectionId, zonas, iniciada: new Date().toISOString(), registros: 0, externos: [] },
    { onConflict: "collection_id" }
  );
}

/** Impide otro disparo de las mismas zonas si hay una recogida abierta de menos de 6 h. */
export async function zonasBloqueadas(zonas: string[]): Promise<string[]> {
  const { data } = await admin().from("captacion_recogidas").select("zonas, iniciada, completada").is("completada", null);
  const limite = Date.now() - SEIS_HORAS;
  const bloqueadas = new Set<string>();
  for (const fila of (data ?? []) as Array<{ zonas?: string[]; iniciada?: string }>) {
    const iniciada = fila.iniciada ? new Date(fila.iniciada).getTime() : 0;
    if (iniciada < limite) continue;
    for (const zona of fila.zonas ?? []) {
      if (zonas.includes(zona)) bloqueadas.add(zona);
    }
  }
  return [...bloqueadas];
}

export async function recogidaAbiertaSiUnica(): Promise<string | null> {
  const { data } = await admin().from("captacion_recogidas").select("collection_id").is("completada", null);
  const filas = (data ?? []) as Array<{ collection_id?: string }>;
  return filas.length === 1 && filas[0].collection_id ? filas[0].collection_id : null;
}

export async function anotarLote(collectionId: string, registros: Record<string, unknown>[]): Promise<void> {
  const ids = registros
    .map((row) => mapearBrightDataIdealista(row)?.externo_id)
    .filter((id): id is string => Boolean(id));
  if (ids.length === 0) return;
  const supabase = admin();
  const { data } = await supabase.from("captacion_recogidas").select("externos, registros").eq("collection_id", collectionId).maybeSingle();
  if (!data) return;
  const previos = Array.isArray(data.externos) ? (data.externos as string[]) : [];
  const unidos = [...new Set([...previos, ...ids])];
  await supabase.from("captacion_recogidas").update({ externos: unidos, registros: unidos.length }).eq("collection_id", collectionId);
}

/** Cierra la recogida solo si el dataset entero ya responde 200. Entonces retira. */
export async function intentarCerrarRecogida(token: string, collectionId: string): Promise<boolean> {
  const supabase = admin();
  const { data } = await supabase.from("captacion_recogidas").select("*").eq("collection_id", collectionId).maybeSingle();
  const recogida = data as Recogida | null;
  if (!recogida || recogida.completada) return false;

  const log = await fetch(`https://api.brightdata.com/dca/log/${encodeURIComponent(collectionId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const meta = (await log.json().catch(() => ({}))) as { Status?: string; status?: string };
  const estado = String(meta.Status ?? meta.status ?? "");
  if (log.ok && estado && !/done|ready|finished|success/i.test(estado)) return false;

  const snapshot = await descargarSnapshot(token, collectionId);
  if (snapshot && typeof snapshot === "object" && "pendiente" in (snapshot as object)) return false;
  const filas = registrosBrightData(snapshot);
  if (!Array.isArray(filas) || filas.length === 0) return false;

  const externos = [
    ...new Set(
      filas.map((row) => mapearBrightDataIdealista(row)?.externo_id).filter((id): id is string => Boolean(id))
    ),
  ];
  const ahora = new Date().toISOString();
  const incompleta = listadoIncompleto(filas);
  const { data: previas } = await supabase
    .from("captacion_recogidas")
    .select("zonas, conteos, completada, incompleta")
    .not("completada", "is", null)
    .eq("incompleta", false)
    .order("completada", { ascending: false })
    .limit(12);
  const conteosAnteriores: Record<string, number> = {};
  for (const zona of recogida.zonas ?? []) {
    const previa = ((previas ?? []) as Recogida[]).find(
      (fila) => fila.completada !== ahora && (fila.zonas ?? []).includes(zona) && typeof fila.conteos?.[zona] === "number"
    );
    if (previa?.conteos) conteosAnteriores[zona] = previa.conteos[zona];
  }
  const { conteos, sospechosas } = evaluarZonas(filas, conteosAnteriores);
  await supabase
    .from("captacion_recogidas")
    .update({ completada: ahora, incompleta, registros: externos.length, externos, conteos, sospechosas })
    .eq("collection_id", collectionId);
  const zonasLimpias = (recogida.zonas ?? []).filter((zona) => !sospechosas[zona]);
  if (!incompleta) await retirarZonas(zonasLimpias, externos, ahora);
  if (Object.keys(sospechosas).length > 0) await avisarSospechosas(supabase, sospechosas);
  return true;
}

const MOTIVO: Record<MotivoSospecha, string> = {
  vacia: "el listado llegó vacío",
  caida: "llegó menos del 50 % de la recogida anterior",
  pagina_invalida: "la página no trae el bloque de anuncios",
};

async function avisarSospechosas(
  supabase: ReturnType<typeof admin>,
  sospechosas: Record<string, MotivoSospecha>
): Promise<void> {
  const { data } = await supabase.from("profiles").select("id").eq("role", "superadmin");
  const detalle = Object.entries(sospechosas)
    .map(([zona, motivo]) => `${zona}: ${MOTIVO[motivo]}`)
    .join(". ");
  const filas = ((data ?? []) as Array<{ id?: string }>)
    .filter((fila) => fila.id)
    .map((fila) => ({
      user_id: fila.id,
      tipo: "zona_sospechosa",
      titulo: "Zona de Idealista sospechosa",
      detalle,
    }));
  if (filas.length === 0) return;
  await supabase.from("captacion_notificaciones").insert(filas);
}

async function retirarZonas(zonas: string[], externosActuales: string[], ahora: string) {
  if (zonas.length === 0 || externosActuales.length === 0) return;
  const supabase = admin();
  const { data: previas } = await supabase
    .from("captacion_recogidas")
    .select("externos, zonas, completada")
    .not("completada", "is", null)
    .order("completada", { ascending: false })
    .limit(8);
  const anterior = ((previas ?? []) as Recogida[]).find(
    (fila) =>
      fila.completada !== ahora &&
      !fila.incompleta &&
      (fila.zonas ?? []).some((zona) => zonas.includes(zona))
  );
  if (!anterior) return;
  const vistos = new Set([...externosActuales, ...(anterior.externos ?? [])]);
  const { data } = await supabase
    .from("captacion_anuncios")
    .select("id, portal_id, externo_id, precio, tags, fase, alerta_id, desaparecido_en, zona_id")
    .eq("portal_id", "idealista")
    .is("desaparecido_en", null)
    .in("fase", ["novedad", "contacto", "visita", "negociando"]);
  const deLaZona = ((data ?? []) as Array<AnuncioGuardado & { zona_id?: string | null }>).filter((row) =>
    entraEnRetirados(row.zona_id, zonas)
  );
  const fuera = desaparecidosTrasSync(deLaZona, [...vistos].map((externo_id) => ({ portal_id: "idealista", externo_id })), ahora);
  if (fuera.length === 0) return;
  await supabase.from("captacion_anuncios").update({ desaparecido_en: ahora }).in(
    "id",
    fuera.map((item) => item.id)
  );
}
