"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  coberturaExportacion,
  estaSeleccionada,
  type SeleccionFincas,
} from "@/lib/catastro/selection-export";
import {
  FILTROS_REVISION_COMERCIAL,
  estaEnRevision,
  filtrarPorRevisionComercial,
  textoRevision,
  type FiltroRevisionComercial,
  type RevisionFincas,
} from "@/lib/catastro/revision-comercial";
import {
  cargarCatalogo,
  claveCacheCalles,
  claveCacheMunicipios,
  claveCacheProvincias,
  crearSelectorCatalogo,
  getCatalogClientStore,
  type SelectorCatalogo,
} from "@/lib/catastro/catalog-client-cache";
import {
  ESTADO_UBICACION_VACIO,
  aplicarCambioCalle,
  aplicarCambioMunicipio,
  aplicarCambioProvincia,
  aplicarEstadoCalles,
  aplicarEstadoMunicipios,
  aplicarProvinciasCargadas,
  calleDeshabilitada,
  criteriosDesdeUbicacion,
  criteriosUrlIniciales,
  encontrarPorNombreUi,
  esCalleUi,
  esMunicipioUi,
  esProvinciaUi,
  etiquetaCalle,
  fetchCallesCatalogo,
  fetchMunicipiosCatalogo,
  fetchProvinciasCatalogo,
  filtrarCallesLocal,
  filtrarMunicipiosLocal,
  municipioDeshabilitado,
  textoCargaCalles,
  textoCargaMunicipios,
  textoRevalidacionCalles,
  textoRevalidacionMunicipios,
  urlDesdeUbicacion,
  type CalleUi,
  type EstadoUbicacion,
  type MunicipioUi,
  type ProvinciaUi,
} from "@/lib/catastro/location-ui";
import {
  FILTROS_DIVISION,
  claveCriterios,
  criteriosListos,
  ErrorBusquedaUi,
  fetchBusquedaCatastro,
  textosCobertura,
  textoContadorFincas,
  type CriteriosBusquedaUi,
  type FincaBusquedaUi,
  type ResultadoBusquedaUi,
} from "@/lib/catastro/search-ui";
import {
  EXPLICACION_ZONA,
  MODOS_BUSQUEDA,
  camposVisibles,
  claveZonaUi,
  coberturaExportacionZona,
  criteriosExportacionZona,
  criteriosZonaListos,
  modoDesdeTexto,
  validarCodigoPostalZona,
  type ModoBusqueda,
} from "@/lib/catastro/zone-ui";
import { cn } from "@/lib/utils";
import { BuscarPorZona } from "./BuscarPorZona";
import { AccionNuevaBusqueda } from "./AccionNuevaBusqueda";
import { BusquedasRecientes } from "./BusquedasRecientes";
import { CatalogCombobox } from "./CatalogCombobox";
import { CatastroSubnav } from "./CatastroSubnav";
import { FincaResultadoCard } from "./FincaResultadoCard";
import { useBusquedaZona } from "./useBusquedaZona";
import { useSeleccionFincas } from "./useSeleccionFincas";
import { persistirRevisionUi, RUTA_EXPLORER, rutaFincaPersistida } from "@/lib/catastro/explorer/history-ui";

const SELECT_CLASS =
  "flex h-11 w-full rounded-lg border border-border bg-white px-3 py-2 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

type PaginaCache = {
  cursor: string | null;
  data: ResultadoBusquedaUi;
};

function esAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}

export function BuscarInmuebles() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const iniciales = criteriosUrlIniciales(searchParams);
  const [modo, setModo] = useState<ModoBusqueda>(() => modoDesdeTexto(searchParams.get("modo")));
  const [ubicacion, setUbicacion] = useState<EstadoUbicacion>(ESTADO_UBICACION_VACIO);
  const [numero, setNumero] = useState(iniciales.numero);
  const [postalCode, setPostalCode] = useState(iniciales.postalCode);
  const [horizontalDivision, setHorizontalDivision] = useState(iniciales.horizontalDivision);
  const [paginas, setPaginas] = useState<PaginaCache[]>([]);
  const [indice, setIndice] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCatalogo, setErrorCatalogo] = useState<string | null>(null);
  const [buscado, setBuscado] = useState(false);
  const seleccionFincas = useSeleccionFincas();
  const { seleccion, revision } = seleccionFincas;
  const [filtroRevision, setFiltroRevision] = useState<FiltroRevisionComercial>("ALL");
  const zona = useBusquedaZona();
  const [recientesKey, setRecientesKey] = useState(0);
  const abortBusquedaRef = useRef<AbortController | null>(null);
  /** `claveCriterios` de la búsqueda cuyos resultados están en pantalla. */
  const claveBusquedaRef = useRef<string | null>(null);
  const selectorMunicipiosRef = useRef<SelectorCatalogo<MunicipioUi> | null>(null);
  const selectorCallesRef = useRef<SelectorCatalogo<CalleUi> | null>(null);
  const claveActivaRef = useRef<string | null>(null);
  selectorMunicipiosRef.current ??= crearSelectorCatalogo<MunicipioUi>();
  selectorCallesRef.current ??= crearSelectorCatalogo<CalleUi>();

  const paginaActual = paginas[indice] ?? null;
  const resultado = paginaActual?.data ?? null;
  const extras = { numero, postalCode, horizontalDivision };
  const criterios = criteriosDesdeUbicacion(ubicacion, extras);
  const campos = camposVisibles(modo);
  const criteriosZona = criteriosZonaListos({
    provincia: ubicacion.provincia?.name,
    municipio: ubicacion.municipio?.name,
    postalCode,
    horizontalDivision,
  });
  const avisoCpZona = modo === "zona" && postalCode.trim() ? validarCodigoPostalZona(postalCode) : null;
  const zonaOcupada = zona.estado.fase === "preparando" || zona.estado.fase === "ejecutando";
  /** Clave de selección de la zona preparada (no del formulario): estable entre pasos. */
  const claveZonaActiva = zona.estado.snapshot ? claveZonaUi(zona.estado.snapshot.criteria) : null;

  const resetResultados = () => {
    abortBusquedaRef.current?.abort();
    claveActivaRef.current = null;
    claveBusquedaRef.current = null;
    setLoading(false);
    setPaginas([]);
    setIndice(0);
    setError(null);
    setBuscado(false);
    // Cambian los criterios: no se mezclan candidatos ni revisiones de dos búsquedas.
    seleccionFincas.limpiar();
    setFiltroRevision("ALL");
  };

  const onToggleSeleccion = (finca: FincaBusquedaUi) => {
    const clave = modo === "zona" ? claveZonaActiva : claveBusquedaRef.current;
    if (!clave) return;
    seleccionFincas.alternar(finca, clave);
  };

  const onToggleRevision = (finca: FincaBusquedaUi) => {
    const clave = modo === "zona" ? claveZonaActiva : claveBusquedaRef.current;
    if (!clave) return;
    const siguiente = estaEnRevision(revision, finca.fincaReference) ? "NONE" : "REVIEW";
    seleccionFincas.alternarRevision(finca, clave);
    void persistirRevisionUi(finca.fincaReference, siguiente).catch(() => undefined);
  };

  const criteriosExportacionCalle = () => {
    const busqueda = paginas[0]?.data.search ?? criterios;
    return busqueda
      ? {
          municipio: busqueda.municipio,
          via: busqueda.via,
          numero: busqueda.numero ?? "",
          horizontalDivision: busqueda.horizontalDivision,
        }
      : null;
  };

  const onExportar = () => {
    if (modo === "zona") {
      const snapshot = zona.estado.snapshot;
      seleccionFincas.exportar(
        snapshot ? criteriosExportacionZona(snapshot) : null,
        coberturaExportacionZona(snapshot)
      );
      return;
    }
    seleccionFincas.exportar(
      criteriosExportacionCalle(),
      coberturaExportacion(paginas.map((pagina) => pagina.data))
    );
  };

  const onExportarRevision = () => {
    if (modo === "zona") {
      const snapshot = zona.estado.snapshot;
      seleccionFincas.exportarRevision(
        snapshot ? criteriosExportacionZona(snapshot) : null,
        coberturaExportacionZona(snapshot)
      );
      return;
    }
    seleccionFincas.exportarRevision(
      criteriosExportacionCalle(),
      coberturaExportacion(paginas.map((pagina) => pagina.data))
    );
  };

  const onModo = (nuevo: ModoBusqueda) => {
    if (nuevo === modo) return;
    resetResultados();
    zona.nueva();
    setModo(nuevo);
    const params = new URLSearchParams(searchParams.toString());
    if (nuevo === "zona") params.set("modo", "zona");
    else params.delete("modo");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const onPrepararZona = () => {
    if (!criteriosZona || zonaOcupada) return;
    seleccionFincas.conservarPara(claveZonaUi(criteriosZona));
    void zona.preparar(criteriosZona).finally(() => setRecientesKey((n) => n + 1));
  };

  const cargarCalles = async (
    provincia: ProvinciaUi,
    municipio: MunicipioUi,
    viaUrl?: string,
    siglaUrl?: string
  ) => {
    setErrorCatalogo(null);
    try {
      await selectorCallesRef.current!.seleccionar(
        {
          key: claveCacheCalles(provincia.code, municipio.code),
          store: getCatalogClientStore(),
          fetcher: (signal) => fetchCallesCatalogo(provincia.name, municipio.name, signal),
          validarItem: esCalleUi,
        },
        (emision) => {
          setUbicacion((prev) => aplicarEstadoCalles(prev, emision, viaUrl, siglaUrl));
        }
      );
    } catch (err) {
      if (esAbortError(err)) return;
      setErrorCatalogo("No se han podido cargar las calles.");
      setUbicacion((prev) => ({ ...prev, cargandoCalles: false, revalidandoCalles: false, calles: [] }));
    }
  };

  const cargarMunicipios = async (provincia: ProvinciaUi, nombreUrl?: string) => {
    selectorCallesRef.current!.cancelar();
    setErrorCatalogo(null);
    let callesLanzadas = false;
    try {
      await selectorMunicipiosRef.current!.seleccionar(
        {
          key: claveCacheMunicipios(provincia.code),
          store: getCatalogClientStore(),
          fetcher: (signal) => fetchMunicipiosCatalogo(provincia.name, signal),
          validarItem: esMunicipioUi,
        },
        (emision) => {
          setUbicacion((prev) => aplicarEstadoMunicipios(prev, emision, nombreUrl));
          if (callesLanzadas || !nombreUrl) return;
          const elegido = encontrarPorNombreUi(emision.items, nombreUrl);
          if (elegido) {
            callesLanzadas = true;
            void cargarCalles(provincia, elegido, iniciales.via, iniciales.sigla);
          }
        }
      );
    } catch (err) {
      if (esAbortError(err)) return;
      setErrorCatalogo("No se han podido cargar los municipios.");
      setUbicacion((prev) => ({
        ...prev,
        cargandoMunicipios: false,
        revalidandoMunicipios: false,
        municipios: [],
      }));
    }
  };

  const onProvincia = (nombre: string) => {
    const provincia = ubicacion.provincias.find((item) => item.name === nombre) ?? null;
    resetResultados();
    setUbicacion((prev) => aplicarCambioProvincia(prev, provincia));
    if (provincia) void cargarMunicipios(provincia);
  };

  const onMunicipio = (municipio: MunicipioUi | null) => {
    resetResultados();
    setUbicacion((prev) => aplicarCambioMunicipio(prev, municipio));
    if (ubicacion.provincia && municipio) {
      void cargarCalles(ubicacion.provincia, municipio);
    } else {
      selectorCallesRef.current!.cancelar();
    }
  };

  const onCalle = (calle: EstadoUbicacion["calle"]) => {
    resetResultados();
    setUbicacion((prev) => aplicarCambioCalle(prev, calle));
  };

  const ejecutarBusqueda = async (
    origen: CriteriosBusquedaUi,
    cursor: string | null,
    destinoIndice: number
  ) => {
    if (!criteriosListos(origen)) {
      setError("Revisa los datos introducidos.");
      return;
    }

    abortBusquedaRef.current?.abort();
    const controller = new AbortController();
    abortBusquedaRef.current = controller;
    const clave = `${claveCriterios(origen)}::${cursor ?? ""}`;
    claveActivaRef.current = clave;
    claveBusquedaRef.current = claveCriterios(origen);
    setLoading(true);
    setError(null);

    try {
      const data = await fetchBusquedaCatastro(origen, cursor ?? undefined, controller.signal);
      if (claveActivaRef.current !== clave) return;
      setPaginas((prev) => {
        if (destinoIndice === 0 && !cursor) return [{ cursor: null, data }];
        const copia = prev.slice(0, destinoIndice + 1);
        copia[destinoIndice] = { cursor, data };
        return copia;
      });
      setIndice(destinoIndice);
      setBuscado(true);
      setRecientesKey((n) => n + 1);
    } catch (err) {
      if (esAbortError(err) || claveActivaRef.current !== clave) return;
      setPaginas([]);
      setIndice(0);
      setBuscado(true);
      setError(
        err instanceof ErrorBusquedaUi
          ? err.message
          : "No se ha podido completar la búsqueda. Inténtalo de nuevo."
      );
    } finally {
      if (claveActivaRef.current === clave) setLoading(false);
    }
  };

  const sincronizarUrl = (origen: CriteriosBusquedaUi) => {
    const qs = urlDesdeUbicacion(ubicacion, extras).toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    void origen;
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (modo === "zona") {
      onPrepararZona();
      return;
    }
    if (loading || !criterios) return;
    setPaginas([]);
    setIndice(0);
    // Repetir la misma búsqueda conserva la selección; otra distinta la vacía.
    seleccionFincas.conservarPara(claveCriterios(criterios));
    sincronizarUrl(criterios);
    void ejecutarBusqueda(criterios, null, 0);
  };

  const irAnterior = () => {
    if (loading || indice === 0 || !criterios) return;
    const previa = paginas[indice - 1];
    if (previa) {
      setIndice(indice - 1);
      return;
    }
    void ejecutarBusqueda(criterios, null, 0);
  };

  const irSiguiente = () => {
    if (loading || !criterios || !resultado?.pagination.hasNextPage || !resultado.pagination.nextCursor) {
      return;
    }
    const siguiente = paginas[indice + 1];
    if (siguiente) {
      setIndice(indice + 1);
      return;
    }
    void ejecutarBusqueda(criterios, resultado.pagination.nextCursor, indice + 1);
  };

  useEffect(() => {
    const controller = new AbortController();
    let municipiosLanzados = false;
    setUbicacion((prev) => ({ ...prev, cargandoProvincias: true }));
    cargarCatalogo(
      {
        key: claveCacheProvincias(),
        store: getCatalogClientStore(),
        fetcher: fetchProvinciasCatalogo,
        validarItem: esProvinciaUi,
        signal: controller.signal,
      },
      (emision) => {
        setUbicacion((prev) => aplicarProvinciasCargadas(prev, emision.items, iniciales.provincia));
        if (municipiosLanzados) return;
        const provincia = encontrarPorNombreUi(emision.items, iniciales.provincia);
        if (provincia) {
          municipiosLanzados = true;
          void cargarMunicipios(provincia, iniciales.municipio);
        }
      }
    ).catch((err) => {
      if (esAbortError(err)) return;
      setErrorCatalogo("No se han podido cargar las provincias.");
      setUbicacion((prev) => ({ ...prev, cargandoProvincias: false }));
    });
    return () => {
      controller.abort();
      selectorMunicipiosRef.current?.cancelar();
      selectorCallesRef.current?.cancelar();
      abortBusquedaRef.current?.abort();
    };
    // Hidratación inicial desde la URL; no repetir en cada keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={cn((seleccion.fincas.length > 0 || revision.fincas.length > 0) && "pb-32 md:pb-24")}>
      <CatastroSubnav />
      <PageHeader
        breadcrumb={[
          { label: "Catastro Explorer", href: RUTA_EXPLORER },
          { label: "Nueva búsqueda" },
        ]}
        title="Nueva búsqueda"
        description="Localiza fincas catastrales, especialmente parcelas construidas sin división horizontal."
        actions={<AccionNuevaBusqueda />}
      />

      <BusquedasRecientes refreshKey={recientesKey} compact />

      <form
        onSubmit={onSubmit}
        className="mt-8 rounded-2xl border border-border bg-white p-4 shadow-[0_1px_3px_rgba(28,25,23,0.04)] sm:p-6"
      >
        <fieldset className="mb-5">
          <legend className="text-sm font-medium text-foreground">Buscar por</legend>
          <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Buscar por">
            {MODOS_BUSQUEDA.map((item) => (
              <label
                key={item.value}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                  modo === item.value
                    ? "border-accent bg-accent/10 text-foreground"
                    : "border-border bg-white text-neutral-600 hover:border-neutral-300"
                )}
              >
                <input
                  type="radio"
                  name="modo"
                  value={item.value}
                  checked={modo === item.value}
                  onChange={() => onModo(item.value)}
                  className="h-4 w-4 accent-[var(--accent,#0f766e)]"
                />
                {item.label}
              </label>
            ))}
          </div>
          {modo === "zona" ? (
            <p className="mt-3 rounded-xl border border-accent/20 bg-accent/5 px-4 py-2.5 text-sm text-foreground">
              {EXPLICACION_ZONA}
            </p>
          ) : null}
        </fieldset>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="provincia">Provincia</Label>
            <select
              id="provincia"
              className={SELECT_CLASS}
              value={ubicacion.provincia?.name ?? ""}
              disabled={ubicacion.cargandoProvincias}
              onChange={(event) => onProvincia(event.target.value)}
              required
            >
              <option value="">
                {ubicacion.cargandoProvincias ? "Cargando provincias..." : "Selecciona provincia"}
              </option>
              {ubicacion.provincias.map((item) => (
                <option key={item.code} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="municipio">Municipio</Label>
            <CatalogCombobox
              id="municipio"
              items={ubicacion.municipios}
              value={ubicacion.municipio}
              disabled={municipioDeshabilitado(ubicacion)}
              loading={ubicacion.cargandoMunicipios}
              loadingText={textoCargaMunicipios(ubicacion.cargandoMunicipios, ubicacion.provincia?.name)}
              hint={textoRevalidacionMunicipios(ubicacion.revalidandoMunicipios) ?? undefined}
              placeholder={
                municipioDeshabilitado(ubicacion)
                  ? "Primero selecciona la provincia"
                  : "Selecciona municipio"
              }
              getKey={codigoMunicipio}
              getLabel={nombreMunicipio}
              filterItems={filtrarMunicipiosLocal}
              onChange={onMunicipio}
            />
          </div>

          {campos.calle ? (
            <div className="space-y-2 md:col-span-2 xl:col-span-1">
              <Label htmlFor="via">Calle</Label>
              <CatalogCombobox
                id="via"
                items={ubicacion.calles}
                value={ubicacion.calle}
                disabled={calleDeshabilitada(ubicacion)}
                loading={ubicacion.cargandoCalles}
                loadingText={textoCargaCalles(ubicacion.cargandoCalles, ubicacion.municipio?.name)}
                placeholder={
                  calleDeshabilitada(ubicacion)
                    ? "Primero selecciona el municipio"
                    : "Escribe al menos 2 letras"
                }
                hint={
                  textoRevalidacionCalles(ubicacion.revalidandoCalles) ??
                  (ubicacion.calle
                    ? undefined
                    : "La sigla la aporta Catastro al elegir la vía. Escribe para filtrar el callejero ya descargado.")
                }
                emptyText="Escribe al menos 2 letras para filtrar el callejero oficial."
                getKey={claveCalle}
                getLabel={etiquetaCalle}
                filterItems={filtrarCallesLocal}
                onChange={onCalle}
              />
            </div>
          ) : null}

          {campos.numero ? (
            <div className="space-y-2">
              <Label htmlFor="numero">Número</Label>
              <Input
                id="numero"
                value={numero}
                onChange={(event) => {
                  resetResultados();
                  setNumero(event.target.value);
                }}
                placeholder="Opcional"
                inputMode="numeric"
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="postalCode">
              Código postal
              <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                {modo === "zona" ? "Obligatorio" : "Filtro"}
              </span>
            </Label>
            <Input
              id="postalCode"
              inputMode="numeric"
              maxLength={5}
              value={postalCode}
              required={modo === "zona"}
              aria-invalid={avisoCpZona ? true : undefined}
              aria-describedby="postalCode-ayuda"
              onChange={(event) => {
                resetResultados();
                setPostalCode(event.target.value);
              }}
              placeholder={modo === "zona" ? "46388" : "28004"}
              autoComplete="postal-code"
            />
            <p id="postalCode-ayuda" className={cn("text-xs", avisoCpZona ? "text-red-700" : "text-neutral-500")}>
              {avisoCpZona ??
                (modo === "zona"
                  ? "Solo se mostrarán las fincas cuyo código postal oficial coincida."
                  : "Opcional. Filtra las fincas ya encontradas; no busca por código postal.")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="horizontalDivision">División horizontal</Label>
            <select
              id="horizontalDivision"
              className={SELECT_CLASS}
              value={horizontalDivision}
              onChange={(event) => {
                resetResultados();
                setHorizontalDivision(event.target.value);
              }}
            >
              {FILTROS_DIVISION.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {errorCatalogo ? (
          <p className="mt-4 text-sm text-red-700">{errorCatalogo}</p>
        ) : null}
        {ubicacion.avisoCatalogo ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-950">
            {ubicacion.avisoCatalogo}
          </p>
        ) : null}

        <div className="mt-6">
          {modo === "zona" ? (
            <Button type="submit" disabled={!criteriosZona || zonaOcupada} className="w-full sm:w-auto">
              <Search className="h-4 w-4" strokeWidth={1.5} aria-hidden />
              {zona.estado.fase === "preparando" ? "Preparando búsqueda..." : "Preparar búsqueda"}
            </Button>
          ) : (
            <Button type="submit" disabled={loading || !criterios} className="w-full sm:w-auto">
              <Search className="h-4 w-4" strokeWidth={1.5} aria-hidden />
              {loading ? "Buscando en Catastro..." : "Buscar"}
            </Button>
          )}
        </div>
      </form>

      <section className="mt-8" aria-live="polite">
        {modo === "zona" ? (
          <BuscarPorZona
            estado={zona.estado}
            ahora={zona.ahora}
            cancelando={zona.cancelando}
            seleccion={seleccion}
            revision={revision}
            filtroRevision={filtroRevision}
            onFiltroRevision={setFiltroRevision}
            onComenzar={zona.comenzar}
            onCancelar={() => void zona.cancelar()}
            onReanudar={() => void zona.reanudar(false)}
            onReintentarErrores={() => void zona.reanudar(true)}
            onNuevaBusqueda={() => {
              zona.nueva();
              seleccionFincas.limpiar();
              setFiltroRevision("ALL");
            }}
            onToggleSeleccion={onToggleSeleccion}
            onToggleRevision={onToggleRevision}
            onExportarRevision={onExportarRevision}
          />
        ) : (
          <>
            {loading && !resultado ? (
              <div className="rounded-2xl border border-border bg-white px-5 py-8 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-accent" />
                <p className="mt-4 text-sm font-medium text-neutral-600">Buscando en Catastro...</p>
              </div>
            ) : null}

            {error ? (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </p>
            ) : null}

            {buscado && !error && resultado ? (
              <ResultadosBusqueda
                resultado={resultado}
                loading={loading}
                indice={indice}
                seleccion={seleccion}
                revision={revision}
                filtroRevision={filtroRevision}
                onFiltroRevision={setFiltroRevision}
                onToggleSeleccion={onToggleSeleccion}
                onToggleRevision={onToggleRevision}
                onExportarRevision={onExportarRevision}
                onAnterior={irAnterior}
                onSiguiente={irSiguiente}
              />
            ) : null}
          </>
        )}
      </section>

      {seleccionFincas.barra(onExportar, onExportarRevision)}
      {seleccionFincas.dialogo}
    </div>
  );
}

function codigoMunicipio(item: MunicipioUi) {
  return item.code;
}

function nombreMunicipio(item: MunicipioUi) {
  return item.name;
}

function claveCalle(item: NonNullable<EstadoUbicacion["calle"]>) {
  return `${item.code}-${item.sigla}`;
}

function ResultadosBusqueda({
  resultado,
  loading,
  indice,
  seleccion,
  revision,
  filtroRevision,
  onFiltroRevision,
  onToggleSeleccion,
  onToggleRevision,
  onExportarRevision,
  onAnterior,
  onSiguiente,
}: {
  resultado: ResultadoBusquedaUi;
  loading: boolean;
  indice: number;
  seleccion: SeleccionFincas;
  revision: RevisionFincas;
  filtroRevision: FiltroRevisionComercial;
  onFiltroRevision: (filtro: FiltroRevisionComercial) => void;
  onToggleSeleccion: (finca: FincaBusquedaUi) => void;
  onToggleRevision: (finca: FincaBusquedaUi) => void;
  onExportarRevision: () => void;
  onAnterior: () => void;
  onSiguiente: () => void;
}) {
  const visibles = filtrarPorRevisionComercial(resultado.results, filtroRevision, revision);
  const seleccionadasEnPagina = visibles.filter((finca) =>
    estaSeleccionada(seleccion, finca.fincaReference)
  ).length;
  const cobertura = textosCobertura({
    complete: resultado.coverage.complete,
    completeCandidates: resultado.coverage.completeCandidates,
    hasNextPage: resultado.pagination.hasNextPage,
    possibleCut: resultado.coverage.possibleCut,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-base font-semibold text-foreground">
            {textoContadorFincas(visibles.length)}
            {revision.fincas.length > 0 ? ` · ${textoRevision(revision.fincas.length)}` : null}
          </p>
          {resultado.pagination.hasNextPage || !resultado.coverage.complete ? (
            <p className="text-sm text-neutral-500">
              Resultados de los portales revisados hasta ahora.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-neutral-600">
            <span className="sr-only">Vista comercial</span>
            <select
              className={SELECT_CLASS}
              value={filtroRevision}
              onChange={(event) => onFiltroRevision(event.target.value as FiltroRevisionComercial)}
              aria-label="Filtro comercial local"
            >
              {FILTROS_REVISION_COMERCIAL.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          {revision.fincas.length > 0 ? (
            <Button type="button" variant="secondary" size="sm" onClick={onExportarRevision}>
              Exportar para revisar
            </Button>
          ) : null}
          {cobertura.completa ? (
            <p className="text-sm font-medium text-teal-800">{cobertura.completa}</p>
          ) : null}
        </div>
      </div>

      {cobertura.masResultados ? (
        <p className="rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 text-sm text-foreground">
          {cobertura.masResultados}
        </p>
      ) : null}

      {cobertura.corte ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {cobertura.corte}
        </p>
      ) : null}

      {visibles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white px-5 py-10 text-center">
          <p className="text-neutral-600">
            No se han encontrado fincas que cumplan los filtros seleccionados.
          </p>
        </div>
      ) : (
        <ul className="space-y-3" aria-label="Fincas encontradas">
          {visibles.map((finca) => (
            <li key={finca.fincaReference}>
              <FincaResultadoCard
                finca={finca}
                href={rutaFincaPersistida(finca.fincaReference)}
                seleccionada={estaSeleccionada(seleccion, finca.fincaReference)}
                enRevision={estaEnRevision(revision, finca.fincaReference)}
                revision={revision}
                onToggleSeleccion={onToggleSeleccion}
                onToggleRevision={onToggleRevision}
              />
            </li>
          ))}
        </ul>
      )}

      {resultado.results.length > 0 || resultado.pagination.hasNextPage ? (
        <nav
          className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-white px-4 py-3"
          aria-label="Paginación de resultados"
        >
          <Button type="button" variant="secondary" size="sm" onClick={onAnterior} disabled={loading || indice === 0}>
            Anterior
          </Button>
          <p className="text-sm font-medium text-neutral-600">
            Página {indice + 1}
            {seleccionadasEnPagina > 0 ? ` · ${seleccionadasEnPagina} seleccionadas aquí` : null}
            {loading ? " · actualizando…" : null}
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onSiguiente}
            disabled={loading || !resultado.pagination.hasNextPage}
          >
            Siguiente
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
