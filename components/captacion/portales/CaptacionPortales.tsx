"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { isAdmin } from "@/lib/auth/roles";
import { AvatarComercial } from "@/components/ui/avatar-comercial";
import { Sheet } from "@/components/ui/sheet";
import { FiltroComercial, type ComercialFiltro } from "@/components/captacion/FiltroComercial";
import { nombreYApellido, inicialesNombre } from "@/lib/ui/tokens";
import { normalizarTexto } from "@/lib/captacion/pipeline/normalize";
import { CIUDADES_FILTRO } from "@/lib/captacion/portales/zonas";
import {
  indiciosEncubierta,
  recuentoPorClave,
  relacionadosDe,
  textoAvisoEncubierta,
  type IndiciosEncubierta,
} from "@/lib/captacion/portales/relacionados";
import {
  FASE_KANBAN_META,
  FUENTES_PORTAL,
  PAGE_NOVEDADES,
  paginasVisibles,
  PORTAL_COLOR,
  PORTAL_LABEL,
  TIPO_ANUNCIO_LABEL,
  TIPOS_ANUNCIO,
  cuandoPublicado,
  diasEnPortal,
  euros,
  eurosM2,
  fotosAnuncio,
  parseFaseAnuncio,
  fuenteDesdeFila,
  labelFuentePortal,
  parseFuentePortal,
  pctBajada,
  publicadoEsCarga,
  tagsConEstilo,
  type AlertaCaptacion,
  type AnuncioCaptacion,
  type FaseKanban,
  type FuentePortal,
} from "@/lib/captacion/portales/modelo";
import { AccionesContactoAnuncio } from "@/components/captacion/portales/AccionesContactoAnuncio";
import { anuncioIdealistaVacio } from "@/lib/captacion/brightdata/idealista";
import { cn } from "@/lib/utils";

type Tab = "nov" | "seg" | "ale" | "not";
type ChipNov = "todas" | "hoy" | "sinasig" | "mias" | "bajada" | "edif";
type Actividad = { id: string; cuando: string; texto: string; tipo: string };
type Notif = { id: string; tipo: string; titulo: string; detalle: string | null; leida: boolean; created_at: string };
type Prefs = { nuevos: boolean; bajada: boolean; retirado: boolean; telefono_repite: boolean; sin_mover: boolean };

const PREF_LABELS: Array<{ key: keyof Prefs; label: string }> = [
  { key: "nuevos", label: "Entren anuncios nuevos en mis alertas" },
  { key: "bajada", label: "Baje el precio de un anuncio en seguimiento" },
  { key: "retirado", label: "Un anuncio en seguimiento se retire del portal" },
  { key: "telefono_repite", label: "Un teléfono aparezca en 3+ anuncios" },
  { key: "sin_mover", label: "Lleve 5 días sin mover un anuncio" },
];

function filaAnuncio(row: Record<string, unknown>): AnuncioCaptacion {
  return {
    id: String(row.id),
    fuente: fuenteDesdeFila(row),
    externo_id: String(row.externo_id),
    url: typeof row.url === "string" ? row.url : null,
    titulo: normalizarTexto(String(row.titulo ?? "")) ?? "",
    descripcion: typeof row.descripcion === "string" ? normalizarTexto(row.descripcion) : null,
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
    direccion: typeof row.direccion === "string" ? normalizarTexto(row.direccion) : null,
    zona: typeof row.zona === "string" ? normalizarTexto(row.zona) : null,
    municipio: typeof row.municipio === "string" ? normalizarTexto(row.municipio) : null,
    codigo_postal: typeof row.codigo_postal === "string" ? row.codigo_postal : null,
    lat: typeof row.lat === "number" ? row.lat : null,
    lng: typeof row.lng === "number" ? row.lng : null,
    thumb: typeof row.thumb === "string" ? row.thumb : null,
    n_fotos: row.n_fotos == null ? null : Number(row.n_fotos),
    fotos: fotosAnuncio(row.fotos),
    contacto_nombre: typeof row.contacto_nombre === "string" ? normalizarTexto(row.contacto_nombre) : null,
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

function portadaDe(a: { thumb: string | null; fotos?: string[] }): string | null {
  return a.thumb || a.fotos?.[0] || null;
}

function FotoPortal({ src, className }: { src: string | null | undefined; className?: string }) {
  if (!src) return null;
  return <img src={src} alt="" referrerPolicy="no-referrer" className={className ?? "h-full w-full object-cover"} />;
}

function filaAlerta(row: Record<string, unknown>): AlertaCaptacion {
  return {
    id: String(row.id),
    nombre: String(row.nombre),
    portales: ((row.portales as unknown[]) ?? []).map(parseFuentePortal).filter((p): p is FuentePortal => Boolean(p)),
    zonas: (row.zonas as string[]) ?? [],
    center_lat: typeof row.center_lat === "number" ? row.center_lat : null,
    center_lng: typeof row.center_lng === "number" ? row.center_lng : null,
    radio_m: typeof row.radio_m === "number" ? row.radio_m : 15000,
    operacion: row.operacion === "alquiler" ? "alquiler" : "venta",
    tipo: typeof row.tipo === "string" ? row.tipo : null,
    precio_max: row.precio_max == null ? null : Number(row.precio_max),
    m2_min: row.m2_min == null ? null : Number(row.m2_min),
    solo_particulares: Boolean(row.solo_particulares),
    frecuencia: row.frecuencia === "hora" || row.frecuencia === "6h" ? row.frecuencia : "diaria",
    activa: Boolean(row.activa),
    comercial_id: typeof row.comercial_id === "string" ? row.comercial_id : null,
    created_by: String(row.created_by),
    last_sync_at: typeof row.last_sync_at === "string" ? row.last_sync_at : null,
  };
}

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors"
      style={{ background: on ? "#0B7461" : "#CFCBC2" }}
      aria-pressed={on}
    >
      <span
        className="absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow"
        style={{ left: on ? 18 : 2 }}
      />
    </button>
  );
}

export function CaptacionPortales() {
  const { user } = useAuth();
  const admin = isAdmin(user?.role);
  const [tab, setTab] = useState<Tab>("nov");
  const [q, setQ] = useState("");
  const [fAlerta, setFAlerta] = useState("todas");
  const [fCiudad, setFCiudad] = useState("todas");
  const [chip, setChip] = useState<ChipNov>("todas");
  const [orden, setOrden] = useState("anadido");
  const [pag, setPag] = useState(1);
  const [mas, setMas] = useState(false);
  const [mapa, setMapa] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [panel, setPanel] = useState(false);
  const [checks, setChecks] = useState<string[]>([]);
  const [anuncios, setAnuncios] = useState<AnuncioCaptacion[]>([]);
  const [nVacios, setNVacios] = useState(0);
  const [alertas, setAlertas] = useState<AlertaCaptacion[]>([]);
  const [actividad, setActividad] = useState<Actividad[]>([]);
  const [actividadTick, setActividadTick] = useState(0);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [prefs, setPrefs] = useState<Prefs>({ nuevos: true, bajada: true, retirado: true, telefono_repite: false, sin_mover: true });
  const [comerciales, setComerciales] = useState<ComercialFiltro[]>([]);
  const [filtroCom, setFiltroCom] = useState("");
  const [alertaOpen, setAlertaOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [wide, setWide] = useState(true);
  const [compact, setCompact] = useState(false);
  const [filtros, setFiltros] = useState({
    precioMin: "",
    precioMax: "",
    m2Min: "",
    m2Max: "",
    portal: "todos",
    tipo: "todos",
    anunciante: "particular",
  });
  const [draftAlerta, setDraftAlerta] = useState({
    nombre: "",
    portales: ["habitaclia"] as FuentePortal[],
    zonas: "",
    operacion: "venta" as "venta" | "alquiler",
    tipo: "",
    precioMax: "",
    m2Min: "",
    soloParticulares: true,
    frecuencia: "diaria" as "hora" | "6h" | "diaria",
    comercialId: "",
  });

  const cargar = () => {
    const supabase = createClient();
    void Promise.all([
      supabase.from("captacion_anuncios").select("*").order("visto_en", { ascending: false }),
      supabase.from("captacion_alertas").select("*").order("created_at", { ascending: false }),
      supabase.from("captacion_notificaciones").select("*").eq("user_id", user?.id ?? "").order("created_at", { ascending: false }).limit(40),
      supabase.from("captacion_notif_prefs").select("*").eq("user_id", user?.id ?? "").maybeSingle(),
      supabase.from("profiles").select("id, nombre_completo, color, email, role").eq("activo", true),
    ]).then(([a, al, n, p, c]) => {
      const filas = ((a.data ?? []) as Record<string, unknown>[]).map(filaAnuncio);
      // Las fichas de Idealista que llegaron sin datos se apartan hasta que se completen.
      const vacios = filas.filter((f) => f.fuente === "idealista" && f.fase === "novedad" && anuncioIdealistaVacio(f));
      setNVacios(vacios.length);
      setAnuncios(filas.filter((f) => !vacios.includes(f)));
      setAlertas(((al.data ?? []) as Record<string, unknown>[]).map(filaAlerta));
      setNotifs((n.data ?? []) as Notif[]);
      if (p.data) {
        setPrefs({
          nuevos: Boolean(p.data.nuevos),
          bajada: Boolean(p.data.bajada),
          retirado: Boolean(p.data.retirado),
          telefono_repite: Boolean(p.data.telefono_repite),
          sin_mover: Boolean(p.data.sin_mover),
        });
      }
      setComerciales(
        ((c.data ?? []) as Array<{ id: string; nombre_completo: string | null; color: string | null; email: string | null; role: string }>)
          .filter((row) => row.role !== "editor")
          .map((row) => ({
            id: row.id,
            nombre: nombreYApellido(row.nombre_completo, row.email) || row.email || "—",
            color: row.color,
          }))
      );
    });
  };

  useEffect(() => {
    if (!user) return;
    cargar();
    const mq = window.matchMedia("(min-width: 1000px)");
    const mqPhone = window.matchMedia("(max-width: 819px)");
    const sync = () => {
      setWide(mq.matches);
      setCompact(mqPhone.matches);
    };
    sync();
    mq.addEventListener("change", sync);
    mqPhone.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
      mqPhone.removeEventListener("change", sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!sel) {
      setActividad([]);
      return;
    }
    const supabase = createClient();
    void supabase
      .from("captacion_anuncios_actividad")
      .select("id, detalle, created_at, tipo")
      .eq("anuncio_id", sel)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setActividad(
          ((data ?? []) as Array<{ id: string; detalle: string | null; created_at: string; tipo: string }>).map((row) => ({
            id: row.id,
            tipo: row.tipo,
            texto: row.detalle ?? "",
            cuando: cuandoPublicado(row.created_at),
          }))
        );
      });
  }, [sel, actividadTick]);

  const recuentoClave = useMemo(() => recuentoPorClave(anuncios), [anuncios]);

  const nov = anuncios.filter((a) => a.fase === "novedad");
  const seg = anuncios.filter(
    (a) => !["novedad", "descartado"].includes(a.fase) && (!filtroCom || a.comercial_id === filtroCom)
  );

  const listado = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = nov.filter((a) => {
      if (query && ![a.titulo, a.zona, a.municipio, a.contacto_nombre, a.externo_id].filter(Boolean).join(" ").toLowerCase().includes(query)) return false;
      if (fAlerta !== "todas" && a.alerta_id !== fAlerta) return false;
      if (fCiudad !== "todas" && !(a.municipio ?? "").startsWith(fCiudad)) return false;
      if (filtros.portal !== "todos" && a.fuente !== filtros.portal) return false;
      if (filtros.tipo !== "todos" && a.tipo !== filtros.tipo) return false;
      if (filtros.anunciante === "particular" && a.anunciante !== "particular") return false;
      const pmin = Number(filtros.precioMin);
      const pmax = Number(filtros.precioMax);
      if (filtros.precioMin && (a.precio == null || a.precio < pmin)) return false;
      if (filtros.precioMax && (a.precio == null || a.precio > pmax)) return false;
      const smin = Number(filtros.m2Min);
      const smax = Number(filtros.m2Max);
      if (filtros.m2Min && (a.superficie == null || a.superficie < smin)) return false;
      if (filtros.m2Max && (a.superficie == null || a.superficie > smax)) return false;
      if (chip === "hoy" && diasEnPortal(a.publicado_en) !== 0) return false;
      if (chip === "sinasig" && a.comercial_id) return false;
      if (chip === "mias" && (admin ? !a.comercial_id : a.comercial_id !== user?.id)) return false;
      if (chip === "bajada" && !a.tags.includes("Bajada")) return false;
      if (chip === "edif" && a.tipo !== "edificio" && a.tipo !== "casa") return false;
      return true;
    });
    list = list.slice().sort((a, b) => {
      if (orden === "precio") return (a.precio ?? 0) - (b.precio ?? 0);
      if (orden === "pm2") return (a.precio ?? 0) / Math.max(a.superficie ?? 1, 1) - (b.precio ?? 0) / Math.max(b.superficie ?? 1, 1);
      if (orden === "m2") return (b.superficie ?? 0) - (a.superficie ?? 0);
      return diasEnPortal(a.publicado_en) - diasEnPortal(b.publicado_en);
    });
    return list;
  }, [nov, q, fAlerta, fCiudad, filtros, chip, orden, admin, user?.id]);

  const nPag = Math.max(1, Math.ceil(listado.length / PAGE_NOVEDADES));
  const pagina = Math.min(pag, nPag);
  const page = listado.slice((pagina - 1) * PAGE_NOVEDADES, pagina * PAGE_NOVEDADES);
  const seleccionado = anuncios.find((a) => a.id === sel) ?? page[0] ?? null;
  const ultima = anuncios.reduce((acc, a) => (a.visto_en > acc ? a.visto_en : acc), "");

  const patchAnuncio = async (ids: string[], patch: Record<string, unknown>, detalle?: string, tipo = "fase") => {
    const supabase = createClient();
    const { error } = await supabase.from("captacion_anuncios").update({ ...patch, updated_at: new Date().toISOString() }).in("id", ids);
    if (error) {
      toast.error("No se ha podido actualizar.");
      return;
    }
    if (detalle) {
      await supabase.from("captacion_anuncios_actividad").insert(
        ids.map((id) => ({ anuncio_id: id, actor_id: user?.id, tipo, detalle }))
      );
    }
    setAnuncios((prev) => prev.map((a) => (ids.includes(a.id) ? { ...a, ...patch } as AnuncioCaptacion : a)));
    setChecks([]);
  };

  const seguir = (ids: string[]) => {
    void patchAnuncio(
      ids,
      { fase: "contacto", comercial_id: anuncios.find((a) => ids.includes(a.id))?.comercial_id || user?.id, proxima_accion: "Llamar" },
      `Pasado a seguimiento por ${nombreYApellido(user?.nombre, user?.email) || "ti"}`
    );
    toast.success("En seguimiento.");
  };

  const quitarSeguimiento = (ids: string[]) => {
    void patchAnuncio(
      ids,
      { fase: "novedad", proxima_accion: null },
      `Fuera de seguimiento por ${nombreYApellido(user?.nombre, user?.email) || "ti"}`
    );
    toast.success("Fuera de seguimiento. Vuelve a Novedades.");
  };

  const captar = async (anuncio: AnuncioCaptacion) => {
    if (!user) return;
    const res = await fetch(`/api/captacion/anuncios/${anuncio.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fase: "captado" }),
    });
    const json = (await res.json()) as {
      ok?: boolean;
      error?: string;
      convertido?: { referencia?: string; propiedadId?: string; clienteId?: string | null } | null;
    };
    if (!res.ok || !json.ok) {
      toast.error(json.error || "No se ha podido crear el inmueble.");
      return;
    }
    const ref = json.convertido?.referencia;
    setAnuncios((prev) =>
      prev.map((a) =>
        a.id === anuncio.id
          ? {
              ...a,
              fase: "captado",
              propiedad_id: json.convertido?.propiedadId ?? a.propiedad_id,
              cliente_id: json.convertido?.clienteId ?? a.cliente_id,
              proxima_accion: null,
            }
          : a
      )
    );
    cargar();
    toast.success(ref ? `Captado como ${ref}.` : "Captado como inmueble.");
  };

  const anotar = async (id: string, nota: string) => {
    const texto = nota.trim();
    if (!texto) return;
    const res = await fetch(`/api/captacion/anuncios/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nota: texto }),
    });
    if (!res.ok) {
      toast.error("No se ha podido guardar la nota.");
      return;
    }
    toast.success("Nota guardada.");
    setSel(id);
    const supabase = createClient();
    const { data } = await supabase
      .from("captacion_anuncios_actividad")
      .select("id, detalle, created_at, tipo")
      .eq("anuncio_id", id)
      .order("created_at", { ascending: true });
    setActividad(
      ((data ?? []) as Array<{ id: string; detalle: string | null; created_at: string; tipo: string }>).map((row) => ({
        id: row.id,
        cuando: cuandoPublicado(row.created_at),
        texto: row.detalle ?? row.tipo,
        tipo: row.tipo,
      }))
    );
  };

  const moverFase = async (id: string, fase: FaseKanban) => {
    const anuncio = anuncios.find((a) => a.id === id);
    if (!anuncio) return;
    if (fase === "captado") {
      await captar(anuncio);
      return;
    }
    const meta = FASE_KANBAN_META.find((f) => f.id === fase);
    await patchAnuncio([id], { fase }, `Movido a ${meta?.label ?? fase}`);
  };

  const refrescar = async () => {
    setSyncing(true);
    const res = await fetch("/api/captacion/brightdata/trigger", { method: "POST" });
    const json = (await res.json()) as { ok?: boolean; error?: string; zonas?: number };
    setSyncing(false);
    if (!res.ok || !json.ok) {
      toast.error(json.error || "No se ha podido lanzar Idealista.");
      return;
    }
    const zonas = json.zonas ?? 1;
    toast.success(
      `Idealista en marcha para ${zonas} ${zonas === 1 ? "zona" : "zonas"}. Los anuncios entran en el CRM de 20 en 20.`
    );
  };

  const nSinTelefono = anuncios.filter(
    (a) => a.fuente === "idealista" && !a.contacto_telefono && !["captado", "descartado"].includes(a.fase)
  ).length;
  const nPendientes = nVacios + nSinTelefono;

  const completarVacios = async () => {
    const aviso =
      `Se van a pedir otra vez ${nPendientes} fichas a Bright Data` +
      ` (${nVacios} vacías y ${nSinTelefono} sin teléfono). Cada ficha gasta créditos. ¿Seguir?`;
    if (!window.confirm(aviso)) return;
    setSyncing(true);
    const res = await fetch("/api/captacion/brightdata/completar", { method: "POST" });
    const json = (await res.json()) as { ok?: boolean; error?: string; fichas?: number; vacias?: number; sinTelefono?: number };
    setSyncing(false);
    if (!res.ok || !json.ok) {
      toast.error(json.error || "No se han podido pedir las fichas.");
      return;
    }
    if (!json.fichas) {
      toast.message("No hay fichas que completar.");
      return;
    }
    toast.success(
      `Pedidas ${json.fichas} fichas: ${json.vacias ?? 0} vacías y ${json.sinTelefono ?? 0} sin teléfono. Irán entrando de 20 en 20.`
    );
  };

  const cargarRecogida = async () => {
    setSyncing(true);
    toast.loading("Cargando anuncios…", { id: "recogida" });
    let desde = 0;
    let nuevos = 0;
    let actualizados = 0;
    let errores = 0;
    try {
      for (let vuelta = 0; vuelta < 200; vuelta += 1) {
        const res = await fetch("/api/captacion/brightdata/importar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: "j_mue12jm92i4iigvxps", desde }),
        });
        const json = (await res.json()) as {
          ok?: boolean;
          error?: string;
          pendiente?: boolean;
          nuevos?: number;
          actualizados?: number;
          errores?: string[];
          total?: number;
          siguiente?: number;
          queda?: number;
        };
        if (!res.ok) {
          toast.error(json.error || "No se ha podido cargar la recogida.", { id: "recogida" });
          return;
        }
        if (json.pendiente) {
          toast.message("Bright Data sigue recogiendo. Prueba otra vez en unos minutos.", { id: "recogida" });
          return;
        }
        nuevos += json.nuevos ?? 0;
        actualizados += json.actualizados ?? 0;
        errores += json.errores?.length ?? 0;
        const siguiente = json.siguiente ?? desde;
        const queda = json.queda ?? 0;
        if (queda <= 0) break;
        if (siguiente <= desde) {
          toast.error("La carga no avanza.", { id: "recogida" });
          return;
        }
        desde = siguiente;
        toast.loading(`Guardados ${desde} de ${json.total ?? desde}…`, { id: "recogida" });
      }
      const aviso = errores > 0 ? ` ${errores} no se han podido guardar.` : "";
      toast.success(`Cargados ${nuevos} anuncios nuevos y ${actualizados} actualizados.${aviso}`, { id: "recogida" });
      cargar();
    } catch {
      toast.error("No se ha podido cargar la recogida.", { id: "recogida" });
    } finally {
      setSyncing(false);
    }
  };

  const crearAlerta = async () => {
    if (!user || !draftAlerta.nombre.trim()) {
      toast.error("Pon un nombre a la alerta.");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from("captacion_alertas").insert({
      nombre: draftAlerta.nombre.trim(),
      portales: draftAlerta.portales,
      zonas: draftAlerta.zonas.split(",").map((z) => z.trim()).filter(Boolean),
      operacion: draftAlerta.operacion,
      tipo: draftAlerta.tipo || null,
      precio_max: draftAlerta.precioMax ? Number(draftAlerta.precioMax) : null,
      m2_min: draftAlerta.m2Min ? Number(draftAlerta.m2Min) : null,
      solo_particulares: draftAlerta.soloParticulares,
      frecuencia: draftAlerta.frecuencia,
      comercial_id: draftAlerta.comercialId || (admin ? null : user.id),
      created_by: user.id,
    });
    if (error) {
      toast.error("No se ha podido crear la alerta.");
      return;
    }
    setAlertaOpen(false);
    toast.success("Alerta creada. Actualiza para traer anuncios.");
    cargar();
  };

  const togglePref = async (key: keyof Prefs) => {
    if (!user) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    const supabase = createClient();
    await supabase.from("captacion_notif_prefs").upsert({ user_id: user.id, ...next, updated_at: new Date().toISOString() });
  };

  const kpis = [
    { valor: nov.filter((a) => diasEnPortal(a.publicado_en) === 0).length, label: "Nuevos hoy", chip: "hoy" as ChipNov, fg: "#131C1A" },
    { valor: nov.filter((a) => !a.comercial_id).length, label: "Sin asignar", chip: "sinasig" as ChipNov, fg: nov.some((a) => !a.comercial_id) ? "#7A5A10" : "#131C1A" },
    { valor: nov.filter((a) => a.tags.includes("Bajada")).length, label: "Bajadas de precio", chip: "bajada" as ChipNov, fg: "#0B7461" },
    { valor: seg.filter((a) => a.fase !== "captado" && a.fase !== "perdido").length, label: "En seguimiento", chip: "todas" as ChipNov, fg: "#131C1A" },
  ];
  const chips: Array<[ChipNov, string, number]> = [
    ["todas", "Todas", nov.length],
    ["hoy", "Hoy", nov.filter((a) => diasEnPortal(a.publicado_en) === 0).length],
    ["sinasig", "Sin asignar", nov.filter((a) => !a.comercial_id).length],
    ["mias", admin ? "Asignadas" : "Mías", nov.filter((a) => (admin ? Boolean(a.comercial_id) : a.comercial_id === user?.id)).length],
    ["bajada", "Bajadas", nov.filter((a) => a.tags.includes("Bajada")).length],
    ["edif", "Edificios y casas", nov.filter((a) => a.tipo === "edificio" || a.tipo === "casa").length],
  ];
  const portalChips = useMemo(() => {
    let base = nov;
    if (fAlerta !== "todas") base = base.filter((a) => a.alerta_id === fAlerta);
    if (fCiudad !== "todas") base = base.filter((a) => (a.municipio ?? "").startsWith(fCiudad));
    return FUENTES_PORTAL.map((p) => ({
      id: p,
      label: PORTAL_LABEL[p] ?? p,
      n: base.filter((a) => a.fuente === p).length,
    })).filter((c) => c.n > 0);
  }, [nov, fAlerta, fCiudad]);
  const tabs: Array<[Tab, string, number]> = [
    ["nov", "Novedades", nov.length],
    ["seg", "Seguimiento", seg.length],
    ["ale", "Alertas", alertas.filter((a) => a.activa).length],
    ["not", "Notificaciones", notifs.filter((n) => !n.leida).length],
  ];
  const nFiltros = (fAlerta !== "todas" ? 1 : 0) + (fCiudad !== "todas" ? 1 : 0);
  const comercialDe = (id: string | null) => comerciales.find((c) => c.id === id);
  const cols = wide
    ? "16px minmax(0,2.6fr) 104px 60px 72px 130px 140px 132px"
    : compact
      ? undefined
      : "16px minmax(0,1fr) 100px 72px 104px";

  const pins = (() => {
    const conGeo = listado.filter((a) => a.lat != null && a.lng != null);
    if (conGeo.length === 0) return [];
    const lats = conGeo.map((a) => a.lat as number);
    const lngs = conGeo.map((a) => a.lng as number);
    const minLa = Math.min(...lats);
    const maxLa = Math.max(...lats);
    const minLo = Math.min(...lngs);
    const maxLo = Math.max(...lngs);
    return conGeo.map((a) => ({
      id: a.id,
      x: maxLo === minLo ? 50 : (((a.lng as number) - minLo) / (maxLo - minLo)) * 80 + 10,
      y: maxLa === minLa ? 50 : (1 - ((a.lat as number) - minLa) / (maxLa - minLa)) * 70 + 12,
      precio: a.operacion === "alquiler" ? `${Math.round((a.precio ?? 0) / 100) / 10}k/m` : `${Math.round((a.precio ?? 0) / 1000)}k`,
    }));
  })();

  return (
    <div className="min-w-0 max-w-full">
      <div className="mb-3.5 flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] min-[820px]:text-[28px]">Captación</h1>
          <p className="mt-1.5 text-[13.5px] text-[var(--text-2)]">Anuncios de particulares en portales. Lo que entra hoy y lo que estás trabajando.</p>
        </div>
        <div className="flex items-center gap-2 text-[12.5px] text-[var(--text-2)]">
          <span className="h-2 w-2 rounded-full bg-accent" />
          Última actualización {ultima ? cuandoPublicado(ultima) : "—"}
          {admin ? (
            <>
              <button
                type="button"
                onClick={() => void cargarRecogida()}
                disabled={syncing}
                className="h-8 rounded-lg border border-[var(--input)] bg-white px-2.5 text-[12.5px] font-semibold hover:border-accent hover:text-accent disabled:opacity-60"
              >
                {syncing ? "Cargando…" : "Cargar recogida"}
              </button>
              {nPendientes > 0 ? (
                <button
                  type="button"
                  onClick={() => void completarVacios()}
                  disabled={syncing}
                  title={`${nVacios} vacías y ${nSinTelefono} sin teléfono. Se piden otra vez a Bright Data; las completas no.`}
                  className="h-8 rounded-lg border border-[var(--input)] bg-white px-2.5 text-[12.5px] font-semibold hover:border-accent hover:text-accent disabled:opacity-60"
                >
                  {syncing ? "Pidiendo…" : `Completar ${nPendientes} fichas`}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void refrescar()}
                disabled={syncing}
                className="h-8 rounded-lg border border-[var(--input)] bg-white px-2.5 text-[12.5px] font-semibold hover:border-accent hover:text-accent disabled:opacity-60"
              >
                {syncing ? "Lanzando…" : "Traer Idealista"}
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => setAlertaOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-[9px] bg-accent px-3 text-[13.5px] font-semibold text-white hover:bg-accent-dark"
          >
            + Nueva alerta
          </button>
        </div>
      </div>

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-[var(--border)]">
        {tabs.map(([id, label, n]) => {
          const on = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTab(id);
                setPanel(false);
              }}
              className={cn(
                "mb-[-1px] flex h-10 items-center gap-1.5 whitespace-nowrap px-3 text-[13.5px]",
                on ? "border-b-2 border-accent font-semibold text-accent" : "font-medium text-[var(--text-2)]"
              )}
            >
              {label}
              {n > 0 ? (
                <span className={cn("rounded-full px-1.5 py-px text-[11px] font-semibold", on ? "bg-accent text-white" : "bg-[#F2F1EC] text-[var(--text-2)]")}>
                  {n}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === "nov" ? (
        <>
          <div className="mb-3.5 grid grid-cols-2 gap-2.5 min-[720px]:grid-cols-4">
            {kpis.map((k) => (
              <button
                key={k.label}
                type="button"
                onClick={() => {
                  setChip(k.chip);
                  setPag(1);
                  if (k.label === "En seguimiento") setTab("seg");
                }}
                className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-left hover:border-accent"
              >
                <div className="text-2xl font-semibold tabular-nums tracking-[-0.02em]" style={{ color: k.fg }}>{k.valor}</div>
                <div className="mt-0.5 text-[12.5px] text-[var(--text-2)]">{k.label}</div>
              </button>
            ))}
          </div>

          <section className="min-w-0 max-w-full overflow-hidden rounded-[14px] border border-[var(--border)] bg-white">
            <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-soft)] px-3.5 py-3">
              <div className="flex h-9 min-w-0 flex-[1_1_200px] items-center gap-2 rounded-[9px] border border-[var(--input)] px-2.5">
                <input
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPag(1);
                  }}
                  placeholder="Dirección, zona, contacto o id del anuncio"
                  className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none"
                />
              </div>
              <select value={fAlerta} onChange={(e) => { setFAlerta(e.target.value); setPag(1); }} className="h-9 max-w-[220px] rounded-[9px] border border-[var(--input)] bg-white px-2.5 text-[13px]">
                <option value="todas">Alerta: todas</option>
                {alertas.map((a) => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
              <select value={fCiudad} onChange={(e) => { setFCiudad(e.target.value); setPag(1); }} className="h-9 rounded-[9px] border border-[var(--input)] bg-white px-2.5 text-[13px]">
                <option value="todas">Ciudad: todas</option>
                {CIUDADES_FILTRO.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <button type="button" onClick={() => setMas((v) => !v)} className={cn("flex h-9 items-center gap-1.5 rounded-[9px] border px-2.5 text-[13px] font-medium", mas ? "border-accent bg-accent-soft text-accent-dark" : "border-[var(--input)] bg-white")}>
                Más filtros{nFiltros ? <span className="rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white">{nFiltros}</span> : null}
              </button>
              <button type="button" onClick={() => setMapa((v) => !v)} className={cn("hidden h-9 items-center gap-1.5 rounded-[9px] border px-2.5 text-[13px] font-medium min-[820px]:flex", mapa ? "border-accent bg-accent-soft text-accent-dark" : "border-[var(--input)] bg-white")}>
                Mapa
              </button>
            </div>
            {mas ? (
              <div className="grid grid-cols-2 gap-2.5 border-b border-[var(--border-soft)] bg-[var(--surface-soft)] px-3.5 py-3 min-[820px]:grid-cols-6">
                <label className="block text-[11px] uppercase tracking-[0.06em] text-[var(--label)]">Precio
                  <span className="mt-1 flex gap-1.5"><input placeholder="mín" value={filtros.precioMin} onChange={(e) => setFiltros((f) => ({ ...f, precioMin: e.target.value }))} className="h-[34px] w-1/2 rounded-lg border border-[var(--input)] px-2 text-[13px]" /><input placeholder="máx" value={filtros.precioMax} onChange={(e) => setFiltros((f) => ({ ...f, precioMax: e.target.value }))} className="h-[34px] w-1/2 rounded-lg border border-[var(--input)] px-2 text-[13px]" /></span>
                </label>
                <label className="block text-[11px] uppercase tracking-[0.06em] text-[var(--label)]">Metros
                  <span className="mt-1 flex gap-1.5"><input placeholder="mín" value={filtros.m2Min} onChange={(e) => setFiltros((f) => ({ ...f, m2Min: e.target.value }))} className="h-[34px] w-1/2 rounded-lg border border-[var(--input)] px-2 text-[13px]" /><input placeholder="máx" value={filtros.m2Max} onChange={(e) => setFiltros((f) => ({ ...f, m2Max: e.target.value }))} className="h-[34px] w-1/2 rounded-lg border border-[var(--input)] px-2 text-[13px]" /></span>
                </label>
                <label className="block text-[11px] uppercase tracking-[0.06em] text-[var(--label)]">Portal
                  <select value={filtros.portal} onChange={(e) => setFiltros((f) => ({ ...f, portal: e.target.value }))} className="mt-1 h-[34px] w-full rounded-lg border border-[var(--input)] bg-white px-2 text-[13px]"><option value="todos">Todos</option>{FUENTES_PORTAL.map((p) => <option key={p} value={p}>{PORTAL_LABEL[p]}</option>)}</select>
                </label>
                <label className="block text-[11px] uppercase tracking-[0.06em] text-[var(--label)]">Tipo
                  <select value={filtros.tipo} onChange={(e) => setFiltros((f) => ({ ...f, tipo: e.target.value }))} className="mt-1 h-[34px] w-full rounded-lg border border-[var(--input)] bg-white px-2 text-[13px]"><option value="todos">Todos</option>{TIPOS_ANUNCIO.map((t) => <option key={t} value={t}>{TIPO_ANUNCIO_LABEL[t]}</option>)}</select>
                </label>
                <label className="block text-[11px] uppercase tracking-[0.06em] text-[var(--label)]">Anuncio
                  <select value={filtros.anunciante} onChange={(e) => setFiltros((f) => ({ ...f, anunciante: e.target.value }))} className="mt-1 h-[34px] w-full rounded-lg border border-[var(--input)] bg-white px-2 text-[13px]"><option value="particular">Particular</option><option value="todos">Todos</option></select>
                </label>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--border-soft)] px-3.5 py-2.5">
              {chips.map(([id, label, n]) => (
                <button key={id} type="button" onClick={() => { setChip(id); setPag(1); }} className={cn("h-[30px] rounded-full border px-2.5 text-[12.5px] font-medium", chip === id ? "border-accent bg-accent-soft text-accent-dark" : "border-[var(--border)] bg-white text-[var(--text-2)]")}>
                  {label} <span className="opacity-60">{n}</span>
                </button>
              ))}
              <div className="flex-1" />
              <select value={orden} onChange={(e) => setOrden(e.target.value)} className="h-[30px] rounded-lg bg-[#F4F3EF] px-2 text-[12.5px] text-[var(--text-2)]">
                <option value="anadido">Más recientes</option>
                <option value="precio">Precio ↑</option>
                <option value="pm2">€/m² ↑</option>
                <option value="m2">m² ↓</option>
              </select>
            </div>
            {portalChips.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--border-soft)] px-3.5 py-2">
                {portalChips.map(({ id, label, n }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setFiltros((f) => ({ ...f, portal: f.portal === id ? "todos" : id }));
                      setPag(1);
                    }}
                    className={cn(
                      "h-[30px] rounded-full border px-2.5 text-[12.5px] font-medium",
                      filtros.portal === id
                        ? "border-accent bg-accent-soft text-accent-dark"
                        : "border-[var(--border)] bg-white text-[var(--text-2)]"
                    )}
                  >
                    {label} <span className="opacity-60">{n}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {mapa ? (
              <div className="relative h-[260px] overflow-hidden border-b border-[var(--border-soft)] bg-[#E9ECE8]">
                {pins.map((p) => (
                  <button key={p.id} type="button" onClick={() => { setSel(p.id); setPanel(true); }} className="absolute -translate-x-1/2 -translate-y-full rounded-full border px-2 text-[11.5px] font-semibold shadow" style={{ left: `${p.x}%`, top: `${p.y}%`, background: sel === p.id ? "#0B7461" : "#fff", color: sel === p.id ? "#fff" : "#131C1A", borderColor: sel === p.id ? "#0B7461" : "#DAD6CE" }}>{p.precio}</button>
                ))}
                <div className="absolute bottom-2.5 left-3 rounded-md bg-white/90 px-2 py-0.5 text-[11px] text-[var(--text-2)]">Mapa de anuncios</div>
              </div>
            ) : null}
            {checks.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 border-b border-[#CDE9E1] bg-accent-soft px-3.5 py-2">
                <span className="text-[13px] font-semibold text-accent-dark">{checks.length} seleccionados</span>
                <div className="flex-1" />
                {comerciales.map((c) => (
                  <button key={c.id} type="button" title={`Asignar a ${c.nombre}`} onClick={() => void patchAnuncio(checks, { comercial_id: c.id }, `Asignado a ${c.nombre.split(" ")[0]}`, "asignacion")} className="grid h-7 w-7 place-items-center rounded-full text-[10px] font-semibold text-white" style={{ background: c.color ?? "#3A6A82" }}>{inicialesNombre(c.nombre)}</button>
                ))}
                <button type="button" onClick={() => seguir(checks)} className="h-[30px] rounded-lg bg-accent px-2.5 text-[12.5px] font-semibold text-white">Pasar a seguimiento</button>
                <button type="button" onClick={() => void patchAnuncio(checks, { fase: "descartado" }, "Descartado")} className="h-[30px] rounded-lg border border-[var(--input)] bg-white px-2.5 text-[12.5px] font-semibold">Descartar</button>
              </div>
            ) : null}
            <div className="hidden grid-cols-[16px_minmax(0,1fr)_100px_72px_104px] gap-3 border-b border-[var(--border-soft)] bg-[var(--surface-soft)] px-3.5 py-2 text-[11px] uppercase tracking-[0.06em] text-[var(--label)] min-[820px]:grid" style={cols ? { gridTemplateColumns: cols } : undefined}>
              <button type="button" onClick={() => setChecks(page.length && page.every((a) => checks.includes(a.id)) ? [] : page.map((a) => a.id))} className="h-4 w-4 rounded border" style={{ borderColor: page.length && page.every((a) => checks.includes(a.id)) ? "#0B7461" : "#CFCBC2", background: page.length && page.every((a) => checks.includes(a.id)) ? "#0B7461" : "#fff" }} />
              <div>Anuncio</div><div className="text-right">Precio</div>{wide ? <div className="text-right">m²</div> : null}<div className="text-right">€/m²</div>{wide ? <div>Contacto</div> : null}{wide ? <div>Zona</div> : null}<div />
            </div>
            {page.map((a) => {
              const com = comercialDe(a.comercial_id);
              const nRep = a.contacto_clave ? recuentoClave.get(a.contacto_clave) ?? 1 : 1;
              const on = sel === a.id;
              const ck = checks.includes(a.id);
              const bajada = pctBajada(a.precio_anterior, a.precio);
              const pm2 = eurosM2(a.precio, a.superficie, a.operacion === "alquiler");
              const barato = a.operacion !== "alquiler" && a.precio && a.superficie && a.precio / a.superficie < 1800;
              if (compact) {
                return (
                  <div
                    key={a.id}
                    onClick={() => {
                      setSel(a.id);
                      setPanel(true);
                    }}
                    className="flex cursor-pointer gap-3 border-b border-[var(--border-row)] px-3.5 py-3"
                    style={{ background: on ? "#F4F8F6" : "#fff", boxShadow: on ? "inset 3px 0 0 #0B7461" : undefined }}
                  >
                    <button
                      type="button"
                      aria-label={ck ? "Quitar selección" : "Seleccionar"}
                      onClick={(e) => {
                        e.stopPropagation();
                        setChecks((prev) => (ck ? prev.filter((x) => x !== a.id) : [...prev, a.id]));
                      }}
                      className="mt-1 grid h-11 w-11 shrink-0 place-items-center"
                    >
                      <span className="grid h-4 w-4 place-items-center rounded border" style={{ borderColor: ck ? "#0B7461" : "#CFCBC2", background: ck ? "#0B7461" : "#fff" }} />
                    </button>
                    <div className="relative h-[72px] w-[88px] shrink-0 overflow-hidden rounded-[8px] bg-[#E8E4DC]">
                      <FotoPortal src={portadaDe(a)} />
                      {diasEnPortal(a.publicado_en) === 0 ? <span className="absolute left-0 top-0 rounded-br bg-accent px-1 py-px text-[9px] font-bold tracking-wide text-white">NUEVO</span> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-2 text-[14px] font-semibold leading-snug">{a.titulo}</p>
                        <p className="shrink-0 text-right text-[14px] font-semibold tabular-nums">
                          {euros(a.precio, a.operacion === "alquiler")}
                          {bajada ? <span className="block text-[11px] font-medium text-accent">{bajada}</span> : null}
                        </p>
                      </div>
                      <p className="mt-1 truncate text-[12px] text-[var(--text-2)]">
                        {labelFuentePortal(a.fuente)}
                        {a.habitaciones ? ` · ${a.habitaciones} hab` : ""}
                        {a.superficie ? ` · ${a.superficie} m²` : ""}
                        {a.municipio ? ` · ${a.municipio}` : ""}
                      </p>
                      <div className="mt-2 flex items-center gap-1.5">
                        {com ? <AvatarComercial nombre={com.nombre} color={com.color} size={22} title={com.nombre} /> : null}
                        {a.url ? (
                          <a href={a.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="grid h-11 w-11 place-items-center rounded-lg border border-[var(--border)] text-[var(--text-2)]" title="Ver anuncio">↗</a>
                        ) : null}
                        <button type="button" title="Pasar a seguimiento" onClick={(e) => { e.stopPropagation(); seguir([a.id]); }} className="grid h-11 w-11 place-items-center rounded-lg border border-[var(--border)] text-accent">☆</button>
                        <button type="button" title="Descartar" onClick={(e) => { e.stopPropagation(); void patchAnuncio([a.id], { fase: "descartado" }, "Descartado"); }} className="grid h-11 w-11 place-items-center rounded-lg border border-[var(--border)] text-[var(--text-2)]">×</button>
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <div key={a.id} onClick={() => { setSel(a.id); setPanel(true); }} className="grid cursor-pointer items-center gap-3 border-b border-[var(--border-row)] px-3.5 py-2.5 hover:bg-[var(--surface-soft)]" style={{ gridTemplateColumns: cols, background: on ? "#F4F8F6" : "#fff", boxShadow: on ? "inset 3px 0 0 #0B7461" : undefined }}>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setChecks((prev) => (ck ? prev.filter((x) => x !== a.id) : [...prev, a.id])); }} className="grid h-4 w-4 place-items-center rounded border" style={{ borderColor: ck ? "#0B7461" : "#CFCBC2", background: ck ? "#0B7461" : "#fff" }} />
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="relative h-11 w-[60px] shrink-0 overflow-hidden rounded-[7px] bg-[#E8E4DC]">
                      <FotoPortal src={portadaDe(a)} />
                      {diasEnPortal(a.publicado_en) === 0 ? <span className="absolute left-0 top-0 rounded-br bg-accent px-1 py-px text-[9px] font-bold tracking-wide text-white">NUEVO</span> : null}
                    </div>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-[14px] font-semibold">{a.titulo}</span>
                        {tagsConEstilo(a.tags).map((t) => <span key={t.label} className="whitespace-nowrap rounded px-1.5 py-px text-[10.5px] font-semibold" style={{ background: t.bg, color: t.fg }}>{t.label}</span>)}
                        {!wide && nRep > 1 ? <span className="shrink-0 rounded border border-[#CDE9E1] px-1 text-[10.5px] font-semibold text-accent" title="Este contacto tiene más anuncios">×{nRep}</span> : null}
                      </div>
                      <div className="mt-0.5 flex gap-2 overflow-hidden text-[12px] text-[var(--text-2)]">
                        <span className="flex shrink-0 items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: PORTAL_COLOR[a.fuente] }} />{labelFuentePortal(a.fuente)}</span>
                        <span className="font-mono text-[11px]">{a.fuente.slice(0, 2)}.{a.externo_id}</span>
                        <span className="whitespace-nowrap">{a.tipo ? TIPO_ANUNCIO_LABEL[a.tipo as keyof typeof TIPO_ANUNCIO_LABEL] ?? a.tipo : "—"}{a.habitaciones ? ` · ${a.habitaciones} hab` : ""}{!wide && a.superficie ? ` · ${a.superficie} m²` : ""}</span>
                        <span className="whitespace-nowrap">{publicadoEsCarga(a.publicado_en, a.created_at) ? "Sin fecha del portal" : cuandoPublicado(a.publicado_en)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-[14px] font-semibold tabular-nums">{euros(a.precio, a.operacion === "alquiler")}{bajada ? <div className="text-[11px] font-medium text-accent">{bajada}</div> : null}</div>
                  {wide ? <div className="text-right text-[13.5px] tabular-nums">{a.superficie?.toLocaleString("es-ES") ?? "—"}</div> : null}
                  <div className="hidden text-right text-[13.5px] tabular-nums min-[820px]:block" style={{ color: barato ? "#0B7461" : undefined, fontWeight: barato ? 600 : 400 }}>{pm2}</div>
                  {wide ? (
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px]">{a.contacto_nombre || "—"}</div>
                      <div className="mt-px flex items-center gap-1 text-[11.5px] text-[var(--text-2)]">
                        {a.contacto_telefono ? <span className="font-mono">{a.contacto_telefono}</span> : null}
                        {nRep > 1 ? <span className="rounded border border-[#CDE9E1] px-1 text-[10.5px] font-semibold text-accent" title="Este contacto tiene más anuncios">×{nRep}</span> : null}
                      </div>
                    </div>
                  ) : null}
                  {wide ? <div className="min-w-0"><div className="truncate text-[13.5px]">{a.zona || "—"}</div><div className="mt-px text-[11.5px] text-[var(--text-2)]">{a.municipio}</div></div> : null}
                  <div className="flex items-center justify-end gap-1.5">
                    {com ? <AvatarComercial nombre={com.nombre} color={com.color} size={24} title={com.nombre} /> : null}
                    {a.url ? <a href={a.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="grid h-[30px] w-[30px] place-items-center rounded-lg border border-[var(--border)] text-[var(--text-2)] hover:border-accent hover:text-accent" title="Ver anuncio">↗</a> : null}
                    <button type="button" title="Pasar a seguimiento" onClick={(e) => { e.stopPropagation(); seguir([a.id]); }} className="grid h-[30px] w-[30px] place-items-center rounded-lg border border-[var(--border)] text-accent hover:bg-accent-soft">☆</button>
                    <button type="button" title="Descartar" onClick={(e) => { e.stopPropagation(); void patchAnuncio([a.id], { fase: "descartado" }, "Descartado"); }} className="grid h-[30px] w-[30px] place-items-center rounded-lg border border-[var(--border)] text-[var(--text-2)] hover:border-[#A33B2A] hover:bg-[#FBEAE5] hover:text-[#A33B2A]">×</button>
                  </div>
                </div>
              );
            })}
            {page.length === 0 ? <div className="m-5 rounded-[11px] border border-dashed border-[var(--input)] p-7 text-center text-[13.5px] text-[var(--text-2)]">Nada nuevo con estos filtros. Las alertas siguen vigilando.</div> : null}
            <div className="flex min-w-0 max-w-full flex-wrap items-center justify-between gap-2.5 px-3.5 py-2.5 text-[12.5px] text-[var(--text-2)]">
              <span className="shrink-0">{listado.length ? `${(pagina - 1) * PAGE_NOVEDADES + 1}–${Math.min(pagina * PAGE_NOVEDADES, listado.length)} de ${listado.length} anuncios` : "Sin anuncios"}</span>
              {nPag > 1 ? (
                <div className="flex min-w-0 max-w-full flex-wrap items-center justify-end gap-1">
                  <button type="button" disabled={pagina <= 1} onClick={() => setPag(pagina - 1)} className="h-8 rounded-lg border border-[#DAD6CE] bg-white px-2.5 text-[13px] font-semibold text-[#131C1A] disabled:opacity-40">Anterior</button>
                  {paginasVisibles(pagina, nPag).map((n, i) =>
                    n === "…" ? (
                      <span key={`puntos-${i}`} className="px-0.5 text-[13px] text-[var(--text-2)]">…</span>
                    ) : (
                      <button key={n} type="button" onClick={() => setPag(n)} className="h-8 min-w-8 rounded-lg border px-2 text-[13px] font-semibold" style={{ borderColor: n === pagina ? "#0B7461" : "#DAD6CE", background: n === pagina ? "#0B7461" : "#fff", color: n === pagina ? "#fff" : "#131C1A" }}>{n}</button>
                    )
                  )}
                  <button type="button" disabled={pagina >= nPag} onClick={() => setPag(pagina + 1)} className="h-8 rounded-lg border border-[#DAD6CE] bg-white px-2.5 text-[13px] font-semibold text-[#131C1A] disabled:opacity-40">Siguiente</button>
                </div>
              ) : null}
            </div>
          </section>
        </>
      ) : null}

      {tab === "seg" ? (
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
            <p className="m-0 text-[13.5px] text-[var(--text-2)]">Anuncios en los que estás trabajando. Arrastra para cambiar de fase; al captar, se convierte en inmueble.</p>
            {admin ? <FiltroComercial comerciales={comerciales} valor={filtroCom} onChange={setFiltroCom} /> : null}
          </div>
          <div className="flex items-start gap-3 overflow-x-auto pb-2.5">
            {FASE_KANBAN_META.map((f) => {
              const items = seg.filter((a) => a.fase === f.id);
              return (
                <div
                  key={f.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/plain");
                    if (id) void moverFase(id, f.id);
                  }}
                  className="min-h-[240px] w-[82vw] shrink-0 rounded-[14px] bg-[#F4F3EF] p-2.5 min-[820px]:w-[280px]"
                >
                  <div className="mb-2.5 flex items-center gap-2 px-1">
                    <span className="h-2 w-2 rounded-full" style={{ background: f.dot }} />
                    <span className="text-[13px] font-semibold">{f.label}</span>
                    <span className="text-[12px] text-[var(--text-3)]">{items.length}</span>
                    <span className="ml-auto text-[11.5px] text-[var(--text-3)]">{f.hint}</span>
                  </div>
                  {items.map((a) => {
                    const com = comercialDe(a.comercial_id);
                    return (
                      <div key={a.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", a.id)} onClick={() => { setSel(a.id); setPanel(true); }} className="mb-2 cursor-grab rounded-[11px] border border-[var(--border)] bg-white p-2.5 hover:border-accent">
                        <div className="flex gap-2.5">
                          <div className="h-[34px] w-11 shrink-0 overflow-hidden rounded-md bg-[#E8E4DC]"><FotoPortal src={portadaDe(a)} /></div>
                          <div className="min-w-0"><div className="text-[13.5px] font-semibold leading-snug">{a.titulo}</div><div className="mt-0.5 text-[11.5px] text-[var(--text-2)]">{a.zona} · {a.superficie ?? "—"} m²</div></div>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-[13px] font-semibold tabular-nums">{euros(a.precio, a.operacion === "alquiler")}</span>
                          <span className="text-[11.5px] text-[var(--text-2)]">{a.contacto_nombre}</span>
                          <div className="flex-1" />
                          {a.proxima_accion ? <span className="rounded-md bg-[#FBF0D8] px-1.5 py-0.5 text-[11px] font-medium text-[#7A5A10]">{a.proxima_accion}</span> : null}
                          {com ? <AvatarComercial nombre={com.nombre} color={com.color} size={22} /> : null}
                        </div>
                        {a.fase !== "captado" ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              quitarSeguimiento([a.id]);
                            }}
                            className="mt-2 h-7 w-full rounded-lg border border-[var(--border)] text-[12px] font-semibold text-[var(--text-2)] hover:border-[#A33B2A] hover:text-[#A33B2A]"
                          >
                            Quitar de seguimiento
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                  {items.length === 0 ? <div className="rounded-[10px] border border-dashed border-[var(--input)] px-2.5 py-4 text-center text-[12.5px] text-[var(--text-3)]">{f.vacia}</div> : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {tab === "ale" ? (
        <div>
          <p className="mb-3 text-[13.5px] text-[var(--text-2)]">Cada alerta es una búsqueda guardada en los portales. Lo que encuentra cae en Novedades.</p>
          <div className="grid grid-cols-1 gap-3 min-[720px]:grid-cols-2 min-[1100px]:grid-cols-3">
            {alertas.map((a) => {
              const com = comercialDe(a.comercial_id) ?? comercialDe(a.created_by);
              const hoy = nov.filter((n) => n.alerta_id === a.id && diasEnPortal(n.publicado_en) === 0).length;
              return (
                <div key={a.id} className="rounded-[13px] border border-[var(--border)] bg-white p-4" style={{ opacity: a.activa ? 1 : 0.6 }}>
                  <div className="flex items-start justify-between gap-2.5">
                    <div>
                      <div className="text-[15px] font-semibold">{a.nombre}</div>
                      <div className="mt-0.5 text-[12.5px] text-[var(--text-2)]">{a.portales.map((p) => PORTAL_LABEL[p]).join(" · ")} · {a.frecuencia === "hora" ? "Cada hora" : a.frecuencia === "6h" ? "Cada 6 h" : "Diaria"}</div>
                    </div>
                    <Switch on={a.activa} onClick={() => { const supabase = createClient(); void supabase.from("captacion_alertas").update({ activa: !a.activa }).eq("id", a.id); setAlertas((prev) => prev.map((x) => (x.id === a.id ? { ...x, activa: !x.activa } : x))); }} />
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {a.zonas.map((z) => <span key={z} className="rounded-md bg-[#F4F3EF] px-2 py-0.5 text-[11.5px] text-[var(--text-2)]">{z}</span>)}
                    {a.solo_particulares ? <span className="rounded-md bg-[#F4F3EF] px-2 py-0.5 text-[11.5px] text-[var(--text-2)]">particular</span> : null}
                    {a.precio_max ? <span className="rounded-md bg-[#F4F3EF] px-2 py-0.5 text-[11.5px] text-[var(--text-2)]">hasta {euros(a.precio_max)}</span> : null}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-[var(--border-soft)] pt-2.5 text-[12.5px]">
                    <div className="flex items-center gap-1.5 text-[var(--text-2)]">{com ? <AvatarComercial nombre={com.nombre} color={com.color} size={18} /> : null}{com?.nombre.split(" ")[0] ?? "—"}</div>
                    <div className="font-semibold" style={{ color: a.activa ? "#0B7461" : "#8A938F" }}>{a.activa ? `${hoy} hoy` : "Pausada"}</div>
                  </div>
                </div>
              );
            })}
            <button type="button" onClick={() => setAlertaOpen(true)} className="flex min-h-[150px] flex-col items-center justify-center gap-2 rounded-[13px] border border-dashed border-[var(--input)] p-3.5 text-[13.5px] font-medium text-[var(--text-2)] hover:border-accent hover:text-accent">+ Nueva alerta</button>
          </div>
        </div>
      ) : null}

      {tab === "not" ? (
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
            <p className="m-0 text-[13.5px] text-[var(--text-2)]">Qué ha pasado con tus alertas y tus anuncios en seguimiento.</p>
            <button type="button" onClick={() => { const supabase = createClient(); void supabase.from("captacion_notificaciones").update({ leida: true }).eq("user_id", user?.id ?? ""); setNotifs((prev) => prev.map((n) => ({ ...n, leida: true }))); }} className="h-8 rounded-lg border border-[var(--input)] bg-white px-2.5 text-[12.5px] font-semibold">Marcar todas como leídas</button>
          </div>
          <div className="flex flex-wrap items-start gap-4">
            <section className="min-w-0 flex-[1_1_480px] overflow-hidden rounded-[14px] border border-[var(--border)] bg-white">
              {notifs.length === 0 ? <div className="p-6 text-[13.5px] text-[var(--text-2)]">Aún no hay avisos.</div> : null}
              {notifs.map((n) => (
                <div key={n.id} className="flex items-start gap-3 border-b border-[var(--border-row)] px-4 py-3" style={{ background: n.leida ? "#fff" : "#FBFBF9" }}>
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: n.leida ? "transparent" : "#0B7461" }} />
                  <div className="min-w-0 flex-1">
                    <div className={cn("text-[14px]", n.leida ? "font-medium" : "font-semibold")}>{n.titulo}</div>
                    {n.detalle ? <div className="mt-0.5 text-[12.5px] text-[var(--text-2)]">{n.detalle}</div> : null}
                  </div>
                  <span className="whitespace-nowrap text-[11.5px] tabular-nums text-[var(--text-3)]">{cuandoPublicado(n.created_at)}</span>
                </div>
              ))}
            </section>
            <aside className="min-w-[260px] flex-[1_1_300px] rounded-[14px] border border-[var(--border)] bg-white p-4">
              <h2 className="mb-1 text-[15px] font-semibold">Avisarme cuando…</h2>
              <p className="mb-3 text-[12.5px] text-[var(--text-2)]">Se guardan en tu perfil. El envío por email llega cuando haya plantilla.</p>
              {PREF_LABELS.map((p) => (
                <div key={p.key} className="flex items-center justify-between gap-2.5 border-b border-[var(--border-row)] py-2">
                  <span className="text-[13.5px]">{p.label}</span>
                  <Switch on={prefs[p.key]} onClick={() => void togglePref(p.key)} />
                </div>
              ))}
            </aside>
          </div>
        </div>
      ) : null}

      {panel && seleccionado ? (
        <Sheet open onOpenChange={(open) => !open && setPanel(false)} variant="side" side="right">
          <PeekAnuncio
            key={seleccionado.id}
            anuncio={seleccionado}
            alertaNombre={alertas.find((x) => x.id === seleccionado.alerta_id)?.nombre}
            nRepite={seleccionado.contacto_clave ? recuentoClave.get(seleccionado.contacto_clave) ?? 1 : 1}
            relacionados={relacionadosDe(seleccionado, anuncios)}
            indicios={indiciosEncubierta(
              seleccionado.contacto_clave
                ? anuncios.filter((a) => a.contacto_clave === seleccionado.contacto_clave)
                : [seleccionado]
            )}
            historial={actividad}
            comerciales={comerciales}
            onCerrar={() => setPanel(false)}
            onSeguir={() => seguir([seleccionado.id])}
            onQuitar={() => quitarSeguimiento([seleccionado.id])}
            onCaptar={() => void captar(seleccionado)}
            onRegistrado={() => setActividadTick((n) => n + 1)}
            onNota={(nota) => void anotar(seleccionado.id, nota)}
            onAbrir={(id) => setSel(id)}
            onAsignar={(id) => void patchAnuncio([seleccionado.id], { comercial_id: id }, `Asignado a ${comercialDe(id)?.nombre.split(" ")[0] ?? ""}`, "asignacion")}
            onPedirDetalle={() => {
              if (!seleccionado.url) return;
              void fetch("/api/captacion/crawl/detalle", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  portalId: seleccionado.fuente,
                  url: seleccionado.url,
                  alertaId: seleccionado.alerta_id,
                  externoId: seleccionado.externo_id,
                }),
              })
                .then((r) => r.json())
                .then((j) => toast.success(j.ok ? "Detalle encolado" : j.error ?? "Error"))
                .catch(() => toast.error("No se pudo encolar el detalle"));
            }}
            onClasificar={(tipo) => {
              if (!seleccionado.contacto_clave) {
                toast.error("Sin clave de contacto");
                return;
              }
              void fetch("/api/captacion/contactos/clasificar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contactoClave: seleccionado.contacto_clave, clasificacion: tipo }),
              })
                .then((r) => r.json())
                .then((j) => toast.success(j.ok ? `Marcado como ${tipo}` : j.error ?? "Error"))
                .catch(() => toast.error("No se pudo guardar"));
            }}
          />
        </Sheet>
      ) : null}

      {alertaOpen ? (
        <Sheet open onOpenChange={(open) => !open && setAlertaOpen(false)} variant="side" side="right">
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center gap-2.5 border-b border-[var(--border-soft)] px-4 py-3.5">
              <span className="flex-1 text-[11px] uppercase tracking-[0.08em] text-[var(--label)]">Nueva alerta</span>
              <button type="button" onClick={() => setAlertaOpen(false)} className="grid h-[34px] w-[34px] place-items-center rounded-lg text-[var(--text-2)]">×</button>
            </div>
            <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto p-4">
              <label className="block text-[12px] font-semibold text-[var(--text-2)]">Nombre<input value={draftAlerta.nombre} onChange={(e) => setDraftAlerta((d) => ({ ...d, nombre: e.target.value }))} placeholder="p. ej. Edificios centro sin DH" className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] px-3 text-[14px]" /></label>
              <div>
                <div className="mb-1.5 text-[12px] font-semibold text-[var(--text-2)]">Portales</div>
                <div className="flex flex-wrap gap-1.5">
                  {FUENTES_PORTAL.map((p) => {
                    const on = draftAlerta.portales.includes(p);
                    return (
                      <button key={p} type="button" onClick={() => setDraftAlerta((d) => ({ ...d, portales: on ? d.portales.filter((x) => x !== p) : [...d.portales, p] }))} className={cn("flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] font-medium", on ? "border-accent bg-accent-soft text-accent-dark" : "border-[var(--border)] bg-white text-[var(--text-2)]")}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: PORTAL_COLOR[p] }} />{PORTAL_LABEL[p]}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[12px] text-[var(--text-3)]">Captación activa por crawler: Habitaclia, pisos.com, Milanuncios y Fotocasa. Idealista requiere API aparte.</p>
              </div>
              <label className="block text-[12px] font-semibold text-[var(--text-2)]">Zonas<input value={draftAlerta.zonas} onChange={(e) => setDraftAlerta((d) => ({ ...d, zonas: e.target.value }))} placeholder="A Coruña, Cambre, Oleiros…" className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] px-3 text-[14px]" /></label>
              <div className="grid grid-cols-2 gap-2.5">
                <label className="block text-[12px] font-semibold text-[var(--text-2)]">Operación<select value={draftAlerta.operacion} onChange={(e) => setDraftAlerta((d) => ({ ...d, operacion: e.target.value as "venta" | "alquiler" }))} className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] bg-white px-2.5 text-[14px]"><option value="venta">Venta</option><option value="alquiler">Alquiler</option></select></label>
                <label className="block text-[12px] font-semibold text-[var(--text-2)]">Tipo<select value={draftAlerta.tipo} onChange={(e) => setDraftAlerta((d) => ({ ...d, tipo: e.target.value }))} className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] bg-white px-2.5 text-[14px]"><option value="">Cualquiera</option>{TIPOS_ANUNCIO.map((t) => <option key={t} value={t}>{TIPO_ANUNCIO_LABEL[t]}</option>)}</select></label>
                <label className="block text-[12px] font-semibold text-[var(--text-2)]">Precio máx.<input value={draftAlerta.precioMax} onChange={(e) => setDraftAlerta((d) => ({ ...d, precioMax: e.target.value }))} placeholder="€" className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] px-3 text-[14px]" /></label>
                <label className="block text-[12px] font-semibold text-[var(--text-2)]">Metros mín.<input value={draftAlerta.m2Min} onChange={(e) => setDraftAlerta((d) => ({ ...d, m2Min: e.target.value }))} placeholder="m²" className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] px-3 text-[14px]" /></label>
              </div>
              <div className="flex items-center justify-between gap-2.5 rounded-[10px] border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5">
                <div><div className="text-[13.5px] font-semibold">Solo particulares</div><div className="text-[12px] text-[var(--text-2)]">Excluye agencias y profesionales detectados</div></div>
                <Switch on={draftAlerta.soloParticulares} onClick={() => setDraftAlerta((d) => ({ ...d, soloParticulares: !d.soloParticulares }))} />
              </div>
              <label className="block text-[12px] font-semibold text-[var(--text-2)]">Frecuencia<select value={draftAlerta.frecuencia} onChange={(e) => setDraftAlerta((d) => ({ ...d, frecuencia: e.target.value as "hora" | "6h" | "diaria" }))} className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] bg-white px-2.5 text-[14px]"><option value="hora">Cada hora</option><option value="6h">Cada 6 horas</option><option value="diaria">Una vez al día</option></select></label>
              {admin ? (
                <div>
                  <div className="mb-1.5 text-[12px] font-semibold text-[var(--text-2)]">Asignar novedades a</div>
                  <div className="flex flex-wrap gap-1.5">
                    {comerciales.map((c) => {
                      const on = draftAlerta.comercialId === c.id;
                      return (
                        <button key={c.id} type="button" onClick={() => setDraftAlerta((d) => ({ ...d, comercialId: on ? "" : c.id }))} className={cn("flex h-8 items-center gap-1.5 rounded-full border pr-2.5 pl-1 text-[12.5px] font-medium", on ? "border-accent bg-accent-soft" : "border-[var(--border)] bg-white text-[var(--text-2)]")}>
                          <AvatarComercial nombre={c.nombre} color={c.color} size={24} />{c.nombre.split(" ")[0]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 gap-2 border-t border-[var(--border-soft)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button type="button" onClick={() => void crearAlerta()} className="h-10 flex-1 rounded-[9px] bg-accent text-[13.5px] font-semibold text-white">Crear alerta</button>
              <button type="button" onClick={() => setAlertaOpen(false)} className="h-10 rounded-[9px] border border-[var(--input)] px-3.5 text-[13.5px] font-semibold">Cancelar</button>
            </div>
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}

function GaleriaAnuncio({ anuncio, onCerrar }: { anuncio: AnuncioCaptacion; onCerrar: () => void }) {
  const fotos = anuncio.fotos?.length ? anuncio.fotos : anuncio.thumb ? [anuncio.thumb] : [];
  const [indice, setIndice] = useState(0);
  useEffect(() => {
    setIndice(0);
  }, [anuncio.id]);
  const actual = fotos[indice] ?? fotos[0] ?? null;
  return (
    <div className="border-b border-[var(--border-soft)] bg-[#E8E4DC]">
      <div className="relative aspect-video">
        <FotoPortal src={actual} />
        <div className="absolute bottom-2.5 left-3 flex flex-wrap gap-1.5">
          <span className="flex items-center gap-1 rounded-md bg-white/95 px-2 py-0.5 text-[11px] font-semibold"><span className="h-1.5 w-1.5 rounded-full" style={{ background: PORTAL_COLOR[anuncio.fuente] }} />{labelFuentePortal(anuncio.fuente)} · {anuncio.anunciante === "particular" ? "Particular" : anuncio.anunciante}</span>
          {fotos.length ? <span className="rounded-md bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-[var(--text-2)]">{fotos.length} fotos</span> : null}
        </div>
        <button type="button" onClick={onCerrar} className="absolute right-2.5 top-2.5 grid h-[34px] w-[34px] place-items-center rounded-[9px] bg-white/95">×</button>
      </div>
      {fotos.length > 1 ? (
        <div className="flex gap-1.5 overflow-x-auto px-3 py-2">
          {fotos.map((url, i) => (
            <button
              key={`${anuncio.id}-${i}`}
              type="button"
              onClick={() => setIndice(i)}
              className={cn("h-14 w-[72px] shrink-0 overflow-hidden rounded-md border-2 bg-white", i === indice ? "border-accent" : "border-transparent")}
            >
              <FotoPortal src={url} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PeekAnuncio({
  anuncio,
  alertaNombre,
  nRepite,
  relacionados,
  indicios,
  historial,
  comerciales,
  onCerrar,
  onSeguir,
  onQuitar,
  onCaptar,
  onRegistrado,
  onNota,
  onAbrir,
  onAsignar,
  onPedirDetalle,
  onClasificar,
}: {
  anuncio: AnuncioCaptacion;
  alertaNombre?: string;
  nRepite: number;
  relacionados: AnuncioCaptacion[];
  indicios: IndiciosEncubierta;
  historial: Actividad[];
  comerciales: ComercialFiltro[];
  onCerrar: () => void;
  onSeguir: () => void;
  onQuitar: () => void;
  onCaptar: () => void;
  onRegistrado: () => void;
  onNota: (nota: string) => void;
  onAbrir: (id: string) => void;
  onAsignar: (id: string) => void;
  onPedirDetalle?: () => void;
  onClasificar?: (tipo: "particular" | "profesional") => void;
}) {
  const [nota, setNota] = useState("");
  const a = anuncio;
  const alquiler = a.operacion === "alquiler";
  const aviso = textoAvisoEncubierta(indicios) ?? (nRepite >= 3 ? `Este teléfono aparece en ${nRepite} anuncios. Puede ser un profesional encubierto.` : null);
  const avisoFuerte = indicios.aviso === "probable";
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain">
      <GaleriaAnuncio anuncio={a} onCerrar={onCerrar} />
      <div className="border-b border-[var(--border-soft)] px-4 py-3.5">
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0">
            <span className="font-mono text-[11.5px] text-[var(--text-2)]">{a.fuente}.{a.externo_id}</span>
            <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.01em]">{a.titulo}</h2>
            <div className="mt-1 text-[12.5px] text-[var(--text-2)]">{a.zona} · {a.municipio}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[19px] font-semibold tabular-nums tracking-[-0.02em]">{euros(a.precio, alquiler)}</div>
            <div className="text-[12px] tabular-nums text-[var(--text-2)]">{eurosM2(a.precio, a.superficie, alquiler)}/m²</div>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {tagsConEstilo(a.tags).map((t) => <span key={t.label} className="rounded-md px-2 py-0.5 text-[11px] font-semibold" style={{ background: t.bg, color: t.fg }}>{t.label}</span>)}
          <span className="rounded-md bg-[#F4F3EF] px-2 py-0.5 text-[11px] text-[var(--text-2)]">Alerta: {alertaNombre ?? "—"}</span>
        </div>
      </div>
      <AccionesContactoAnuncio anuncio={a} hechos={historial} onRegistrado={onRegistrado} />
      <div className="flex flex-wrap gap-2 border-b border-[var(--border-soft)] px-4 py-3">
        {a.fase === "novedad" ? (
          <button type="button" onClick={onSeguir} className="h-[38px] min-w-[130px] flex-1 rounded-[9px] bg-accent text-[13px] font-semibold text-white">Pasar a seguimiento</button>
        ) : a.fase !== "captado" ? (
          <button type="button" onClick={onCaptar} className="h-[38px] min-w-[130px] flex-1 rounded-[9px] bg-accent text-[13px] font-semibold text-white">Captar inmueble</button>
        ) : a.propiedad_id ? (
          <a href={`/propiedades/${a.propiedad_id}`} className="flex h-[38px] min-w-[130px] flex-1 items-center justify-center rounded-[9px] bg-accent text-[13px] font-semibold text-white no-underline">Ver inmueble</a>
        ) : null}
        {a.fase !== "novedad" && a.fase !== "captado" && a.fase !== "descartado" ? (
          <button type="button" onClick={onQuitar} className="h-[38px] min-w-[150px] flex-1 rounded-[9px] border border-[var(--input)] bg-white text-[13px] font-semibold">Quitar de seguimiento</button>
        ) : null}
        {a.cliente_id ? <a href={`/clientes/${a.cliente_id}`} className="flex h-[38px] min-w-[90px] flex-1 items-center justify-center rounded-[9px] border border-[var(--input)] bg-white text-[13px] font-semibold no-underline">Ver cliente</a> : null}
        {a.url ? <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex h-[38px] min-w-[120px] flex-1 items-center justify-center rounded-[9px] border border-[var(--input)] bg-white text-[13px] font-semibold no-underline">Ver en {labelFuentePortal(a.fuente)}</a> : null}
        {!a.contacto_telefono && a.url && onPedirDetalle ? (
          <button type="button" onClick={onPedirDetalle} className="h-[38px] min-w-[120px] flex-1 rounded-[9px] border border-[var(--input)] bg-white text-[13px] font-semibold">Pedir detalle</button>
        ) : null}
        {onClasificar ? (
          <>
            <button type="button" onClick={() => onClasificar("profesional")} className="h-[38px] min-w-[100px] flex-1 rounded-[9px] border border-[#E8D4D4] bg-[#FBF0F0] text-[13px] font-semibold text-[#8A3030]">Era agencia</button>
            <button type="button" onClick={() => onClasificar("particular")} className="h-[38px] min-w-[100px] flex-1 rounded-[9px] border border-[#D4E8DE] bg-[#F0FBF4] text-[13px] font-semibold text-[#0B7461]">Era particular</button>
          </>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-2.5 border-b border-[var(--border-soft)] px-4 py-3 text-[13.5px]">
        <div><div className="text-[11px] uppercase tracking-[0.07em] text-[var(--label)]">Tipo</div>{a.tipo ? TIPO_ANUNCIO_LABEL[a.tipo as keyof typeof TIPO_ANUNCIO_LABEL] ?? a.tipo : "—"}</div>
        <div><div className="text-[11px] uppercase tracking-[0.07em] text-[var(--label)]">Superficie</div>{a.superficie ? `${a.superficie} m²` : "—"}</div>
        <div><div className="text-[11px] uppercase tracking-[0.07em] text-[var(--label)]">Hab.</div>{a.habitaciones ?? "—"}</div>
        <div><div className="text-[11px] uppercase tracking-[0.07em] text-[var(--label)]">Contacto</div>{a.contacto_nombre || "—"}</div>
        <div><div className="text-[11px] uppercase tracking-[0.07em] text-[var(--label)]">Teléfono</div><span className="font-mono text-[12.5px]">{a.contacto_telefono || "Solo por el portal"}</span></div>
        <div><div className="text-[11px] uppercase tracking-[0.07em] text-[var(--label)]">Publicado</div>{publicadoEsCarga(a.publicado_en, a.created_at) ? "Sin fecha del portal" : cuandoPublicado(a.publicado_en)}</div>
      </div>
      <div className="border-b border-[var(--border-soft)] px-4 py-3">
        <div className="mb-2 text-[11px] uppercase tracking-[0.07em] text-[var(--label)]">Asignar a</div>
        <div className="flex flex-wrap gap-1.5">
          {comerciales.map((c) => {
            const on = a.comercial_id === c.id;
            return (
              <button key={c.id} type="button" onClick={() => onAsignar(c.id)} className={cn("flex h-8 items-center gap-1.5 rounded-full border pr-2.5 pl-1 text-[12.5px] font-medium", on ? "border-accent bg-accent-soft" : "border-[var(--border)] bg-white text-[var(--text-2)]")}>
                <AvatarComercial nombre={c.nombre} color={c.color} size={24} />{c.nombre.split(" ")[0]}
              </button>
            );
          })}
        </div>
      </div>
      <div className="px-4 py-3">
        {aviso ? (
          <div
            className="mt-2 rounded-[9px] px-2.5 py-2 text-[12.5px]"
            style={{ background: avisoFuerte ? "#F8E4D8" : "#FBF0D8", color: avisoFuerte ? "#7A3B10" : "#7A5A10" }}
          >
            {aviso}
          </div>
        ) : null}
        {relacionados.length > 0 ? (
          <div className="mt-3">
            <div className="mb-1.5 text-[11px] uppercase tracking-[0.07em] text-[var(--label)]">Otros anuncios de este contacto</div>
            <div className="flex flex-col gap-1.5">
              {relacionados.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onAbrir(r.id)}
                  className="flex items-center gap-2 rounded-[9px] border border-[var(--border)] bg-white px-2 py-1.5 text-left hover:border-accent"
                >
                  <span className="h-9 w-11 shrink-0 overflow-hidden rounded-md bg-[#E8E4DC]">
                    <FotoPortal src={portadaDe(r)} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">{r.titulo}</span>
                    <span className="block truncate text-[11.5px] text-[var(--text-2)]">{r.zona || r.municipio || "—"}</span>
                  </span>
                  <span className="shrink-0 text-[12.5px] font-semibold tabular-nums">{euros(r.precio, r.operacion === "alquiler")}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onNota(nota);
            setNota("");
          }}
        >
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Añadir nota…"
            className="h-9 min-w-0 flex-1 rounded-[9px] border border-[var(--input)] px-3 text-[13px]"
          />
          <button type="submit" className="h-9 rounded-[9px] border border-[var(--input)] bg-white px-3 text-[12.5px] font-semibold">Guardar</button>
        </form>
      </div>
    </div>
  );
}
