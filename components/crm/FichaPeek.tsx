"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Sheet } from "@/components/ui/sheet";
import { PanelInmueble } from "@/components/inmuebles/PanelInmueble";
import { cargarInmueblePanel, type InmueblePanel } from "@/lib/inmuebles/panel";
import { relacionUno } from "@/lib/citas/citas";
import { inicialesNombre } from "@/lib/ui/tokens";
import { formatEuro, telWhatsApp } from "@/lib/ui/estados-vista";
import { ESTADO_PARTE_LABELS } from "@/lib/partes-visita";
import { cn } from "@/lib/utils";

export type DestinoFicha =
  | { tipo: "propiedad"; id: string }
  | { tipo: "cliente"; id: string }
  | { tipo: "demanda"; id: string }
  | { tipo: "parte"; id: string }
  | { tipo: "finca"; id: string };

type FichaPeekCtx = {
  abrir: (destino: DestinoFicha) => void;
  atras: () => void;
  cerrarTodo: () => void;
};

const FichaPeekContext = createContext<FichaPeekCtx | null>(null);

export function useFichaPeek(): FichaPeekCtx {
  return useContext(FichaPeekContext) ?? { abrir: () => undefined, atras: () => undefined, cerrarTodo: () => undefined };
}

export function FichaLink({
  tipo,
  id,
  className,
  children,
}: {
  tipo: DestinoFicha["tipo"];
  id: string;
  className?: string;
  children: ReactNode;
}) {
  const { abrir } = useFichaPeek();
  if (!id) return <span className={className}>{children}</span>;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        abrir({ tipo, id });
      }}
      className={cn("text-left font-medium text-accent hover:underline", className)}
    >
      {children}
    </button>
  );
}

export function FichaPeekProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [pila, setPila] = useState<DestinoFicha[]>([]);
  const pilaRef = useRef(pila);
  const ignorePop = useRef(0);
  const pathRef = useRef(pathname);
  pilaRef.current = pila;

  const abrir = useCallback((destino: DestinoFicha) => {
    const prev = pilaRef.current;
    const top = prev[prev.length - 1];
    if (top && top.tipo === destino.tipo && top.id === destino.id) return;
    const ruta = rutaFichaCompleta(destino);
    if (ruta && pathRef.current === ruta) {
      if (!prev.length) return;
      ignorePop.current = prev.length;
      setPila([]);
      window.history.go(-prev.length);
      return;
    }
    window.history.pushState({ crmPeek: prev.length + 1 }, "");
    setPila([...prev, destino]);
  }, []);

  const atras = useCallback(() => {
    if (!pilaRef.current.length) return;
    window.history.back();
  }, []);

  const cerrarTodo = useCallback(() => {
    const n = pilaRef.current.length;
    if (!n) return;
    ignorePop.current = n;
    setPila([]);
    window.history.go(-n);
  }, []);

  useEffect(() => {
    const onPop = () => {
      if (ignorePop.current > 0) {
        ignorePop.current -= 1;
        return;
      }
      setPila((prev) => (prev.length ? prev.slice(0, -1) : prev));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (pathRef.current === pathname) return;
    pathRef.current = pathname;
    setPila([]);
  }, [pathname]);

  const value = useMemo(() => ({ abrir, atras, cerrarTodo }), [abrir, atras, cerrarTodo]);
  const actual = pila[pila.length - 1] ?? null;

  return (
    <FichaPeekContext.Provider value={value}>
      {children}
      <FichaPeekHost destino={actual} niveles={pila.length} onAtras={atras} onCerrar={cerrarTodo} />
    </FichaPeekContext.Provider>
  );
}

function rutaFichaCompleta(destino: DestinoFicha) {
  if (destino.tipo === "propiedad") return `/propiedades/${destino.id}`;
  if (destino.tipo === "cliente") return `/clientes/${destino.id}`;
  if (destino.tipo === "demanda") return `/demandas/${destino.id}`;
  if (destino.tipo === "parte") return `/partes-visita/${destino.id}`;
  return null;
}

function tituloPeek(destino: DestinoFicha) {
  if (destino.tipo === "propiedad") return "Inmueble";
  if (destino.tipo === "cliente") return "Cliente";
  if (destino.tipo === "demanda") return "Demanda";
  if (destino.tipo === "parte") return "Parte de visita";
  return "Finca";
}

type ClientePeek = {
  nombre: string;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  codigo_postal: string | null;
  localidad: string | null;
  tipo_cliente: string | null;
  propiedades: Array<{ id: string; titulo: string | null; direccion: string | null }>;
  demandas: Array<{ id: string; tipo_operacion: string; estado: string; zonas: string[] | null }>;
};

type DemandaPeek = {
  cliente_id: string;
  tipo_operacion: string;
  estado: string;
  zonas: string[] | null;
  presupuesto_min: number | null;
  presupuesto_max: number | null;
  superficie_min: number | null;
  superficie_max: number | null;
  habitaciones_min: number | null;
  requisitos: string | null;
  cliente: string;
  matches: Array<{ id: string; titulo: string }>;
};

type PartePeek = {
  visitante_nombre: string | null;
  inmueble_direccion: string | null;
  fecha_visita: string | null;
  hora_visita: string | null;
  estado: keyof typeof ESTADO_PARTE_LABELS;
  propiedad_id: string | null;
};

function FichaPeekHost({
  destino,
  niveles,
  onAtras,
  onCerrar,
}: {
  destino: DestinoFicha | null;
  niveles: number;
  onAtras: () => void;
  onCerrar: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [inmueble, setInmueble] = useState<InmueblePanel | null>(null);
  const [cliente, setCliente] = useState<ClientePeek | null>(null);
  const [demanda, setDemanda] = useState<DemandaPeek | null>(null);
  const [parte, setParte] = useState<PartePeek | null>(null);
  const [finca, setFinca] = useState<{ referencia: string; postal: string | null } | null>(null);

  useEffect(() => {
    setInmueble(null);
    setCliente(null);
    setDemanda(null);
    setParte(null);
    setFinca(null);
    if (!destino) return;
    const supabase = createClient();
    let cancelled = false;
    setLoading(true);
    const done = () => {
      if (!cancelled) setLoading(false);
    };

    if (destino.tipo === "propiedad") {
      void cargarInmueblePanel(destino.id).then((data) => {
        if (!cancelled) setInmueble(data);
        done();
      });
    } else if (destino.tipo === "cliente") {
      void Promise.all([
        supabase
          .from("clientes")
          .select("nombre, telefono, email, direccion, codigo_postal, localidad, tipo_cliente")
          .eq("id", destino.id)
          .maybeSingle(),
        supabase.from("propiedades").select("id, titulo, direccion").eq("ofertante_id", destino.id).order("titulo").limit(8),
        supabase.from("demandas").select("id, tipo_operacion, estado, zonas").eq("cliente_id", destino.id).order("updated_at", { ascending: false }).limit(8),
      ]).then(([cli, props, dems]) => {
        if (cancelled || !cli.data) {
          if (!cancelled) setCliente(null);
          done();
          return;
        }
        setCliente({
          ...(cli.data as Omit<ClientePeek, "propiedades" | "demandas">),
          propiedades: (props.data ?? []) as ClientePeek["propiedades"],
          demandas: (dems.data ?? []) as ClientePeek["demandas"],
        });
        done();
      });
    } else if (destino.tipo === "demanda") {
      void Promise.all([
        supabase
          .from("demandas")
          .select(
            "cliente_id, tipo_operacion, estado, zonas, presupuesto_min, presupuesto_max, superficie_min, superficie_max, habitaciones_min, requisitos, clientes:cliente_id(nombre)"
          )
          .eq("id", destino.id)
          .maybeSingle(),
        supabase
          .from("demanda_inmuebles")
          .select("propiedad_id, propiedades:propiedad_id(titulo, direccion)")
          .eq("demanda_id", destino.id)
          .order("puntuacion", { ascending: false })
          .limit(6),
      ]).then(([dem, matches]) => {
        if (cancelled || !dem.data) {
          if (!cancelled) setDemanda(null);
          done();
          return;
        }
        const fila = dem.data as DemandaPeek & { clientes?: { nombre?: string | null } | { nombre?: string | null }[] | null };
        setDemanda({
          cliente_id: fila.cliente_id,
          tipo_operacion: fila.tipo_operacion,
          estado: fila.estado,
          zonas: fila.zonas,
          presupuesto_min: fila.presupuesto_min,
          presupuesto_max: fila.presupuesto_max,
          superficie_min: fila.superficie_min,
          superficie_max: fila.superficie_max,
          habitaciones_min: fila.habitaciones_min,
          requisitos: fila.requisitos,
          cliente: relacionUno(fila.clientes)?.nombre ?? "Cliente",
          matches: ((matches.data ?? []) as Array<{
            propiedad_id: string;
            propiedades?: { titulo?: string | null; direccion?: string | null } | { titulo?: string | null; direccion?: string | null }[] | null;
          }>).map((row) => ({
            id: row.propiedad_id,
            titulo: relacionUno(row.propiedades)?.titulo || relacionUno(row.propiedades)?.direccion || "Inmueble",
          })),
        });
        done();
      });
    } else if (destino.tipo === "parte") {
      void supabase
        .from("partes_visita")
        .select("visitante_nombre, inmueble_direccion, fecha_visita, hora_visita, estado, propiedad_id")
        .eq("id", destino.id)
        .maybeSingle()
        .then(({ data }) => {
          if (!cancelled) setParte((data as PartePeek | null) ?? null);
          done();
        });
    } else {
      void supabase
        .from("catastro_fincas")
        .select("finca_reference, postal_code")
        .eq("finca_reference", destino.id)
        .maybeSingle()
        .then(({ data }) => {
          if (!cancelled) setFinca({ referencia: destino.id, postal: data?.postal_code ?? null });
          done();
        });
    }

    return () => {
      cancelled = true;
    };
  }, [destino]);

  return (
    <Sheet open={Boolean(destino)} onOpenChange={(open) => !open && onAtras()} variant="side" side="right" elevated>
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2.5 border-b border-[var(--border-soft)] px-4 py-3.5">
          <button type="button" onClick={onAtras} className="text-[12.5px] font-semibold text-accent">
            ← Atrás
          </button>
          <span className="flex-1 text-[11px] uppercase tracking-[.08em] text-[var(--label)]">
            {destino ? tituloPeek(destino) : ""}
            {niveles > 1 ? ` · ${niveles}` : ""}
          </span>
          <button
            type="button"
            onClick={onCerrar}
            className="grid h-[34px] w-[34px] place-items-center rounded-lg text-[var(--text-2)] hover:bg-[var(--surface-soft)]"
            aria-label="Cerrar ficha"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M6 6l12 12" />
              <path d="M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y">
          {loading ? (
            <p className="px-4 py-8 text-center text-[13px] text-[var(--text-2)]">Cargando…</p>
          ) : destino?.tipo === "propiedad" && inmueble ? (
            <PanelInmueble inmueble={inmueble} embedded />
          ) : destino?.tipo === "cliente" && cliente ? (
            <FichaCliente cliente={cliente} />
          ) : destino?.tipo === "demanda" && demanda ? (
            <FichaDemanda demanda={demanda} />
          ) : destino?.tipo === "parte" && parte ? (
            <FichaParte parte={parte} />
          ) : destino?.tipo === "finca" && finca ? (
            <FichaFinca finca={finca} />
          ) : (
            <p className="px-4 py-8 text-center text-[13px] text-[var(--text-2)]">No se ha encontrado la ficha.</p>
          )}
        </div>
        {destino && rutaFichaCompleta(destino) ? (
          <div className="border-t border-[var(--border-soft)] px-4 py-3">
            <Link href={rutaFichaCompleta(destino)!} className="text-[12.5px] font-medium text-accent hover:underline">
              Abrir ficha completa
            </Link>
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}

function FichaCliente({ cliente }: { cliente: ClientePeek }) {
  const wa = telWhatsApp(cliente.telefono);
  return (
    <div>
      <div className="flex items-center gap-3 border-b border-[var(--border-soft)] px-4 py-4">
        <span className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full bg-accent-soft text-[15px] font-semibold text-accent-dark">
          {inicialesNombre(cliente.nombre)}
        </span>
        <div className="min-w-0">
          <h2 className="text-[18px] font-semibold tracking-tight">{cliente.nombre}</h2>
          <p className="mt-0.5 text-[12.5px] text-[var(--text-2)]">{cliente.tipo_cliente || "Cliente"}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-[var(--border-soft)] px-4 py-3">
        {cliente.telefono ? (
          <a href={`tel:${cliente.telefono}`} className="flex h-[38px] flex-[1_1_90px] items-center justify-center rounded-[9px] border border-[var(--input)] text-[13px] font-semibold">
            Llamar
          </a>
        ) : null}
        {wa ? (
          <a href={wa} target="_blank" rel="noreferrer" className="flex h-[38px] flex-[1_1_90px] items-center justify-center rounded-[9px] border border-[var(--input)] text-[13px] font-semibold">
            WhatsApp
          </a>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2.5 border-b border-[var(--border-soft)] px-4 py-3">
        <Dato label="Teléfono" valor={cliente.telefono || "—"} />
        <Dato label="Email" valor={cliente.email || "—"} />
        <div className="col-span-2">
          <Dato label="Dirección" valor={[cliente.direccion, cliente.codigo_postal, cliente.localidad].filter(Boolean).join(", ") || "—"} />
        </div>
      </div>
      <ListaPeek
        titulo="Inmuebles"
        vacio="Ningún inmueble"
        items={cliente.propiedades.map((p) => ({
          id: p.id,
          tipo: "propiedad" as const,
          texto: p.titulo || p.direccion || "Inmueble",
        }))}
      />
      <ListaPeek
        titulo="Demandas"
        vacio="Ninguna demanda"
        items={cliente.demandas.map((d) => ({
          id: d.id,
          tipo: "demanda" as const,
          texto: `${d.tipo_operacion}${d.zonas?.length ? ` · ${d.zonas[0]}` : ""}`,
        }))}
      />
    </div>
  );
}

function FichaDemanda({ demanda }: { demanda: DemandaPeek }) {
  const presupuesto =
    demanda.presupuesto_min != null || demanda.presupuesto_max != null
      ? `${formatEuro(demanda.presupuesto_min)} – ${formatEuro(demanda.presupuesto_max)}`
      : "—";
  return (
    <div className="px-4 py-4">
      <FichaLink tipo="cliente" id={demanda.cliente_id} className="text-[18px] font-semibold tracking-tight text-foreground hover:text-accent">
        {demanda.cliente}
      </FichaLink>
      <p className="mt-0.5 text-[12.5px] capitalize text-[var(--text-2)]">
        {demanda.tipo_operacion} · {demanda.estado}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <Dato label="Zonas" valor={demanda.zonas?.join(", ") || "—"} />
        <Dato label="Presupuesto" valor={presupuesto} />
        <Dato
          label="Superficie"
          valor={
            demanda.superficie_min != null || demanda.superficie_max != null
              ? `${demanda.superficie_min ?? "—"}–${demanda.superficie_max ?? "—"} m²`
              : "—"
          }
        />
        <Dato label="Habitaciones" valor={demanda.habitaciones_min != null ? `desde ${demanda.habitaciones_min}` : "—"} />
      </div>
      {demanda.requisitos ? <p className="mt-4 text-[13px] leading-relaxed text-[var(--text-2)]">{demanda.requisitos}</p> : null}
      <div className="mt-4">
        <ListaPeek
          titulo="Inmuebles que encajan"
          vacio="Ninguno aún"
          items={demanda.matches.map((m) => ({ id: m.id, tipo: "propiedad" as const, texto: m.titulo }))}
        />
      </div>
    </div>
  );
}

function FichaParte({ parte }: { parte: PartePeek }) {
  return (
    <div className="px-4 py-4">
      <h2 className="text-[18px] font-semibold tracking-tight">{parte.visitante_nombre || "Visita"}</h2>
      <p className="mt-0.5 text-[12.5px] text-[var(--text-2)]">{ESTADO_PARTE_LABELS[parte.estado] ?? parte.estado}</p>
      <div className="mt-4 grid gap-2.5">
        <div>
          <div className="text-[11px] uppercase tracking-[.07em] text-[var(--label)]">Inmueble</div>
          {parte.propiedad_id ? (
            <FichaLink tipo="propiedad" id={parte.propiedad_id} className="mt-0.5 text-[13.5px]">
              {parte.inmueble_direccion || "Ver inmueble"}
            </FichaLink>
          ) : (
            <div className="mt-0.5 text-[13.5px]">{parte.inmueble_direccion || "—"}</div>
          )}
        </div>
        <Dato label="Fecha" valor={[parte.fecha_visita, parte.hora_visita?.slice(0, 5)].filter(Boolean).join(" · ") || "—"} />
      </div>
    </div>
  );
}

function FichaFinca({ finca }: { finca: { referencia: string; postal: string | null } }) {
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(finca.referencia);
      toast.success("Referencia copiada.");
    } catch {
      toast.error("No se ha podido copiar.");
    }
  };
  return (
    <div className="px-4 py-4">
      <h2 className="font-mono text-[16px] font-semibold tracking-tight">{finca.referencia}</h2>
      <p className="mt-0.5 text-[12.5px] text-[var(--text-2)]">Finca de Catastro{finca.postal ? ` · CP ${finca.postal}` : ""}</p>
      <button type="button" onClick={() => void copiar()} className="mt-4 h-[38px] rounded-[9px] border border-[var(--input)] px-3 text-[13px] font-semibold">
        Copiar referencia
      </button>
    </div>
  );
}

function ListaPeek({
  titulo,
  vacio,
  items,
}: {
  titulo: string;
  vacio: string;
  items: Array<{ id: string; tipo: DestinoFicha["tipo"]; texto: string }>;
}) {
  return (
    <div className="border-b border-[var(--border-row)] px-4 py-2.5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[13px] font-semibold">{titulo}</h3>
        <span className="text-[12px] text-[var(--text-2)]">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="mt-1.5 text-[12.5px] text-[var(--text-3)]">{vacio}</p>
      ) : (
        items.map((item) => (
          <FichaLink key={item.id} tipo={item.tipo} id={item.id} className="mt-1.5 block truncate text-[13px]">
            {item.texto}
          </FichaLink>
        ))
      )}
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-[.07em] text-[var(--label)]">{label}</div>
      <div className="mt-0.5 text-[13.5px]">{valor}</div>
    </div>
  );
}
