"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  CAMPOS_ORDEN_LISTA,
  TEXTO_ATAJOS_LISTA,
  aplicarCriterioOrdenLista,
  filtrarListaFincas,
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
  recuentoEstados?: Record<string, number>;
  filtroEstado?: string;
  onFiltroEstado?: (status: string) => void;
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
  recuentoEstados,
  filtroEstado,
  onFiltroEstado,
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
  const [orden, setOrden] = useState<CriterioOrdenLista[]>([]);
  const recuento = recuentoEstados ?? recuentoEstadosDivision(fincas);
  const filtradas = useMemo(
    () => filtrarListaFincas(fincas, { q, status: onFiltroEstado ? "ALL" : filtro }),
    [fincas, q, filtro, onFiltroEstado]
  );
  const visibles = useMemo(
    () => ordenarListaFincas(filtrarPorAsignacion(filtradas, asignaciones, filtroAsignacion, yo), orden),
    [filtradas, asignaciones, filtroAsignacion, yo, orden]
  );
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
    if (sel && visibles.some((finca) => finca.fincaReference === sel)) return;
    setSel(null);
    setHoja(false);
  }, [visibles, sel]);

  const refsAsignacion = useMemo(
    () => filtradas.map((finca) => finca.fincaReference).join(","),
    [filtradas]
  );

  useEffect(() => {
    let vivo = true;
    const url = refsAsignacion
      ? `/api/catastro/assignments?refs=${encodeURIComponent(refsAsignacion)}`
      : "/api/catastro/assignments";
    void fetch(url)
      .then(async (respuesta) => {
        const json = (await respuesta.json()) as {
          ok?: boolean;
          me?: string;
          comerciales?: ComercialAsignable[];
          assignments?: AsignacionFinca[];
        };
        if (!vivo || !respuesta.ok || !json.ok) return;
        setYo(json.me ?? null);
        setComerciales(json.comerciales ?? []);
        const mapa: Record<string, AsignacionFinca> = {};
        for (const item of json.assignments ?? []) mapa[item.fincaReference] = item;
        setAsignaciones(mapa);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [refsAsignacion]);

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
      if (!accion || visibles.length === 0) return;
      if (accion === "siguiente" || accion === "anterior") evento.preventDefault();
      if (accion === "cerrar") {
        cerrarFicha();
        return;
      }
      const indice = visibles.findIndex((finca) => finca.fincaReference === sel);
      if (accion === "siguiente") {
        const siguiente = visibles[Math.min(visibles.length - 1, Math.max(0, indice) + 1)];
        if (siguiente) {
          setSel(siguiente.fincaReference);
          if (hoja) setHoja(true);
        }
      }
      if (accion === "anterior") {
        const anterior = visibles[Math.max(0, (indice < 0 ? 0 : indice) - 1)];
        if (anterior) {
          setSel(anterior.fincaReference);
          if (hoja) setHoja(true);
        }
      }
      if (accion === "abrir") {
        const actual = visibles[Math.max(0, indice)];
        if (actual) {
          setSel(actual.fincaReference);
          setHoja(true);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visibles, sel, hoja, cerrarFicha]);

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
    <div className="space-y-4">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5D6B67]" aria-hidden />
        <input
          value={q}
          onChange={(evento) => setQ(evento.target.value)}
          placeholder="Filtrar por calle o referencia"
          className="h-11 w-full rounded-[10px] border border-[#DAD6CE] bg-white py-2 pl-10 pr-3 text-[14px] text-[#131C1A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7461] min-[780px]:text-[13.5px]"
        />
      </label>

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
        <p className="text-[11px] text-[#6B7A76]">Recuento de toda la búsqueda, no de esta página.</p>
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

      <p className="text-xs text-[#5D6B67]">
        {LEYENDA_FILTRO_HINT} · {TEXTO_ATAJOS_LISTA}
      </p>

      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Ordenar listado">
        <p className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-[#6B7A76]">Ordenar</p>
        {CAMPOS_ORDEN_LISTA.map((item) => {
          const indice = orden.findIndex((criterio) => criterio.campo === item.value);
          const criterio = indice >= 0 ? orden[indice] : null;
          const etiquetaDir = criterio?.direccion === "asc" ? "menos a más" : "más a menos";
          return (
            <button
              key={item.value}
              type="button"
              aria-pressed={criterio != null}
              aria-label={
                criterio
                  ? criterio.direccion === "asc"
                    ? `Ordenado por ${item.label}, ${etiquetaDir}. Pulsar para quitar`
                    : `Ordenado por ${item.label}, ${etiquetaDir}. Pulsar para invertir`
                  : `Añadir orden por ${item.label}, más a menos`
              }
              onClick={() => aplicarOrden(item.value)}
              className={cn(CHIP, "gap-1", criterio ? CHIP_ACTIVA : CHIP_INACTIVA)}
            >
              {item.label}
              {criterio ? (
                <span className="tabular-nums text-[#6B7A76]" aria-hidden>
                  {orden.length > 1 ? `${indice + 1} ` : ""}
                  {criterio.direccion === "desc" ? "↓" : "↑"}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div
        className={cn(
          "min-w-0",
          "max-[779px]:flex max-[779px]:flex-col max-[779px]:gap-2.5",
          "min-[780px]:overflow-hidden min-[780px]:rounded-2xl min-[780px]:border min-[780px]:border-[#E6E3DD] min-[780px]:bg-white"
        )}
      >
        {visibles.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-[#5D6B67]">No hay fincas con ese filtro.</p>
        ) : (
          <>
            {onToggleSeleccion ? (
              <BarraSeleccionLista
                visibles={visibles}
                seleccionada={seleccionada}
                fincasSeleccionadas={fincasSeleccionadas}
                onMarcarPagina={onMarcarPagina}
                comerciales={comerciales}
                onAsignacionLote={aplicarAsignacionLote}
              />
            ) : null}
            <ul aria-label="Fincas encontradas" className="max-[779px]:space-y-2.5">
              {visibles.map((finca) => (
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

const LEYENDA_FILTRO_HINT = "La clasificación la da Catastro, no se marca a mano";
