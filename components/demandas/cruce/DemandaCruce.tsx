"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpDown, Check, ChevronDown, ChevronRight, ChevronUp, MessageCircle, Phone, Search } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { relacionUno } from "@/lib/citas/citas";
import { BuscadorLocalidad } from "@/components/geo/BuscadorLocalidad";
import { NuevaDemandaPanel } from "@/components/demandas/NuevaDemandaPanel";
import { AvatarComercial } from "@/components/ui/avatar-comercial";
import { FichaLink } from "@/components/crm/FichaPeek";
import { TIPO_INMUEBLE_LABEL, type TipoInmueble } from "@/lib/inmuebles/catalogo";
import { ORIGENES_DEMANDA } from "@/lib/demandas/nueva";
import { TIPO_OPERACION_DEMANDA_LABEL, type TipoOperacionDemanda } from "@/lib/demandas/matching";
import {
  MOTIVOS_DESCARTE_CRUCE,
  conAscensor,
  estadoAsignacionDe,
  estadoDbDe,
  evaluarCruce,
  ordenarCruce,
  pideAscensor,
  precioDeCruce,
  type EstadoAsignacion,
  type EvaluacionCruce,
} from "@/lib/demandas/cruce";
import { numeroOpcional } from "@/lib/demandas/nueva";
import { formatEuro, telWhatsApp } from "@/lib/ui/estados-vista";
import { cn } from "@/lib/utils";

type Tab = "sugeridos" | "asignados" | "descartados";

type DemandaFila = {
  id: string;
  cliente_id: string;
  comercial_id: string;
  tipo_operacion: string;
  tipos_inmueble: string[] | null;
  zonas: string[] | null;
  presupuesto_min: number | null;
  presupuesto_max: number | null;
  superficie_min: number | null;
  superficie_max: number | null;
  habitaciones_min: number | null;
  banos_min: number | null;
  requisitos: string | null;
  origen: string | null;
  estado: string;
  asignacion_auto: boolean;
  asignacion_casi: boolean;
  updated_at: string;
  clientes?: { nombre?: string | null; telefono?: string | null } | null;
  profiles?: { nombre_completo?: string | null; color?: string | null } | null;
};

type StockFila = {
  id: string;
  titulo: string | null;
  direccion: string | null;
  localidad: string | null;
  codigo_postal: string | null;
  referencia: string | null;
  tipo_operacion: string | null;
  tipo_inmueble: string | null;
  precio_venta: number | null;
  precio_alquiler: number | null;
  superficie_util: number | null;
  superficie_m2: number | null;
  habitaciones: number | null;
  banos: number | null;
  ascensor: boolean | null;
  created_at: string | null;
};

type MatchFila = {
  id: string;
  propiedad_id: string;
  estado: string;
  origen: string;
  notas: string | null;
};

type Pieza = StockFila & EvaluacionCruce & { precio: number | null; isNew: boolean; tituloVisible: string };

type Borrador = {
  zonas: string[];
  habitacionesMin: number | null;
  superficieMin: number | null;
  superficieMax: number | null;
  banosMin: number | null;
  presupuestoMin: string;
  presupuestoMax: string;
  ascensor: boolean;
};

type Aviso = { msg: string; verId?: string; revert: () => Promise<void> };

const SELECT_DEMANDA =
  "id, cliente_id, comercial_id, tipo_operacion, tipos_inmueble, zonas, presupuesto_min, presupuesto_max, superficie_min, superficie_max, habitaciones_min, banos_min, requisitos, origen, estado, asignacion_auto, asignacion_casi, updated_at, clientes:cliente_id(nombre, telefono), profiles:comercial_id(nombre_completo, color)";

const SELECT_STOCK =
  "id, titulo, direccion, localidad, codigo_postal, referencia, tipo_operacion, tipo_inmueble, precio_venta, precio_alquiler, superficie_util, superficie_m2, habitaciones, banos, ascensor, created_at";

function num(valor: number | string | null | undefined): number | null {
  if (valor == null || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function criteriosDe(demanda: DemandaFila, extra?: Borrador) {
  return {
    tipoOperacion: demanda.tipo_operacion,
    tiposInmueble: demanda.tipos_inmueble ?? [],
    presupuestoMin: extra ? numeroOpcional(extra.presupuestoMin) : num(demanda.presupuesto_min),
    presupuestoMax: extra ? numeroOpcional(extra.presupuestoMax) : num(demanda.presupuesto_max),
    zonas: extra?.zonas ?? demanda.zonas ?? [],
    habitacionesMin: extra ? extra.habitacionesMin : num(demanda.habitaciones_min),
    superficieMin: extra ? extra.superficieMin : num(demanda.superficie_min),
    superficieMax: extra ? extra.superficieMax : num(demanda.superficie_max),
    banosMin: extra ? extra.banosMin : num(demanda.banos_min),
    pideAscensor: extra ? extra.ascensor : pideAscensor(demanda.requisitos),
  };
}

function aPieza(fila: StockFila, demanda: DemandaFila, extra?: Borrador): Pieza {
  const precio = precioDeCruce(demanda.tipo_operacion, fila.precio_venta, fila.precio_alquiler);
  const eval_ = evaluarCruce(
    {
      tipoOperacion: fila.tipo_operacion,
      tipoInmueble: fila.tipo_inmueble,
      localidad: fila.localidad,
      codigoPostal: fila.codigo_postal,
      precio,
      superficie: num(fila.superficie_util) ?? num(fila.superficie_m2),
      habitaciones: num(fila.habitaciones),
      banos: num(fila.banos),
      ascensor: fila.ascensor,
    },
    criteriosDe(demanda, extra)
  );
  const creado = fila.created_at ? Date.now() - new Date(fila.created_at).getTime() < 3 * 86400000 : false;
  return {
    ...fila,
    ...eval_,
    precio,
    isNew: creado,
    tituloVisible: fila.titulo || fila.direccion || "Inmueble",
  };
}

export function DemandaCruce({ id }: { id: string }) {
  const [demanda, setDemanda] = useState<DemandaFila | null>(null);
  const [stock, setStock] = useState<StockFila[]>([]);
  const [matches, setMatches] = useState<MatchFila[]>([]);
  const [tab, setTab] = useState<Tab>("sugeridos");
  const [query, setQuery] = useState("");
  const [orden, setOrden] = useState<"recent" | "price">("recent");
  const [nearOpen, setNearOpen] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | "discard" | "criteria">(null);
  const [discardId, setDiscardId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Borrador | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [editar, setEditar] = useState(false);
  const [matchesListos, setMatchesListos] = useState(false);
  const autoClave = useRef("");

  const cargar = () => {
    const supabase = createClient();
    setMatchesListos(false);
    void supabase
      .from("demandas")
      .select(SELECT_DEMANDA)
      .eq("id", id)
      .single()
      .then(({ data }) => {
        if (!data) {
          setDemanda(null);
          return;
        }
        const fila = data as DemandaFila & {
          clientes?: DemandaFila["clientes"] | NonNullable<DemandaFila["clientes"]>[];
          profiles?: DemandaFila["profiles"] | NonNullable<DemandaFila["profiles"]>[];
        };
        setDemanda({ ...fila, clientes: relacionUno(fila.clientes), profiles: relacionUno(fila.profiles) });
      });
    void supabase
      .from("propiedades")
      .select(SELECT_STOCK)
      .eq("estado", "disponible")
      .eq("publicado", true)
      .then(({ data }) => setStock((data ?? []) as StockFila[]));
    void supabase
      .from("demanda_inmuebles")
      .select("id, propiedad_id, estado, origen, notas")
      .eq("demanda_id", id)
      .then(({ data }) => {
        setMatches((data ?? []) as MatchFila[]);
        setMatchesListos(true);
      });
  };

  useEffect(() => {
    cargar();
  }, [id]);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 6000);
    return () => window.clearTimeout(t);
  }, [aviso]);

  useEffect(() => {
    if (!highlight) return;
    const t = window.setTimeout(() => setHighlight(null), 3000);
    return () => window.clearTimeout(t);
  }, [highlight]);

  const piezas = useMemo(() => (demanda ? stock.map((fila) => aPieza(fila, demanda)) : []), [stock, demanda]);
  const porId = useMemo(() => new Map(piezas.map((pieza) => [pieza.id, pieza])), [piezas]);
  const matchDe = useMemo(() => new Map(matches.map((fila) => [fila.propiedad_id, fila])), [matches]);

  const asignado = (idPieza: string) => {
    const fila = matchDe.get(idPieza);
    return Boolean(fila && fila.estado !== "descartado");
  };
  const descartado = (idPieza: string) => matchDe.get(idPieza)?.estado === "descartado";

  const perfect = useMemo(
    () => ordenarCruce(piezas.filter((pieza) => pieza.perfect && !asignado(pieza.id) && !descartado(pieza.id)), orden),
    [piezas, matches, orden]
  );
  const near = useMemo(
    () => ordenarCruce(piezas.filter((pieza) => pieza.near && !asignado(pieza.id) && !descartado(pieza.id)), orden),
    [piezas, matches, orden]
  );
  const asignados = useMemo(
    () =>
      piezas
        .filter((pieza) => asignado(pieza.id))
        .sort((a, b) => (matchDe.get(b.id)?.id ?? "").localeCompare(matchDe.get(a.id)?.id ?? "")),
    [piezas, matches]
  );
  const descartados = useMemo(() => piezas.filter((pieza) => descartado(pieza.id)), [piezas, matches]);

  const pendientes = asignados.filter((pieza) => estadoAsignacionDe(matchDe.get(pieza.id)?.estado ?? "") === "pending");

  useEffect(() => {
    if (!demanda?.asignacion_auto || !matchesListos || stock.length === 0) return;
    const clave = `${demanda.id}:${demanda.updated_at}:${demanda.asignacion_casi}:${matches.map((fila) => fila.propiedad_id).sort().join(",")}`;
    if (autoClave.current === clave) return;
    const objetivo = piezas.filter((pieza) => !matchDe.has(pieza.id) && (pieza.perfect || (demanda.asignacion_casi && pieza.near)));
    if (objetivo.length === 0) {
      autoClave.current = clave;
      return;
    }
    autoClave.current = clave;
    const supabase = createClient();
    void supabase
      .from("demanda_inmuebles")
      .insert(
        objetivo.map((pieza) => ({
          demanda_id: demanda.id,
          propiedad_id: pieza.id,
          origen: "automatico" as const,
          puntuacion: pieza.passed,
          estado: "propuesto" as const,
        }))
      )
      .then(() => cargar());
  }, [demanda, piezas, matches, matchesListos, stock.length]);

  if (!demanda) {
    return <p className="mt-8 text-sm text-[var(--text-2)]">Cargando demanda…</p>;
  }

  const nombre = demanda.clientes?.nombre?.trim() || "Demanda";
  const comercial = demanda.profiles?.nombre_completo?.trim() || "Sin comercial";
  const nombreCorto = comercial.split(" ")[0] || comercial;
  const operacion = TIPO_OPERACION_DEMANDA_LABEL[demanda.tipo_operacion as TipoOperacionDemanda] ?? demanda.tipo_operacion;
  const origen = ORIGENES_DEMANDA.find((item) => item.id === demanda.origen)?.label;
  const telefono = demanda.clientes?.telefono ?? "";
  const wa = telWhatsApp(telefono);
  const tipos = (demanda.tipos_inmueble ?? []).map((tipo) => TIPO_INMUEBLE_LABEL[tipo as TipoInmueble] ?? tipo);
  const presupuesto =
    num(demanda.presupuesto_min) != null && num(demanda.presupuesto_max) != null
      ? `${formatEuro(num(demanda.presupuesto_min))} – ${formatEuro(num(demanda.presupuesto_max))}`
      : num(demanda.presupuesto_max) != null
        ? `Hasta ${formatEuro(num(demanda.presupuesto_max))}`
        : num(demanda.presupuesto_min) != null
          ? `Desde ${formatEuro(num(demanda.presupuesto_min))}`
          : "";
  const metros =
    num(demanda.superficie_min) != null && num(demanda.superficie_max) != null
      ? `${num(demanda.superficie_min)}–${num(demanda.superficie_max)} m²`
      : num(demanda.superficie_min) != null
        ? `≥ ${num(demanda.superficie_min)} m²`
        : num(demanda.superficie_max) != null
          ? `≤ ${num(demanda.superficie_max)} m²`
          : "";
  const chips = [
    operacion,
    tipos.join(", "),
    presupuesto,
    (demanda.zonas ?? []).length > 2 ? `${(demanda.zonas ?? []).length} zonas` : (demanda.zonas ?? []).join(", "),
    num(demanda.habitaciones_min) != null ? `≥ ${num(demanda.habitaciones_min)} hab` : "",
    metros,
    num(demanda.banos_min) != null ? `≥ ${num(demanda.banos_min)} baños` : "",
    pideAscensor(demanda.requisitos) ? "Ascensor" : "",
  ].filter(Boolean);
  const faltan = [!(demanda.zonas ?? []).length && "zona", num(demanda.habitaciones_min) == null && "habitaciones", num(demanda.superficie_min) == null && "superficie"].filter(Boolean) as string[];
  const notasRequisitos = (demanda.requisitos ?? "")
    .split(/[.\n]+/)
    .map((parte) => parte.trim())
    .filter((parte) => parte && parte.toLowerCase() !== "ascensor")
    .join(". ");

  const avisar = (siguiente: Aviso) => setAviso(siguiente);
  const ver = (propiedadId: string) => {
    setTab("asignados");
    setQuery("");
    setAviso(null);
    setHighlight(propiedadId);
  };

  const guardarModo = async (auto: boolean, casi = demanda.asignacion_casi) => {
    setDemanda({ ...demanda, asignacion_auto: auto, asignacion_casi: casi });
    autoClave.current = "";
    const { error } = await createClient().from("demandas").update({ asignacion_auto: auto, asignacion_casi: casi }).eq("id", demanda.id);
    if (error) toast.error("No se ha podido guardar el modo.");
  };

  const asignar = async (propiedadId: string, origenMatch: "manual" | "automatico") => {
    const pieza = porId.get(propiedadId);
    const previa = matchDe.get(propiedadId);
    const supabase = createClient();
    if (previa) {
      const { error } = await supabase
        .from("demanda_inmuebles")
        .update({ estado: "propuesto", notas: null, origen: origenMatch, puntuacion: pieza?.passed ?? 0 })
        .eq("id", previa.id);
      if (error) return toast.error("No se ha podido asignar.");
      avisar({
        msg: `${pieza?.tituloVisible ?? "Inmueble"} asignado. Falta enviárselo.`,
        verId: propiedadId,
        revert: async () => {
          await supabase.from("demanda_inmuebles").update({ estado: previa.estado, notas: previa.notas, origen: previa.origen }).eq("id", previa.id);
          cargar();
        },
      });
    } else {
      const { data, error } = await supabase
        .from("demanda_inmuebles")
        .insert({ demanda_id: demanda.id, propiedad_id: propiedadId, origen: origenMatch, puntuacion: pieza?.passed ?? 0, estado: "propuesto" })
        .select("id")
        .single();
      if (error || !data) return toast.error("No se ha podido asignar.");
      avisar({
        msg: `${pieza?.tituloVisible ?? "Inmueble"} asignado. Falta enviárselo.`,
        verId: propiedadId,
        revert: async () => {
          await supabase.from("demanda_inmuebles").delete().eq("id", data.id);
          cargar();
        },
      });
    }
    setQuery("");
    cargar();
  };

  const quitar = async (propiedadId: string) => {
    const previa = matchDe.get(propiedadId);
    const pieza = porId.get(propiedadId);
    if (!previa) return;
    const supabase = createClient();
    const { error } = await supabase.from("demanda_inmuebles").delete().eq("id", previa.id);
    if (error) return toast.error("No se ha podido quitar.");
    avisar({
      msg: `${pieza?.tituloVisible ?? "Inmueble"} quitado de la propuesta.`,
      revert: async () => {
        await supabase.from("demanda_inmuebles").insert({
          demanda_id: demanda.id,
          propiedad_id: propiedadId,
          origen: previa.origen === "manual" ? "manual" : "automatico",
          puntuacion: 0,
          estado: previa.estado,
          notas: previa.notas,
        });
        cargar();
      },
    });
    cargar();
  };

  const descartar = async (propiedadId: string, motivo: string) => {
    const previa = matchDe.get(propiedadId);
    const pieza = porId.get(propiedadId);
    const supabase = createClient();
    if (previa) {
      const { error } = await supabase.from("demanda_inmuebles").update({ estado: "descartado", notas: motivo }).eq("id", previa.id);
      if (error) return toast.error("No se ha podido descartar.");
      avisar({
        msg: `${pieza?.tituloVisible ?? "Inmueble"} descartado (${motivo.toLowerCase()}).`,
        revert: async () => {
          await supabase.from("demanda_inmuebles").update({ estado: previa.estado, notas: previa.notas }).eq("id", previa.id);
          cargar();
        },
      });
    } else {
      const { data, error } = await supabase
        .from("demanda_inmuebles")
        .insert({ demanda_id: demanda.id, propiedad_id: propiedadId, origen: "manual", puntuacion: 0, estado: "descartado", notas: motivo })
        .select("id")
        .single();
      if (error || !data) return toast.error("No se ha podido descartar.");
      avisar({
        msg: `${pieza?.tituloVisible ?? "Inmueble"} descartado (${motivo.toLowerCase()}).`,
        revert: async () => {
          await supabase.from("demanda_inmuebles").delete().eq("id", data.id);
          cargar();
        },
      });
    }
    setSheet(null);
    setDiscardId(null);
    cargar();
  };

  const recuperar = async (propiedadId: string) => {
    const previa = matchDe.get(propiedadId);
    const pieza = porId.get(propiedadId);
    if (!previa) return;
    const supabase = createClient();
    const { error } = await supabase.from("demanda_inmuebles").delete().eq("id", previa.id);
    if (error) return toast.error("No se ha podido recuperar.");
    avisar({
      msg: `${pieza?.tituloVisible ?? "Inmueble"} vuelve a Sugeridos.`,
      revert: async () => {
        await supabase.from("demanda_inmuebles").insert({
          demanda_id: demanda.id,
          propiedad_id: propiedadId,
          origen: previa.origen === "manual" ? "manual" : "automatico",
          estado: "descartado",
          notas: previa.notas,
          puntuacion: 0,
        });
        cargar();
      },
    });
    cargar();
  };

  const cambiarEstado = async (propiedadId: string, status: EstadoAsignacion, msg: string) => {
    const previa = matchDe.get(propiedadId);
    if (!previa) return;
    const supabase = createClient();
    const { error } = await supabase.from("demanda_inmuebles").update({ estado: estadoDbDe(status) }).eq("id", previa.id);
    if (error) return toast.error("No se ha podido guardar.");
    avisar({
      msg,
      revert: async () => {
        await supabase.from("demanda_inmuebles").update({ estado: previa.estado }).eq("id", previa.id);
        cargar();
      },
    });
    cargar();
  };

  const abrirWhatsapp = (piezasEnvio: Pieza[], marcar: boolean) => {
    if (!wa) {
      toast.error("Este cliente no tiene teléfono.");
      return;
    }
    const lineas = piezasEnvio.map((pieza) => {
      const precio = pieza.precio != null ? formatEuro(pieza.precio) : "";
      return [pieza.tituloVisible, pieza.referencia, pieza.localidad, precio].filter(Boolean).join(" · ");
    });
    const texto = `Hola ${nombre.split(" ")[0]}, te propongo:\n${lineas.join("\n")}`;
    window.open(`${wa}?text=${encodeURIComponent(texto)}`, "_blank", "noopener,noreferrer");
    if (!marcar) return;
    const ids = piezasEnvio.map((pieza) => matchDe.get(pieza.id)?.id).filter(Boolean) as string[];
    const previos = piezasEnvio.map((pieza) => matchDe.get(pieza.id)).filter(Boolean) as MatchFila[];
    void createClient()
      .from("demanda_inmuebles")
      .update({ estado: "presentado" })
      .in("id", ids)
      .then(() => {
        avisar({
          msg: piezasEnvio.length === 1 ? `${piezasEnvio[0]!.tituloVisible} enviado a ${nombre}. Cuando responda, anótalo aquí.` : `${piezasEnvio.length} inmuebles enviados a ${nombre}.`,
          revert: async () => {
            const supabase = createClient();
            for (const previa of previos) {
              await supabase.from("demanda_inmuebles").update({ estado: previa.estado }).eq("id", previa.id);
            }
            cargar();
          },
        });
        cargar();
      });
  };

  const asignarEncajan = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("demanda_inmuebles")
      .insert(
        perfect.map((pieza) => ({
          demanda_id: demanda.id,
          propiedad_id: pieza.id,
          origen: "manual" as const,
          puntuacion: pieza.passed,
          estado: "propuesto" as const,
        }))
      )
      .select("id");
    if (error || !data?.length) return toast.error("No se han podido asignar.");
    const ids = data.map((fila) => fila.id);
    avisar({
      msg: `${ids.length} inmuebles asignados. Ahora envíaselos.`,
      revert: async () => {
        await supabase.from("demanda_inmuebles").delete().in("id", ids);
        cargar();
      },
    });
    setTab("asignados");
    cargar();
  };

  const q = query.trim().toLowerCase();
  const resultados = q
    ? piezas
        .filter((pieza) => !asignado(pieza.id) && `${pieza.referencia ?? ""} ${pieza.tituloVisible} ${pieza.direccion ?? ""} ${pieza.localidad ?? ""}`.toLowerCase().includes(q))
        .slice(0, 5)
    : [];

  const filas = tab === "sugeridos" ? perfect : tab === "asignados" ? asignados : descartados;
  const vacios: Record<Tab, [string, string]> = {
    sugeridos: ["No hay más que encajen del todo", near.length ? "Mira los que casi encajan más abajo, o amplía los criterios en «Lo que busca»." : "Amplía los criterios en «Lo que busca» o búscalo a mano arriba."],
    asignados: ["Aún no le has propuesto nada", "Asigna desde Sugeridos, búscalo a mano o activa el modo automático."],
    descartados: ["Nada descartado", "Los inmuebles que descartes aparecerán aquí con su motivo."],
  };
  const hints: Record<Tab, string> = {
    sugeridos: "Encajan con todo lo que busca. Asigna los que quieras proponerle.",
    asignados: "Lo que le has propuesto. Envíaselos y anota qué le parecen.",
    descartados: "No se volverán a sugerir salvo que los recuperes.",
  };
  const ctaSugeridos = tab === "sugeridos" && perfect.length > 0;
  const ctaEnviar = tab === "asignados" && pendientes.length > 0;
  const autoWould = perfect.length + (demanda.asignacion_casi ? near.length : 0);
  const draftMatches = draft ? stock.filter((fila) => aPieza(fila, demanda, draft).perfect).length : 0;
  const piezaDescarte = discardId ? porId.get(discardId) : null;

  const abrirCriterios = () => {
    setDraft({
      zonas: [...(demanda.zonas ?? [])],
      habitacionesMin: num(demanda.habitaciones_min),
      superficieMin: num(demanda.superficie_min),
      superficieMax: num(demanda.superficie_max),
      banosMin: num(demanda.banos_min),
      presupuestoMin: num(demanda.presupuesto_min) != null ? String(num(demanda.presupuesto_min)) : "",
      presupuestoMax: num(demanda.presupuesto_max) != null ? String(num(demanda.presupuesto_max)) : "",
      ascensor: pideAscensor(demanda.requisitos),
    });
    setSheet("criteria");
  };

  const guardarCriterios = async () => {
    if (!draft) return;
    const presupuestoMin = numeroOpcional(draft.presupuestoMin);
    const presupuestoMax = numeroOpcional(draft.presupuestoMax);
    if (presupuestoMin != null && presupuestoMax != null && presupuestoMin > presupuestoMax) {
      return toast.error("El presupuesto mínimo no puede ser mayor que el máximo.");
    }
    if (draft.superficieMin != null && draft.superficieMax != null && draft.superficieMin > draft.superficieMax) {
      return toast.error("Los m² mínimos no pueden ser mayores que los máximos.");
    }
    const { error } = await createClient()
      .from("demandas")
      .update({
        zonas: draft.zonas,
        habitaciones_min: draft.habitacionesMin,
        superficie_min: draft.superficieMin,
        superficie_max: draft.superficieMax,
        banos_min: draft.banosMin,
        presupuesto_min: presupuestoMin,
        presupuesto_max: presupuestoMax,
        requisitos: conAscensor(demanda.requisitos, draft.ascensor),
        updated_at: new Date().toISOString(),
      })
      .eq("id", demanda.id);
    if (error) return toast.error("No se han podido guardar los criterios.");
    setSheet(null);
    setDraft(null);
    autoClave.current = "";
    cargar();
  };

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 pb-28 min-[1024px]:pb-8">
      <header className="flex flex-col gap-3">
        <div className="flex gap-2 text-[14px] text-[var(--text-3)]">
          <Link href="/demandas" className="hover:text-foreground">Demandas</Link>
          <span>/</span>
          <span className="text-foreground">Demanda de {nombre}</span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-[20px] font-semibold tracking-[-0.01em] min-[1024px]:text-[22px]">
              <FichaLink tipo="cliente" id={demanda.cliente_id} className="text-inherit">{nombre}</FichaLink>
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="rounded-full bg-[var(--green-bg)] px-2.5 py-0.5 text-[var(--green)]">Demanda {demanda.estado}</span>
              <span className="text-[var(--text-3)]">Quiere {operacion.toLowerCase()}{origen ? ` · Llegó por ${origen.toLowerCase()}` : ""}</span>
              <span className="inline-flex items-center gap-1.5 text-foreground">
                <AvatarComercial nombre={demanda.profiles?.nombre_completo} color={demanda.profiles?.color} size={20} />
                {comercial}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {telefono ? (
              <a href={`tel:${telefono}`} className={btnGhost}><Phone className="h-4 w-4" /> Llamar</a>
            ) : (
              <span className={cn(btnGhost, "opacity-40")}>Llamar</span>
            )}
            {wa ? (
              <a href={wa} target="_blank" rel="noreferrer" className={btnGhost}><MessageCircle className="h-4 w-4 text-[var(--green)]" /> WhatsApp</a>
            ) : (
              <span className={cn(btnGhost, "opacity-40")}>WhatsApp</span>
            )}
            <button type="button" className={btnGhost} onClick={() => setEditar(true)}>Editar demanda</button>
          </div>
        </div>
      </header>

      <div className="grid items-start gap-6 min-[1024px]:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
        <aside className="flex flex-col gap-4">
          <button
            type="button"
            onClick={abrirCriterios}
            className="flex w-full flex-col gap-3 rounded-[14px] border border-border bg-[var(--surface)] p-5 text-left"
          >
            <span className="flex w-full items-center justify-between">
              <span className="text-[14px] font-semibold">Lo que busca</span>
              <span className="inline-flex items-center gap-0.5 text-[12px] text-[var(--text-3)]">Ajustar <ChevronRight className="h-3.5 w-3.5" /></span>
            </span>
            <span className="flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <span key={chip} className="rounded-[7px] bg-[var(--surface-soft)] px-2 py-1 text-[12px]">{chip}</span>
              ))}
              {faltan.length ? <span className="rounded-[7px] bg-[var(--amber-bg)] px-2 py-1 text-[12px] text-[var(--amber-ink)]">Falta {faltan.join(", ")}</span> : null}
            </span>
            {faltan.length ? <span className="text-[12px] leading-relaxed text-[var(--text-3)]">Sin zona ni tamaño, cualquier inmueble que cumpla el resto encaja. Añádelos para afinar.</span> : null}
            {notasRequisitos ? <span className="text-[12px] leading-relaxed text-[var(--text-3)]">Notas: {notasRequisitos}. Garaje, terraza y exterior no filtran: el inmueble no guarda ese dato.</span> : null}
          </button>

          <div className="flex flex-col gap-3 rounded-[14px] border border-border bg-[var(--surface)] p-5">
            <div>
              <p className="text-[14px] font-semibold">Cuando entre un inmueble que encaje…</p>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-3)]">Los dos modos usan los mismos criterios. Solo cambia quién pulsa «Asignar».</p>
            </div>
            <Modo
              activo={!demanda.asignacion_auto}
              titulo="Avisarme y decidir yo"
              texto="Te llega un aviso y aparece en Sugeridos. Tú decides si asignarlo."
              pasos={["Entra", "Sugeridos", "tú asignas"]}
              onClick={() => void guardarModo(false)}
            />
            <Modo
              activo={demanda.asignacion_auto}
              titulo="Asignarlo directamente"
              texto={`Pasa a Asignados sin preguntarte y se avisa a ${nombreCorto}. Tú solo lo revisas y se lo envías.`}
              pasos={["Entra", "Asignados", "tú envías"]}
              onClick={() => void guardarModo(true)}
            />
            {demanda.asignacion_auto ? (
              <div className="flex flex-col gap-2.5 rounded-[11px] bg-[var(--field)] p-3">
                <p className="text-[13px] leading-relaxed">
                  {autoWould
                    ? `Ejemplo con tu stock de hoy: los ${autoWould} que ahora ves en Sugeridos ya estarían en Asignados, por enviar, sin que hicieras nada.`
                    : "Hoy no hay ninguno que encaje; el primero que entre irá directo a Asignados."}
                </p>
                <button type="button" onClick={() => void guardarModo(true, !demanda.asignacion_casi)} className="flex items-center gap-2.5 text-left text-[13px] text-[var(--text-2)]">
                  <span className={cn("grid h-5 w-5 place-items-center rounded-[6px] border-2", demanda.asignacion_casi ? "border-foreground bg-foreground text-[var(--background)]" : "border-[var(--input)]")}>
                    {demanda.asignacion_casi ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                  </span>
                  Incluir también los que casi encajan ({near.length})
                </button>
              </div>
            ) : null}
          </div>
        </aside>

        <section className="flex min-w-0 flex-col overflow-hidden rounded-[14px] border border-border bg-[var(--surface)]">
          <div className="sticky top-16 z-20 flex flex-col gap-3 border-b border-border bg-[var(--surface)] px-4 py-4 min-[820px]:top-14 min-[1024px]:static min-[1024px]:px-5">
            <div className="flex h-11 items-center gap-2.5 rounded-[10px] border border-[var(--input)] bg-[var(--field)] px-3.5 min-[1024px]:h-[42px]">
              <Search className="h-4 w-4 shrink-0 text-[var(--text-3)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar en todo el stock: referencia, calle o título"
                className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-[var(--text-3)] min-[1024px]:text-[14px]"
              />
              {query ? <button type="button" className="text-[13px] text-[var(--text-3)]" onClick={() => setQuery("")}>Cerrar</button> : null}
            </div>
            {q ? (
              <div className="overflow-hidden rounded-[10px] border border-[var(--input)]">
                {resultados.length === 0 ? <p className="px-4 py-3 text-[13px] text-[var(--text-2)]">Sin resultados para «{query.trim()}».</p> : resultados.map((pieza) => (
                  <div key={pieza.id} className="flex items-center justify-between gap-3 border-b border-[var(--border-soft)] px-3 py-2.5 last:border-0">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium">{pieza.tituloVisible}</p>
                      <p className="truncate text-[12px] text-[var(--text-3)]">
                        {[pieza.referencia, pieza.localidad, pieza.precio != null ? formatEuro(pieza.precio) : null].filter(Boolean).join(" · ")}
                        {" · "}
                        <span className={pieza.perfect ? "text-[var(--green)]" : pieza.near ? "text-[var(--amber)]" : "text-[var(--red)]"}>
                          {pieza.perfect ? "encaja" : pieza.near ? "casi encaja" : "no encaja"}
                        </span>
                      </p>
                    </div>
                    <Link href={`/propiedades/${pieza.id}/editar`} className={btnGhost}>Editar inmueble</Link>
                    <button type="button" className={btnPrimary} onClick={() => void asignar(pieza.id, "manual")}>
                      {pieza.perfect ? "Asignar" : "Asignar igualmente"}
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="flex gap-4 overflow-x-auto">
              {(
                [
                  ["sugeridos", "Sugeridos", perfect.length, perfect.some((pieza) => pieza.isNew)],
                  ["asignados", "Asignados", asignados.length, pendientes.length > 0],
                  ["descartados", "Descartados", descartados.length, false],
                ] as const
              ).map(([idTab, label, count, hot]) => (
                <button key={idTab} type="button" onClick={() => setTab(idTab)} className={cn("flex shrink-0 items-center gap-1.5 border-b-2 pb-2 text-[14px] font-medium", tab === idTab ? "border-foreground text-foreground" : "border-transparent text-[var(--text-3)]")}>
                  {label}
                  <span className={cn("rounded-md px-1.5 py-0.5 font-mono text-[11px]", hot ? "bg-[var(--amber-bg)] text-[var(--amber-ink)]" : "bg-[var(--surface-soft)] text-[var(--text-2)]")}>{count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 min-[1024px]:px-5">
            <p className="text-[13px] text-[var(--text-2)]">{hints[tab]}</p>
            <div className="flex flex-wrap items-center gap-2">
              {tab === "sugeridos" && perfect.length > 1 ? (
                <button type="button" className={btnGhost} onClick={() => setOrden((actual) => (actual === "price" ? "recent" : "price"))}>
                  <ArrowUpDown className="h-3.5 w-3.5" /> {orden === "price" ? "Más baratos" : "Novedades primero"}
                </button>
              ) : null}
              {ctaSugeridos ? <button type="button" className={cn(btnPrimary, "hidden min-[1024px]:inline-flex")} onClick={() => void asignarEncajan()}>Asignar los {perfect.length} que encajan</button> : null}
              {ctaEnviar ? <button type="button" className={cn(btnPrimary, "hidden min-[1024px]:inline-flex")} onClick={() => abrirWhatsapp(pendientes, true)}>Enviar {pendientes.length} por WhatsApp</button> : null}
            </div>
          </div>

          <div className="flex flex-col">
            {filas.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-[15px] font-semibold">{vacios[tab][0]}</p>
                <p className="mt-1 text-[13px] text-[var(--text-3)]">{vacios[tab][1]}</p>
              </div>
            ) : (
              filas.map((pieza) => (
                <Fila
                  key={pieza.id}
                  pieza={pieza}
                  match={matchDe.get(pieza.id)}
                  nombre={nombre}
                  highlight={highlight === pieza.id}
                  tab={tab}
                  onAsignar={() => void asignar(pieza.id, "manual")}
                  onDescartar={() => {
                    setDiscardId(pieza.id);
                    setSheet("discard");
                  }}
                  onQuitar={() => void quitar(pieza.id)}
                  onRecuperar={() => void recuperar(pieza.id)}
                  onEstado={(status, msg) => void cambiarEstado(pieza.id, status, msg)}
                  onEnviar={(otraVez) => abrirWhatsapp([pieza], !otraVez)}
                  onNoInteresa={(motivo) => void descartar(pieza.id, motivo)}
                />
              ))
            )}
            {tab === "sugeridos" && near.length > 0 ? (
              <div className="border-t border-border px-4 py-4 min-[1024px]:px-5">
                <button type="button" onClick={() => setNearOpen((v) => !v)} className="flex w-full items-center justify-between rounded-[12px] border border-dashed border-[var(--amber)] px-4 py-3 text-left text-[14px] text-[var(--amber-ink)]">
                  {nearOpen ? "Ocultar" : "Ver"} {near.length} que casi encaja{near.length > 1 ? "n" : ""}
                  {nearOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {nearOpen ? (
                  <div className="mt-3">
                    <p className="mb-2 text-[12px] text-[var(--text-3)]">Fallan en un solo criterio y por poco. A veces merece la pena proponerlos.</p>
                    {near.map((pieza) => (
                      <Fila
                        key={pieza.id}
                        pieza={pieza}
                        match={undefined}
                        nombre={nombre}
                        highlight={false}
                        tab="sugeridos"
                        casi
                        onAsignar={() => void asignar(pieza.id, "manual")}
                        onDescartar={() => {
                          setDiscardId(pieza.id);
                          setSheet("discard");
                        }}
                        onQuitar={() => undefined}
                        onRecuperar={() => undefined}
                        onEstado={() => undefined}
                        onEnviar={() => undefined}
                        onNoInteresa={() => undefined}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      </div>

      {ctaSugeridos || ctaEnviar ? (
        <div className="fixed inset-x-0 bottom-[var(--mobile-nav-h)] z-30 bg-gradient-to-t from-[var(--background)] via-[var(--background)] to-transparent px-3.5 pb-2 pt-6 min-[1024px]:hidden">
          <button type="button" className="h-[50px] w-full rounded-[12px] bg-accent text-[15px] font-semibold text-accent-foreground" onClick={() => (ctaSugeridos ? void asignarEncajan() : abrirWhatsapp(pendientes, true))}>
            {ctaSugeridos ? `Asignar los ${perfect.length} que encajan` : `Enviar ${pendientes.length} por WhatsApp`}
          </button>
        </div>
      ) : null}

      {aviso ? (
        <div className={cn("fixed left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-[12px] bg-[var(--field)] px-4 py-3 text-[13px] shadow-[0_8px_24px_rgba(0,0,0,.45)]", ctaSugeridos || ctaEnviar ? "bottom-28 min-[1024px]:bottom-8" : "bottom-24 min-[1024px]:bottom-8")}>
          <span>{aviso.msg}</span>
          {aviso.verId ? <button type="button" className="font-semibold underline" onClick={() => ver(aviso.verId!)}>Ver</button> : null}
          <button type="button" className="font-semibold underline" onClick={() => { void aviso.revert(); setAviso(null); }}>Deshacer</button>
        </div>
      ) : null}

      {sheet === "discard" && piezaDescarte ? (
        <Capa onClose={() => setSheet(null)}>
          <h2 className="text-[17px] font-semibold">¿Por qué lo descartas?</h2>
          <p className="mt-1 text-[13px] text-[var(--text-2)]">{piezaDescarte.tituloVisible} — así evitamos sugerirte otros parecidos.</p>
          <div className="mt-4 flex flex-col gap-2">
            {MOTIVOS_DESCARTE_CRUCE.map((motivo) => (
              <button key={motivo} type="button" className="h-12 rounded-[12px] border border-[var(--input)] text-left px-4 text-[14px] font-medium" onClick={() => void descartar(piezaDescarte.id, motivo)}>{motivo}</button>
            ))}
          </div>
          <button type="button" className="mt-3 text-[13px] text-[var(--text-3)]" onClick={() => setSheet(null)}>Cancelar</button>
        </Capa>
      ) : null}

      {sheet === "criteria" && draft ? (
        <Capa onClose={() => { setSheet(null); setDraft(null); }}>
          <h2 className="text-[17px] font-semibold">Lo que busca {nombre}</h2>
          <p className="mt-1 text-[13px] text-[var(--text-2)]">Cuanto más completo, mejores sugerencias y menos ruido.</p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {[operacion, tipos.join(", ")].filter(Boolean).map((chip) => <span key={chip} className="rounded-[7px] bg-[var(--surface-soft)] px-2 py-1 text-[12px]">{chip}</span>)}
          </div>
          <p className="mt-2 text-[12px] text-[var(--text-3)]">Operación y tipo se cambian en Editar demanda. El resto de esta ficha sí filtra el stock.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-[13px] font-medium">
              Presupuesto desde
              <input value={draft.presupuestoMin} onChange={(event) => setDraft({ ...draft, presupuestoMin: event.target.value })} inputMode="numeric" placeholder="—" className={campo} />
            </label>
            <label className="flex flex-col gap-1 text-[13px] font-medium">
              Presupuesto hasta
              <input value={draft.presupuestoMax} onChange={(event) => setDraft({ ...draft, presupuestoMax: event.target.value })} inputMode="numeric" placeholder="—" className={campo} />
            </label>
          </div>
          <div className="mt-4">
            <p className="mb-2 text-[13px] font-medium">Zonas</p>
            <BuscadorLocalidad multiple value={draft.zonas} onChange={(valor) => setDraft({ ...draft, zonas: Array.isArray(valor) ? valor : valor ? [valor] : [] })} placeholder="Añadir zona" />
          </div>
          <Stepper label="Habitaciones mínimas" hint="Vacío = le da igual" valor={draft.habitacionesMin != null ? `≥ ${draft.habitacionesMin}` : "—"} onMenos={() => setDraft({ ...draft, habitacionesMin: draft.habitacionesMin != null && draft.habitacionesMin > 1 ? draft.habitacionesMin - 1 : null })} onMas={() => setDraft({ ...draft, habitacionesMin: (draft.habitacionesMin || 0) + 1 })} />
          <Stepper label="Baños mínimos" hint="Vacío = le da igual" valor={draft.banosMin != null ? `≥ ${draft.banosMin}` : "—"} onMenos={() => setDraft({ ...draft, banosMin: draft.banosMin != null && draft.banosMin > 1 ? draft.banosMin - 1 : null })} onMas={() => setDraft({ ...draft, banosMin: (draft.banosMin || 0) + 1 })} />
          <Stepper label="Superficie mínima" hint="Pasos de 10 m²" valor={draft.superficieMin != null ? `≥ ${draft.superficieMin} m²` : "—"} onMenos={() => setDraft({ ...draft, superficieMin: draft.superficieMin != null && draft.superficieMin > 50 ? draft.superficieMin - 10 : null })} onMas={() => setDraft({ ...draft, superficieMin: draft.superficieMin ? draft.superficieMin + 10 : 50 })} />
          <Stepper label="Superficie máxima" hint="Vacío = sin tope" valor={draft.superficieMax != null ? `≤ ${draft.superficieMax} m²` : "—"} onMenos={() => setDraft({ ...draft, superficieMax: draft.superficieMax != null && draft.superficieMax > 50 ? draft.superficieMax - 10 : null })} onMas={() => setDraft({ ...draft, superficieMax: draft.superficieMax ? draft.superficieMax + 10 : Math.max(draft.superficieMin ?? 50, 50) })} />
          <button type="button" onClick={() => setDraft({ ...draft, ascensor: !draft.ascensor })} className="mt-4 flex items-center gap-2.5 text-left text-[13px]">
            <span className={cn("grid h-5 w-5 place-items-center rounded-[6px] border-2", draft.ascensor ? "border-foreground bg-foreground text-[var(--background)]" : "border-[var(--input)]")}>
              {draft.ascensor ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
            </span>
            Imprescindible con ascensor
          </button>
          <p className={cn("mt-4 text-[13px]", draftMatches ? "text-[var(--green)]" : "text-[var(--amber)]")}>
            {draftMatches ? `Con estos criterios encajan ${draftMatches} ${draftMatches === 1 ? "inmueble" : "inmuebles"} de tu stock.` : "Con estos criterios no encaja ninguno ahora mismo. Puedes guardarlos igualmente: avisaremos cuando entre uno."}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className={btnGhost} onClick={() => { setSheet(null); setDraft(null); }}>Cancelar</button>
            <button type="button" className={btnPrimary} onClick={() => void guardarCriterios()}>Guardar y recalcular</button>
          </div>
        </Capa>
      ) : null}

      <NuevaDemandaPanel
        open={editar}
        onOpenChange={setEditar}
        editarId={id}
        clienteIdInicial={demanda.cliente_id}
        clienteNombre={nombre}
        onCreada={() => {
          setEditar(false);
          autoClave.current = "";
          cargar();
        }}
      />
    </div>
  );
}

const btnGhost = "inline-flex h-11 items-center gap-2 rounded-[10px] border border-[var(--input)] bg-[var(--surface)] px-3.5 text-[14px] font-medium min-[1024px]:h-10";
const campo = "h-11 rounded-[10px] border border-[var(--input)] bg-[var(--field)] px-3 text-[16px] font-normal outline-none min-[1024px]:text-[14px]";
const btnPrimary = "inline-flex h-11 items-center justify-center rounded-[10px] bg-accent px-3.5 text-[14px] font-semibold text-accent-foreground min-[1024px]:h-9";

function Modo({ activo, titulo, texto, pasos, onClick }: { activo: boolean; titulo: string; texto: string; pasos: string[]; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex items-start gap-2.5 rounded-[11px] border-[1.5px] px-3 py-3 text-left", activo ? "border-foreground bg-[var(--field)]" : "border-[var(--input)]")}>
      <span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2", activo ? "border-foreground" : "border-[var(--input)]")}>
        <span className={cn("h-2.5 w-2.5 rounded-full", activo ? "bg-foreground" : "bg-transparent")} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold">{titulo}</span>
        <span className="mt-1 block text-[12.5px] leading-relaxed text-[var(--text-2)]">{texto}</span>
        <span className="mt-2 flex items-center gap-1 overflow-hidden whitespace-nowrap text-[11px]">
          {pasos.map((paso, i) => (
            <span key={paso} className="inline-flex items-center gap-1">
              {i > 0 ? <span className="text-[var(--text-3)]">→</span> : null}
              <span className={cn("rounded-[5px] px-1.5 py-0.5", i === pasos.length - 1 ? "bg-[var(--amber-bg)] text-[var(--amber-ink)]" : "bg-[var(--surface-soft)] text-[var(--text-2)]")}>{paso}</span>
            </span>
          ))}
        </span>
      </span>
    </button>
  );
}

function Stepper({ label, hint, valor, onMenos, onMas }: { label: string; hint: string; valor: string; onMenos: () => void; onMas: () => void }) {
  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <div>
        <p className="text-[13px] font-medium">{label}</p>
        <p className="text-[12px] text-[var(--text-3)]">{hint}</p>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" className="grid h-11 w-11 place-items-center rounded-[10px] border border-[var(--input)] text-[18px]" onClick={onMenos}>−</button>
        <span className="min-w-[4.5rem] text-center text-[14px] font-medium">{valor}</span>
        <button type="button" className="grid h-11 w-11 place-items-center rounded-[10px] border border-[var(--input)] text-[18px]" onClick={onMas}>+</button>
      </div>
    </div>
  );
}

function Capa({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 min-[1024px]:items-center" onClick={onClose}>
      <div className="max-h-[90dvh] w-full overflow-y-auto rounded-t-[16px] bg-[var(--surface)] p-5 min-[1024px]:max-w-lg min-[1024px]:rounded-[16px]" onClick={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function Fila({
  pieza,
  match,
  nombre,
  highlight,
  tab,
  casi,
  onAsignar,
  onDescartar,
  onQuitar,
  onRecuperar,
  onEstado,
  onEnviar,
  onNoInteresa,
}: {
  pieza: Pieza;
  match?: MatchFila;
  nombre: string;
  highlight: boolean;
  tab: Tab;
  casi?: boolean;
  onAsignar: () => void;
  onDescartar: () => void;
  onQuitar: () => void;
  onRecuperar: () => void;
  onEstado: (status: EstadoAsignacion, msg: string) => void;
  onEnviar: (otraVez: boolean) => void;
  onNoInteresa: (motivo: string) => void;
}) {
  const status = match ? estadoAsignacionDe(match.estado) : null;
  const color = pieza.perfect ? "var(--green)" : pieza.near ? "var(--amber)" : "var(--red)";
  const quien = match?.origen === "automatico" ? "Lo asignó el sistema" : "Lo asignaste tú";
  const meta = [pieza.localidad, pieza.precio != null ? formatEuro(pieza.precio) : null, pieza.superficie_util || pieza.superficie_m2 ? `${num(pieza.superficie_util) ?? num(pieza.superficie_m2)} m²` : null, pieza.habitaciones != null ? `${pieza.habitaciones} hab` : null, pieza.banos != null ? `${pieza.banos} baños` : null].filter(Boolean).join(" · ");

  return (
    <article className={cn("border-b border-[var(--border-soft)] px-4 py-4 min-[1024px]:px-5", highlight && "bg-[var(--green-bg)]")}>
      <div className="grid grid-cols-[56px_minmax(0,1fr)] gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-[10px] border text-center" style={{ borderColor: color, color }}>
          <span className="font-mono text-[15px] font-semibold leading-none">{pieza.passed}/{pieza.total}</span>
          <span className="mt-0.5 text-[9px] font-medium tracking-[0.06em]">CUMPLE</span>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {pieza.referencia ? <span className="font-mono text-[12px] text-[var(--text-3)]">{pieza.referencia}</span> : null}
            <FichaLink tipo="propiedad" id={pieza.id} className="text-[15px] font-semibold">{pieza.tituloVisible}</FichaLink>
            {pieza.isNew && tab === "sugeridos" ? <span className="rounded bg-[var(--blue-bg)] px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.06em] text-[var(--blue)]">NUEVO</span> : null}
          </div>
          <p className="mt-0.5 text-[13px] text-[var(--text-2)]">{meta}</p>
          {tab === "asignados" && status ? <Pasos status={status} nota={`${quien}. ${notaPaso(status, nombre)}`} /> : null}
          {tab === "descartados" ? (
            <p className="mt-2 text-[12px]"><span className="rounded-full bg-[var(--red-bg)] px-2 py-0.5 text-[var(--red)]">Descartado</span> <span className="text-[var(--text-2)]">{match?.notas}</span></p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {pieza.checks.map((check) => (
              <span key={check.label} className={cn("rounded-[6px] px-1.5 py-0.5 text-[12px]", check.ok ? "bg-[var(--green-bg)] text-[var(--green)]" : "bg-[var(--red-bg)] text-[var(--red)]")}>
                {check.ok ? "✓" : "✕"} {check.label}
              </span>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link href={`/propiedades/${pieza.id}/editar`} className={btnGhost}>Editar inmueble</Link>
            {tab === "sugeridos" || casi ? (
              <>
                <button type="button" className={btnGhost} onClick={onDescartar}>Descartar</button>
                <button type="button" className={btnPrimary} onClick={onAsignar}>{casi || !pieza.perfect ? "Asignar igualmente" : "Asignar"}</button>
              </>
            ) : null}
            {tab === "asignados" && status === "pending" ? (
              <>
                <button type="button" className={btnGhost} onClick={onQuitar}>Quitar</button>
                <button type="button" className={btnPrimary} onClick={() => onEnviar(false)}>Enviar por WhatsApp</button>
              </>
            ) : null}
            {tab === "asignados" && status === "sent" ? (
              <>
                <span className="text-[13px] font-medium">¿Qué le ha parecido?</span>
                <button type="button" className={btnBad} onClick={() => onNoInteresa("No le interesó a la clienta")}>No le interesa</button>
                <button type="button" className={btnInfo} onClick={() => onEstado("visit", "Visita anotada.")}>Visita</button>
                <button type="button" className={btnGood} onClick={() => onEstado("interested", "Marcado como le interesa.")}>Le interesa</button>
                <button type="button" className="text-[12px] text-[var(--text-3)] underline" onClick={() => onEnviar(true)}>Reenviar por WhatsApp</button>
                <button type="button" className="text-[12px] text-[var(--text-3)] underline" onClick={onQuitar}>Quitar</button>
              </>
            ) : null}
            {tab === "asignados" && status === "interested" ? (
              <>
                <button type="button" className={btnPrimary} onClick={() => onEstado("visit", "Visita anotada.")}>Programar visita</button>
                <button type="button" className="text-[12px] text-[var(--text-3)] underline" onClick={() => onEnviar(true)}>Reenviar por WhatsApp</button>
                <button type="button" className="text-[12px] text-[var(--text-3)] underline" onClick={onQuitar}>Quitar</button>
              </>
            ) : null}
            {tab === "asignados" && status === "visit" ? (
              <>
                <span className="text-[13px] font-medium">Después de la visita:</span>
                <button type="button" className={btnBad} onClick={() => onNoInteresa("No le convenció en la visita")}>No le convenció</button>
                <button type="button" className={btnGood} onClick={() => onEstado("interested", "Sigue interesada.")}>Sigue interesada</button>
                <button type="button" className="text-[12px] text-[var(--text-3)] underline" onClick={onQuitar}>Quitar</button>
              </>
            ) : null}
            {tab === "descartados" ? <button type="button" className={btnGhost} onClick={onRecuperar}>Recuperar</button> : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function notaPaso(status: EstadoAsignacion, nombre: string): string {
  if (status === "pending") return `Siguiente paso: enviárselo a ${nombre}.`;
  if (status === "sent") return "Ya se lo enviaste; falta saber qué le parece.";
  if (status === "interested") return "Le interesa: buen momento para proponer una visita.";
  return "Visita pendiente; anota después qué le pareció.";
}

function Pasos({ status, nota }: { status: EstadoAsignacion; nota: string }) {
  const stage = status === "pending" ? 0 : status === "sent" ? 1 : 2;
  const etiquetas = ["Asignado", "Enviado", "Respuesta"];
  return (
    <div className="mt-2 max-w-[560px] rounded-[11px] bg-[var(--field)] px-3 py-2.5">
      <div className="flex items-center gap-2">
        {etiquetas.map((etiqueta, i) => {
          const hecho = i < stage;
          const actual = i === stage;
          return (
            <div key={etiqueta} className="flex items-center gap-2">
              <span className={cn("grid h-5 w-5 place-items-center rounded-full border text-[11px]", hecho ? "border-[var(--green)] bg-[var(--green)] text-[var(--on-green)]" : actual ? "border-foreground text-foreground" : "border-[var(--input)] text-[var(--text-3)]")}>{hecho ? "✓" : i + 1}</span>
              <span className={cn("text-[12px]", hecho || actual ? "text-foreground" : "text-[var(--text-3)]")}>{etiqueta}</span>
              {i < 2 ? <span className={cn("h-px w-4", hecho ? "bg-[var(--green)]" : "bg-[var(--input)]")} /> : null}
            </div>
          );
        })}
      </div>
      <p className="mt-1.5 text-[12px] text-[var(--text-2)]">{nota}</p>
    </div>
  );
}

const btnGood = "inline-flex h-11 items-center rounded-[10px] bg-[var(--green-bg)] px-3 text-[13px] font-semibold text-[var(--green)] min-[1024px]:h-9";
const btnBad = "inline-flex h-11 items-center rounded-[10px] bg-[var(--red-bg)] px-3 text-[13px] font-semibold text-[var(--red)] min-[1024px]:h-9";
const btnInfo = "inline-flex h-11 items-center rounded-[10px] bg-[var(--blue-bg)] px-3 text-[13px] font-semibold text-[var(--blue)] min-[1024px]:h-9";
