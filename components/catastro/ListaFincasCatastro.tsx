"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  CAMPOS_ORDEN_LISTA,
  aplicarCriterioOrdenLista,
  filtrarListaFincas,
  numeroFiltroLista,
  ordenarListaFincas,
  recuentoEstadosDivision,
  type CampoOrdenLista,
  type CriterioOrdenLista,
  type FincaBusquedaUi,
} from "@/lib/catastro/search-ui";
import { accionTecladoLista } from "@/lib/catastro/vista-movil";
import { cn } from "@/lib/utils";
import {
  FILTRO_ASIGNACION_MIAS,
  FILTRO_ASIGNACION_SIN,
  FILTRO_ASIGNACION_TODAS,
  filtrarPorAsignacion,
  recuentoFiltrosAsignacion,
  trocearRefs,
  type AsignacionFinca,
  type ComercialAsignable,
} from "@/lib/catastro-host/finca-assignment";
import { FincaDetallePanel } from "./FincaDetallePanel";
import { FincaResultadoRow } from "./FincaResultadoRow";
import { LeyendaEstadosDivision } from "./LeyendaEstadosDivision";
import { AsignacionFincaSelect } from "./AsignacionFincaSelect";

const CHIP =
  "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11.5px] font-semibold min-h-[26px] leading-none";
const CHIP_ACTIVA = "border-[#0B7461] bg-[#E8F3EF] text-[#08594B]";
const CHIP_INACTIVA = "border-[#E6E3DD] bg-white text-[#5D6B67]";

const TAM_PAGINA_LISTA = 80;
const FILTROS_LISTA = [
  { value: "ALL", label: "Todas" },
  { value: "NO", label: "Candidata" },
  { value: "YES", label: "Con pisos" },
  { value: "NOT_APPLICABLE", label: "No aplica" },
  { value: "UNKNOWN", label: "Sin clasificar" },
] as const;

type Props = {
  fincas: FincaBusquedaUi[];
  hrefDe?: (finca: FincaBusquedaUi) => string | undefined;
  seleccionada?: (ref: string) => boolean;
  vinculada?: (ref: string) => boolean;
  onToggleSeleccion?: (finca: FincaBusquedaUi) => void;
  onMarcarPagina?: (fincas: FincaBusquedaUi[], marcar: boolean) => void;
  fincasSeleccionadas?: string[];
  onProperty?: (finca: FincaBusquedaUi) => void;
  pie?: ReactNode;
  paginacion?: ReactNode;
  recuentoEstados?: Record<string, number>;
  filtroEstado?: string;
  onFiltroEstado?: (status: string) => void;
  /** El padre carga más fincas: no recortar el listado a 80. */
  topeExterno?: boolean;
};

export function ListaFincasCatastro({
  fincas,
  hrefDe,
  seleccionada,
  vinculada,
  onToggleSeleccion,
  onMarcarPagina,
  fincasSeleccionadas,
  onProperty,
  pie,
  paginacion,
  recuentoEstados,
  filtroEstado,
  onFiltroEstado,
  topeExterno = false,
}: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filtroLocal, setFiltroLocal] = useState("ALL");
  const filtro = filtroEstado ?? filtroLocal;
  const [sel, setSel] = useState<string | null>(null);
  const [hoja, setHoja] = useState(false);
  const [filtroAsignacion, setFiltroAsignacion] = useState(FILTRO_ASIGNACION_TODAS);
  const [yo, setYo] = useState<string | null>(null);
  const [comerciales, setComerciales] = useState<ComercialAsignable[]>([]);
  const [asignaciones, setAsignaciones] = useState<Record<string, AsignacionFinca>>({});
  const [orden, setOrden] = useState<CriterioOrdenLista[]>([
    { campo: "anio", direccion: "desc" },
    { campo: "inmuebles", direccion: "desc" },
    { campo: "parcela", direccion: "desc" },
  ]);
  const [minParcela, setMinParcela] = useState("");
  const [minInmuebles, setMinInmuebles] = useState("");
  const [maxAnio, setMaxAnio] = useState("");
  const [tope, setTope] = useState(TAM_PAGINA_LISTA);
  const recuento = recuentoEstados ?? recuentoEstadosDivision(fincas);
  const minParcelaN = numeroFiltroLista(minParcela);
  const minInmueblesN = numeroFiltroLista(minInmuebles);
  const maxAnioN = numeroFiltroLista(maxAnio);
  const hayFiltroMetrica = minParcelaN != null || minInmueblesN != null || maxAnioN != null;
  const filtradas = useMemo(
    () =>
      filtrarListaFincas(fincas, {
        q,
        status: onFiltroEstado ? "ALL" : filtro,
        minParcela: minParcelaN,
        minInmuebles: minInmueblesN,
        maxAnio: maxAnioN,
      }),
    [fincas, q, filtro, onFiltroEstado, minParcelaN, minInmueblesN, maxAnioN]
  );
  const visibles = useMemo(
    () => ordenarListaFincas(filtrarPorAsignacion(filtradas, asignaciones, filtroAsignacion, yo), orden),
    [filtradas, asignaciones, filtroAsignacion, yo, orden]
  );
  const pagina = topeExterno ? visibles : visibles.slice(0, tope);
  const recuentoAsignacion = useMemo(
    () => recuentoFiltrosAsignacion(filtradas, asignaciones, yo, comerciales),
    [filtradas, asignaciones, yo, comerciales]
  );

  const aplicarAsignacion = useCallback((ref: string, asignacion: AsignacionFinca | null) => {
    setAsignaciones((prev) => {
      const siguiente = { ...prev };
      if (asignacion) siguiente[ref] = asignacion;
      else delete siguiente[ref];
      return siguiente;
    });
  }, []);

  const aplicarAsignacionLote = useCallback(
    (input: { refs: string[]; comercialId: string | null; nombre: string | null }) => {
      setAsignaciones((prev) => {
        const siguiente = { ...prev };
        for (const ref of input.refs) {
          if (!input.comercialId) delete siguiente[ref];
          else {
            siguiente[ref] = {
              fincaReference: ref,
              comercialId: input.comercialId,
              nombre: input.nombre ?? "Comercial",
            };
          }
        }
        return siguiente;
      });
    },
    []
  );

  const aplicarOrden = (campo: CampoOrdenLista) => {
    setOrden((prev) => aplicarCriterioOrdenLista(prev, campo));
  };

  useEffect(() => {
    setTope(TAM_PAGINA_LISTA);
  }, [q, filtro, filtroAsignacion, orden, fincas.length, minParcelaN, minInmueblesN, maxAnioN]);

  useEffect(() => {
    if (sel && pagina.some((finca) => finca.fincaReference === sel)) return;
    setSel(null);
    setHoja(false);
  }, [pagina, sel]);

  const refsAsignacion = useMemo(
    () => filtradas.map((finca) => finca.fincaReference),
    [filtradas]
  );
  const claveRefs = refsAsignacion.join(",");

  useEffect(() => {
    let vivo = true;
    void fetch("/api/catastro/assignments")
      .then(async (respuesta) => {
        const json = (await respuesta.json()) as {
          ok?: boolean;
          me?: string;
          comerciales?: ComercialAsignable[];
        };
        if (!vivo || !respuesta.ok || !json.ok) return;
        setYo(json.me ?? null);
        setComerciales(json.comerciales ?? []);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    const refs = claveRefs ? claveRefs.split(",") : [];
    if (refs.length === 0) {
      setAsignaciones({});
      return;
    }
    let vivo = true;
    const trozos = trocearRefs(refs);
    void Promise.all(
      trozos.map((trozo) =>
        fetch(`/api/catastro/assignments?refs=${encodeURIComponent(trozo.join(","))}`).then(async (respuesta) => {
          const json = (await respuesta.json()) as {
            ok?: boolean;
            assignments?: AsignacionFinca[];
          };
          if (!respuesta.ok || !json.ok) return [] as AsignacionFinca[];
          return json.assignments ?? [];
        })
      )
    )
      .then((lotes) => {
        if (!vivo) return;
        const mapa: Record<string, AsignacionFinca> = {};
        for (const lote of lotes) {
          for (const item of lote) mapa[item.fincaReference] = item;
        }
        setAsignaciones(mapa);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [claveRefs]);

  const cerrarFicha = useCallback(() => {
    setHoja(false);
  }, []);

  useEffect(() => {
    const onKey = (evento: KeyboardEvent) => {
      const destino = evento.target;
      if (destino instanceof HTMLInputElement || destino instanceof HTMLSelectElement || destino instanceof HTMLTextAreaElement) {
        return;
      }
      const accion = accionTecladoLista(evento.key);
      if (!accion || pagina.length === 0) return;
      if (accion === "siguiente" || accion === "anterior") evento.preventDefault();
      if (accion === "cerrar") {
        cerrarFicha();
        return;
      }
      const indice = pagina.findIndex((finca) => finca.fincaReference === sel);
      if (accion === "siguiente") {
        const siguiente = pagina[Math.min(pagina.length - 1, Math.max(0, indice) + 1)];
        if (siguiente) {
          setSel(siguiente.fincaReference);
          if (hoja) setHoja(true);
        }
      }
      if (accion === "anterior") {
        const anterior = pagina[Math.max(0, (indice < 0 ? 0 : indice) - 1)];
        if (anterior) {
          setSel(anterior.fincaReference);
          if (hoja) setHoja(true);
        }
      }
      if (accion === "abrir") {
        const actual = pagina[Math.max(0, indice)];
        if (actual) {
          setSel(actual.fincaReference);
          setHoja(true);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pagina, sel, hoja, cerrarFicha]);

  const abrir = (finca: FincaBusquedaUi) => {
    if (hoja && sel === finca.fincaReference) {
      setHoja(false);
      return;
    }
    setSel(finca.fincaReference);
    setHoja(true);
  };

  const irPropiedad = (finca: FincaBusquedaUi) => {
    if (onProperty) onProperty(finca);
    else if (hrefDe?.(finca)) router.push(hrefDe(finca) ?? "");
  };

  const ficha = visibles.find((finca) => finca.fincaReference === sel) ?? null;

  return (
    <div id="listado-fincas-catastro" className="space-y-4">
      <p className="text-[13px] text-[#131C1A]">
        <span className="font-semibold tabular-nums text-[#08594B]">
          {(recuento.NO ?? 0).toLocaleString("es-ES")} candidatas
        </span>
        {" · "}
        <span className="tabular-nums">{(recuento.ALL ?? 0).toLocaleString("es-ES")} fincas</span>
      </p>
      {paginacion}

      <LeyendaEstadosDivision compacta />

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 min-[780px]:flex-wrap min-[780px]:overflow-visible" role="tablist" aria-label="Filtrar por estado">
        {FILTROS_LISTA.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={filtro === item.value}
            onClick={() => {
              if (onFiltroEstado) onFiltroEstado(item.value);
              else setFiltroLocal(item.value);
            }}
            className={cn(CHIP, filtro === item.value ? CHIP_ACTIVA : CHIP_INACTIVA)}
          >
            {item.label}
            <span className="ml-1 tabular-nums text-[#6B7A76]">{(recuento[item.value] ?? 0).toLocaleString("es-ES")}</span>
          </button>
        ))}
      </div>
      {recuentoEstados ? (
        <p className="text-[11px] text-[#6B7A76]">Los recuentos de arriba son de toda la búsqueda.</p>
      ) : null}

      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#6B7A76]">Comercial</p>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 min-[780px]:flex-wrap min-[780px]:overflow-visible" role="tablist" aria-label="Filtrar por comercial">
          {[
            { value: FILTRO_ASIGNACION_TODAS, label: "Todas", n: recuentoAsignacion.todas },
            { value: FILTRO_ASIGNACION_SIN, label: "Sin asignar", n: recuentoAsignacion.sinAsignar },
            { value: FILTRO_ASIGNACION_MIAS, label: "Mías", n: recuentoAsignacion.mias },
            ...comerciales.map((item) => ({
              value: item.id,
              label: item.nombre,
              n: recuentoAsignacion.porComercial[item.id] ?? 0,
            })),
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={filtroAsignacion === item.value}
              onClick={() => setFiltroAsignacion(item.value)}
              className={cn(CHIP, filtroAsignacion === item.value ? CHIP_ACTIVA : CHIP_INACTIVA)}
            >
              <span className="max-w-[11rem] truncate">{item.label}</span>
              <span className="ml-1 tabular-nums text-[#6B7A76]">{item.n}</span>
            </button>
          ))}
        </div>
      </div>

      <label className="relative block">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#5D6B67]" aria-hidden />
        <input
          value={q}
          onChange={(evento) => setQ(evento.target.value)}
          placeholder="Filtrar por calle o referencia"
          className="h-8 w-full rounded-lg border border-[#DAD6CE] bg-white py-1 pl-8 pr-3 text-[13px] text-[#131C1A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7461]"
        />
      </label>

      <ChipsOrdenLista orden={orden} onOrden={aplicarOrden} />

      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#6B7A76]">Filtrar</p>
        <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-3">
          <FiltroNumero etiqueta="Desde m² parcela" value={minParcela} onChange={setMinParcela} />
          <FiltroNumero etiqueta="Desde n.º inmuebles" value={minInmuebles} onChange={setMinInmuebles} />
          <FiltroNumero etiqueta="Hasta año" value={maxAnio} onChange={setMaxAnio} />
        </div>
        {hayFiltroMetrica ? (
          <p className="mt-1.5 text-[12px] tabular-nums text-[#5D6B67]">
            {visibles.length.toLocaleString("es-ES")}{" "}
            {visibles.length === 1 ? "finca cumple" : "fincas cumplen"} m², inmuebles y año
            {topeExterno ? " de las ya cargadas" : null}
          </p>
        ) : null}
      </div>

      <div
        className={cn(
          "min-w-0",
          "max-[779px]:flex max-[779px]:flex-col max-[779px]:gap-2.5",
          "min-[780px]:overflow-x-auto min-[780px]:rounded-2xl min-[780px]:border min-[780px]:border-[#E6E3DD] min-[780px]:bg-white"
        )}
      >
        {pagina.length === 0 ? (
          <>
            <CabeceraOrdenLista />
            <p className="px-4 py-10 text-center text-sm text-[#5D6B67]">
              {hayFiltroMetrica
                ? "No hay fincas que cumplan m², inmuebles y año a la vez."
                : "No hay fincas con ese filtro."}
            </p>
          </>
        ) : (
          <>
            {onToggleSeleccion ? (
              <BarraSeleccionLista
                visibles={pagina}
                seleccionada={seleccionada}
                fincasSeleccionadas={fincasSeleccionadas}
                onMarcarPagina={onMarcarPagina}
                comerciales={comerciales}
                onAsignacionLote={aplicarAsignacionLote}
              />
            ) : null}
            <CabeceraOrdenLista />
            <ul aria-label="Fincas encontradas" className="max-[779px]:space-y-2.5">
              {pagina.map((finca) => (
                <li key={finca.fincaReference}>
                  <FincaResultadoRow
                    finca={finca}
                    selected={hoja && sel === finca.fincaReference}
                    checked={Boolean(seleccionada?.(finca.fincaReference))}
                    vinculada={Boolean(vinculada?.(finca.fincaReference))}
                    onSelect={() => abrir(finca)}
                    onToggle={onToggleSeleccion ? () => onToggleSeleccion(finca) : undefined}
                    onProperty={onProperty || hrefDe?.(finca) ? () => irPropiedad(finca) : undefined}
                    asignacion={asignaciones[finca.fincaReference] ?? null}
                    comerciales={comerciales}
                    onAsignacion={(asignacion) => aplicarAsignacion(finca.fincaReference, asignacion)}
                  />
                </li>
              ))}
            </ul>
            {visibles.length > tope && !topeExterno ? (
              <div className="border-t border-[#F2F0EB] px-4 py-3">
                <button
                  type="button"
                  className={cn(CHIP, CHIP_INACTIVA)}
                  onClick={() => setTope((n) => n + TAM_PAGINA_LISTA)}
                >
                  Mostrar más
                </button>
                <p className="mt-1.5 text-[12px] tabular-nums text-[#6B7A76]">
                  Viendo {tope.toLocaleString("es-ES")} de {visibles.length.toLocaleString("es-ES")} fincas
                </p>
              </div>
            ) : null}
          </>
        )}
        {pie}
      </div>

      {ficha && hoja ? (
        <FincaDetallePanel
          finca={ficha}
          href={hrefDe?.(ficha)}
          vinculada={Boolean(vinculada?.(ficha.fincaReference))}
          onProperty={onProperty || hrefDe?.(ficha) ? () => irPropiedad(ficha) : undefined}
          onCerrar={cerrarFicha}
          comerciales={comerciales}
          asignacion={asignaciones[ficha.fincaReference] ?? null}
          onAsignacion={(asignacion) => aplicarAsignacion(ficha.fincaReference, asignacion)}
        />
      ) : null}
    </div>
  );
}

function BarraSeleccionLista({
  visibles,
  seleccionada,
  fincasSeleccionadas,
  onMarcarPagina,
  comerciales,
  onAsignacionLote,
}: {
  visibles: FincaBusquedaUi[];
  seleccionada?: (ref: string) => boolean;
  fincasSeleccionadas?: string[];
  onMarcarPagina?: (fincas: FincaBusquedaUi[], marcar: boolean) => void;
  comerciales: ComercialAsignable[];
  onAsignacionLote: (input: {
    refs: string[];
    comercialId: string | null;
    nombre: string | null;
  }) => void;
}) {
  const checkRef = useRef<HTMLInputElement>(null);
  const marcadasPagina = visibles.filter((finca) => seleccionada?.(finca.fincaReference));
  const todasPagina = visibles.length > 0 && marcadasPagina.length === visibles.length;
  const algunasPagina = marcadasPagina.length > 0 && !todasPagina;
  const refsLote =
    fincasSeleccionadas && fincasSeleccionadas.length > 0
      ? fincasSeleccionadas
      : marcadasPagina.map((finca) => finca.fincaReference);

  useEffect(() => {
    if (checkRef.current) checkRef.current.indeterminate = algunasPagina;
  }, [algunasPagina]);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[#F2F0EB] bg-[#FBFBF9] px-3 py-2 max-[779px]:rounded-[13px] max-[779px]:border max-[779px]:border-[#E6E3DD] max-[779px]:bg-white">
      <label className="flex items-center gap-2 text-[12px] font-medium text-[#5D6B67]">
        <input
          ref={checkRef}
          type="checkbox"
          checked={todasPagina}
          disabled={!onMarcarPagina}
          aria-label="Seleccionar todas las fincas de esta página"
          className="h-3.5 w-3.5 cursor-pointer rounded-[3px] border-[#CFCBC2] accent-[#0B7461]"
          onChange={() => onMarcarPagina?.(visibles, !todasPagina)}
        />
        {refsLote.length > 0
          ? `${refsLote.length} ${refsLote.length === 1 ? "seleccionada" : "seleccionadas"}`
          : "Seleccionar página"}
      </label>
      {refsLote.length > 0 && comerciales.length > 0 ? (
        <AsignacionFincaSelect
          fincaReferences={refsLote}
          comerciales={comerciales}
          compacto
          etiquetaVacia="Asignar a…"
          onCambioLote={onAsignacionLote}
        />
      ) : null}
    </div>
  );
}

function FiltroNumero({
  etiqueta,
  value,
  onChange,
}: {
  etiqueta: string;
  value: string;
  onChange: (valor: string) => void;
}) {
  const activo = numeroFiltroLista(value) != null;
  return (
    <label className="min-w-0">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#6B7A76]">{etiqueta}</span>
      <input
        type="number"
        min={0}
        inputMode="numeric"
        value={value}
        onChange={(evento) => onChange(evento.target.value)}
        className={cn(
          "h-8 w-full rounded-lg border bg-white px-2.5 text-[13px] tabular-nums text-[#131C1A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7461]",
          activo ? "border-[#0B7461]" : "border-[#DAD6CE]"
        )}
      />
    </label>
  );
}

function ChipsOrdenLista({
  orden,
  onOrden,
}: {
  orden: CriterioOrdenLista[];
  onOrden: (campo: CampoOrdenLista) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#6B7A76]">Ordenar</p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Ordenar listado">
        {CAMPOS_ORDEN_LISTA.map((item) => {
          const indice = orden.findIndex((criterio) => criterio.campo === item.value);
          const criterio = indice >= 0 ? orden[indice] : null;
          const etiquetaDir = criterio?.direccion === "asc" ? "menos a más" : "más a menos";
          return (
            <button
              key={item.value}
              type="button"
              className={cn(CHIP, criterio ? CHIP_ACTIVA : CHIP_INACTIVA)}
              aria-pressed={criterio != null}
              aria-label={
                criterio
                  ? criterio.direccion === "asc"
                    ? `Ordenado por ${item.label}, ${etiquetaDir}. Pulsar para quitar`
                    : `Ordenado por ${item.label}, ${etiquetaDir}. Pulsar para invertir`
                  : `Ordenar por ${item.label}, más a menos`
              }
              onClick={() => onOrden(item.value)}
            >
              {item.label}
              {criterio ? (
                <span className="ml-1" aria-hidden>
                  {criterio.direccion === "desc" ? "↓" : "↑"}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CabeceraOrdenLista() {
  return (
    <div className="hidden items-center gap-3.5 border-b border-[#F2F0EB] bg-[#FBFBF9] px-3.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#6B7A76] min-[780px]:flex">
      <span className="min-w-0 flex-[1_1_250px]">Dirección</span>
      {CAMPOS_ORDEN_LISTA.map((item) => (
        <span
          key={item.value}
          className={item.value === "parcela" ? "w-[74px]" : item.value === "inmuebles" ? "w-[90px]" : "w-[84px]"}
        >
          {item.label}
        </span>
      ))}
      <span className="w-[118px]">Uso</span>
      <span className="w-[132px]">Estado</span>
      <span className="w-[168px]">Comercial</span>
      <span className="w-[92px]" />
    </div>
  );
}

