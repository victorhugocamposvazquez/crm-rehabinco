"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Layers, Loader2, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BarraPagina, BotonBarra, BotonPrincipal } from "@/components/layout/BarraPagina";
import {
  recortarRecuadro,
  textoRecuadro,
  type EdificioMapa,
} from "@/lib/catastro/mapa/inspire";
import {
  aplicarFiltros,
  buscarEdificios,
  contarFiltrosActivos,
  csvDirecciones,
  FILTROS_VACIOS,
  ordenarEdificios,
  type FiltrosMapa,
} from "@/lib/catastro/mapa/filtros";
import { ZOOM_MIN_EDIFICIOS, type RecuadroMapa, type VistaMapa } from "./MapaEdificios";
import { TarjetaEdificio } from "./TarjetaEdificio";
import { PanelFiltrosEdificios } from "./PanelFiltrosEdificios";
import { FichaEdificio } from "./FichaEdificio";

const MapaEdificios = dynamic(() => import("./MapaEdificios").then((m) => m.MapaEdificios), { ssr: false });

const CLAVE_VISTA = "catastro-mapa:vista";
/** Plaza de María Pita (A Coruña). */
const VISTA_INICIAL: VistaMapa = { lat: 43.3705, lng: -8.3965, zoom: 17 };

function leerVista(): VistaMapa {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_VISTA) ?? "null") as VistaMapa | null;
    if (v && Number.isFinite(v.lat) && Number.isFinite(v.lng) && Number.isFinite(v.zoom)) return v;
  } catch {
    /* ignore */
  }
  return VISTA_INICIAL;
}

type Estado =
  | { tipo: "zoom" }
  | { tipo: "cargando" }
  | { tipo: "listo"; recortado: boolean; sinDirecciones: boolean }
  | { tipo: "error"; mensaje: string };

export function ExploradorEdificios() {
  const [vistaInicial, setVistaInicial] = useState<VistaMapa | null>(null);
  const [edificios, setEdificios] = useState<EdificioMapa[]>([]);
  const [estado, setEstado] = useState<Estado>({ tipo: "zoom" });
  const [filtros, setFiltros] = useState<FiltrosMapa>(FILTROS_VACIOS);
  const [consulta, setConsulta] = useState("");
  const [panelFiltros, setPanelFiltros] = useState(false);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [trabajados, setTrabajados] = useState<Set<string>>(new Set());
  const [ortofoto, setOrtofoto] = useState(false);
  const peticion = useRef<AbortController | null>(null);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ultimoRecuadro = useRef("");

  useEffect(() => setVistaInicial(leerVista()), []);

  const cargar = useCallback(async (recuadro: RecuadroMapa) => {
    const { recuadro: r, recortado } = recortarRecuadro(recuadro);
    const clave = textoRecuadro(r);
    if (clave === ultimoRecuadro.current) return;
    ultimoRecuadro.current = clave;
    peticion.current?.abort();
    const ctrl = new AbortController();
    peticion.current = ctrl;
    setEstado({ tipo: "cargando" });
    try {
      const res = await fetch(`/api/catastro/mapa?bbox=${clave}`, { signal: ctrl.signal });
      const json = (await res.json()) as { ok: boolean; error?: string; edificios?: EdificioMapa[]; sinDirecciones?: boolean };
      if (!res.ok || !json.ok) throw new Error(json.error || `Error ${res.status}`);
      const lista = json.edificios ?? [];
      setEdificios(lista);
      setEstado({ tipo: "listo", recortado, sinDirecciones: Boolean(json.sinDirecciones) });
      if (lista.length) {
        const r2 = await fetch(`/api/catastro/mapa/trabajados?refs=${lista.map((e) => e.ref).join(",")}`, { signal: ctrl.signal });
        const j2 = (await r2.json()) as { ok: boolean; trabajados?: string[] };
        if (j2.ok) setTrabajados(new Set(j2.trabajados ?? []));
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      ultimoRecuadro.current = "";
      setEstado({ tipo: "error", mensaje: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  const alMover = useCallback(
    (vista: VistaMapa, recuadro: RecuadroMapa) => {
      try {
        localStorage.setItem(CLAVE_VISTA, JSON.stringify(vista));
      } catch {
        /* ignore */
      }
      if (espera.current) clearTimeout(espera.current);
      if (vista.zoom < ZOOM_MIN_EDIFICIOS) {
        peticion.current?.abort();
        ultimoRecuadro.current = "";
        setEstado({ tipo: "zoom" });
        return;
      }
      espera.current = setTimeout(() => void cargar(recuadro), 350);
    },
    [cargar]
  );

  const visibles = useMemo(
    () => ordenarEdificios(buscarEdificios(aplicarFiltros(edificios, filtros, trabajados), consulta)),
    [edificios, filtros, trabajados, consulta]
  );
  const elegido = seleccion ? edificios.find((e) => e.ref === seleccion) ?? null : null;
  const activos = contarFiltrosActivos(filtros);

  const marcar = async (ref: string, trabajado: boolean) => {
    setTrabajados((prev) => {
      const s = new Set(prev);
      if (trabajado) s.add(ref);
      else s.delete(ref);
      return s;
    });
    const res = await fetch("/api/catastro/mapa/trabajados", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref, trabajado }),
    }).catch(() => null);
    if (!res?.ok) {
      toast.error("No se ha podido guardar la marca.");
      setTrabajados((prev) => {
        const s = new Set(prev);
        if (trabajado) s.delete(ref);
        else s.add(ref);
        return s;
      });
    }
  };

  const descargar = () => {
    if (!visibles.length) return;
    const blob = new Blob([csvDirecciones(visibles, trabajados)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `direcciones-catastro-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="-mx-3.5 -mb-[var(--mobile-content-pb)] -mt-6 flex flex-col min-[820px]:-mx-6 min-[820px]:-mb-10"
      style={{ height: "calc(100dvh - 6.4rem)" }}
      data-testid="explorador-edificios"
    >
      <BarraPagina
        titulo="Mapa de edificios"
        acciones={
          <BotonPrincipal onClick={descargar} disabled={!visibles.length} title="Descarga las direcciones de los edificios de la lista">
            <Download className="h-4 w-4" aria-hidden />
            Descargar direcciones
          </BotonPrincipal>
        }
      >
        <label className="flex h-10 min-w-[200px] flex-1 items-center gap-2 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 focus-within:border-[var(--border-strong)] min-[820px]:max-w-[420px]">
          <Search className="h-4 w-4 shrink-0 text-[var(--text-3)]" aria-hidden />
          <input
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            placeholder="Dirección o referencia catastral"
            className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-3)]"
            aria-label="Buscar en el mapa"
          />
        </label>
        <BotonBarra activo={panelFiltros || activos > 0} onClick={() => setPanelFiltros((v) => !v)} aria-expanded={panelFiltros}>
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          Filtros
          {activos ? (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--accent)] px-1 text-[11px] text-[var(--accent-foreground)]">{activos}</span>
          ) : null}
        </BotonBarra>
        <BotonBarra activo={ortofoto} onClick={() => setOrtofoto((v) => !v)} title="Cambiar entre mapa y ortofoto">
          <Layers className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">{ortofoto ? "Ortofoto" : "Mapa"}</span>
        </BotonBarra>
      </BarraPagina>

      <div className="relative flex min-h-0 flex-1 flex-col-reverse min-[900px]:flex-row">
        <aside className="relative flex min-h-0 flex-1 flex-col bg-[var(--surface)] min-[900px]:w-[44%] min-[900px]:max-w-[680px] min-[900px]:flex-none min-[900px]:border-r min-[900px]:border-[var(--border)]">
          {panelFiltros ? (
            <PanelFiltrosEdificios
              filtros={filtros}
              total={aplicarFiltros(edificios, filtros, trabajados).length}
              onCambio={setFiltros}
              onCerrar={() => setPanelFiltros(false)}
            />
          ) : null}
          {elegido ? (
            <FichaEdificio
              edificio={elegido}
              trabajado={trabajados.has(elegido.ref)}
              onMarcar={(v) => void marcar(elegido.ref, v)}
              onCerrar={() => setSeleccion(null)}
            />
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 min-[820px]:px-5">
              <EstadoLista estado={estado} visibles={visibles.length} total={edificios.length} />
              <div className="grid gap-3 sm:grid-cols-2">
                {visibles.slice(0, 300).map((e) => (
                  <TarjetaEdificio
                    key={e.ref}
                    edificio={e}
                    trabajado={trabajados.has(e.ref)}
                    onAbrir={() => setSeleccion(e.ref)}
                  />
                ))}
              </div>
              {visibles.length > 300 ? (
                <p className="mt-4 text-center text-[13px] text-[var(--text-3)]">Mostrando 300 de {visibles.length}. Filtra o acerca el mapa para ver el resto.</p>
              ) : null}
            </div>
          )}
        </aside>
        <div className="relative h-[42vh] shrink-0 min-[900px]:h-auto min-[900px]:flex-1">
          {vistaInicial ? (
            <MapaEdificios
              vista={vistaInicial}
              edificios={visibles}
              trabajados={trabajados}
              seleccion={seleccion}
              ortofoto={ortofoto}
              onMover={alMover}
              onSeleccionar={setSeleccion}
            />
          ) : null}
          <LeyendaMapa />
        </div>
      </div>
    </div>
  );
}

function EstadoLista({ estado, visibles, total }: { estado: Estado; visibles: number; total: number }) {
  if (estado.tipo === "zoom") {
    return <p className="mb-4 text-[15px] text-[var(--text-2)]">Acerca el mapa a nivel de calle para ver los edificios.</p>;
  }
  if (estado.tipo === "cargando") {
    return (
      <p className="mb-4 flex items-center gap-2 text-[15px] text-[var(--text-2)]">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Consultando el Catastro…
      </p>
    );
  }
  if (estado.tipo === "error") {
    return <p className="mb-4 rounded-[6px] bg-[var(--red-bg)] px-3 py-2 text-[14px] text-[var(--red)]">{estado.mensaje}</p>;
  }
  return (
    <div className="mb-4 space-y-1">
      <p className="text-base">
        <span className="font-semibold">{visibles.toLocaleString("es-ES")}</span>
        <span className="text-[var(--text-2)]"> de {total.toLocaleString("es-ES")} edificios en el mapa</span>
      </p>
      {estado.recortado ? <p className="text-[12px] text-[var(--text-3)]">Zona amplia: se muestran los edificios del centro del mapa.</p> : null}
      {estado.sinDirecciones ? <p className="text-[12px] text-[var(--text-3)]">El Catastro no ha devuelto los portales; faltan direcciones.</p> : null}
    </div>
  );
}

function LeyendaMapa() {
  const item = (color: string, texto: string) => (
    <span className="flex items-center gap-1.5">
      <i className={cn("inline-block h-2.5 w-2.5 rounded-[3px]")} style={{ background: color }} />
      {texto}
    </span>
  );
  return (
    <div className="pointer-events-none absolute bottom-6 left-3 z-[500] flex flex-wrap gap-3 rounded-[8px] bg-[var(--surface)]/95 px-3 py-2 text-[12px] text-[var(--text-2)] shadow-[var(--sombra-aire)]">
      {item("#0f766e", "Con división horizontal")}
      {item("#b45309", "Sin división horizontal")}
      {item("#64748b", "Trabajado")}
    </div>
  );
}
