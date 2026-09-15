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
  FILTROS_DIVISION_FORM,
  ayudaFiltroDivision,
  claveCriterios,
  criteriosListos,
  ErrorBusquedaUi,
  fetchBusquedaCatastro,
  recuentoEstadosDivision,
  textosCobertura,
  type CriteriosBusquedaUi,
  type FincaBusquedaUi,
  type ResultadoBusquedaUi,
} from "@/lib/catastro/search-ui";
import {
  EXPLICACION_MUNICIPIO,
  EXPLICACION_ZONA,
  MODOS_BUSQUEDA,
  camposVisibles,
  claveZonaUi,
  coberturaExportacionZona,
  criteriosExportacionZona,
  criteriosMunicipioListos,
  criteriosZonaListos,
  modoDesdeTexto,
  validarCodigoPostalZona,
  type ModoBusqueda,
} from "@/lib/catastro/zone-ui";
import { cn } from "@/lib/utils";
import { BuscarPorZona } from "./BuscarPorZona";
import { BusquedasRecientes } from "./BusquedasRecientes";
import { CatalogCombobox } from "./CatalogCombobox";
import { ListaFincasCatastro } from "./ListaFincasCatastro";
import { BarraPaginacion } from "./BarraPaginacion";
import { VacioResultados } from "./VacioResultados";
import { useBusquedaZona } from "./useBusquedaZona";
import { useSeleccionFincas } from "./useSeleccionFincas";
import { persistirRevisionUi, RUTA_EXPLORER, rutaFincaPersistida } from "@/lib/catastro/explorer/history-ui";
import {
  avisoCodigoPostalAjeno,
  fetchCodigosPostalesMunicipio,
  nombreMunicipioVisible,
  textoAyudaCodigosMunicipio,
  type MunicipioPostalUi,
} from "@/lib/catastro/explorer/postal-codes-ui";

const SELECT_CLASS =
  "flex min-h-[46px] w-full rounded-[10px] border border-[#DAD6CE] bg-white px-3 py-2 text-[15px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7461] disabled:cursor-not-allowed disabled:opacity-50";

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
  const [municipioPostal, setMunicipioPostal] = useState<MunicipioPostalUi | null>(null);
  const [dueñosPostal, setDueñosPostal] = useState<MunicipioPostalUi[]>([]);
  const [horizontalDivision, setHorizontalDivision] = useState(iniciales.horizontalDivision);
  const [paginas, setPaginas] = useState<PaginaCache[]>([]);
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
  const resultadosRef = useRef<HTMLElement | null>(null);
  /** `claveCriterios` de la búsqueda cuyos resultados están en pantalla. */
  const claveBusquedaRef = useRef<string | null>(null);
  const selectorMunicipiosRef = useRef<SelectorCatalogo<MunicipioUi> | null>(null);
  const selectorCallesRef = useRef<SelectorCatalogo<CalleUi> | null>(null);
  const claveActivaRef = useRef<string | null>(null);
  selectorMunicipiosRef.current ??= crearSelectorCatalogo<MunicipioUi>();
  selectorCallesRef.current ??= crearSelectorCatalogo<CalleUi>();

  const resultado =
    paginas.length === 0
      ? null
      : {
          ...paginas[paginas.length - 1]!.data,
          results: paginas.flatMap((pagina) => pagina.data.results),
        };
  const extras = { numero, postalCode, horizontalDivision };
  const criterios = criteriosDesdeUbicacion(ubicacion, extras);
  const campos = camposVisibles(modo);
  const criteriosZona = criteriosZonaListos({
    provincia: ubicacion.provincia?.name,
    municipio: ubicacion.municipio?.name,
    postalCode,
    horizontalDivision,
  });
  const criteriosMunicipio = criteriosMunicipioListos({
    provincia: ubicacion.provincia?.name,
    municipio: ubicacion.municipio?.name,
    postalCode,
    horizontalDivision,
  });
  const buscarTodoElMunicipio = modo === "calle" && !ubicacion.calle && Boolean(criteriosMunicipio);
  const avisoCpZona = modo === "zona" && postalCode.trim() ? validarCodigoPostalZona(postalCode) : null;
  const avisoCpAjeno =
    !avisoCpZona && municipioPostal
      ? avisoCodigoPostalAjeno({
          postalCode,
          municipality: municipioPostal.name,
          codes: municipioPostal.codes,
          owners: dueñosPostal,
        })
      : null;
  const cpAjenoAlMunicipio = Boolean(avisoCpAjeno);
  const zonaOcupada = zona.estado.fase === "preparando" || zona.estado.fase === "ejecutando";
  const mostrarRecientes =
    zona.estado.fase === "formulario" &&
    !zona.estado.error &&
    !loading &&
    !buscado &&
    !error;
  /** Clave de selección de la zona preparada (no del formulario): estable entre pasos. */
  const claveZonaActiva = zona.estado.snapshot ? claveZonaUi(zona.estado.snapshot.criteria) : null;

  const resetResultados = () => {
    abortBusquedaRef.current?.abort();
    claveActivaRef.current = null;
    claveBusquedaRef.current = null;
    setLoading(false);
    setPaginas([]);
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

  const onMarcarPagina = (fincas: FincaBusquedaUi[], marcar: boolean) => {
    const clave = modo === "zona" ? claveZonaActiva : claveBusquedaRef.current;
    if (!clave) return;
    seleccionFincas.marcarPagina(fincas, clave, marcar);
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

  const irAResultados = () => {
    resultadosRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onPrepararZona = (origen = criteriosZona) => {
    if (!origen || zonaOcupada || cpAjenoAlMunicipio) return;
    seleccionFincas.conservarPara(claveZonaUi(origen));
    irAResultados();
    void zona.preparar(origen).finally(() => setRecientesKey((n) => n + 1));
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
    zona.nueva();
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
      setBuscado(true);
      setRecientesKey((n) => n + 1);
    } catch (err) {
      if (esAbortError(err) || claveActivaRef.current !== clave) return;
      setPaginas([]);
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
    if (buscarTodoElMunicipio) {
      onPrepararZona(criteriosMunicipio);
      return;
    }
    if (loading || !criterios) return;
    setPaginas([]);
    // Repetir la misma búsqueda conserva la selección; otra distinta la vacía.
    seleccionFincas.conservarPara(claveCriterios(criterios));
    sincronizarUrl(criterios);
    irAResultados();
    void ejecutarBusqueda(criterios, null, 0);
  };

  const buscarConFiltroDivision = (filtro: string) => {
    setHorizontalDivision(filtro);
    if (modo === "zona" || !ubicacion.calle) {
      const origen =
        modo === "zona"
          ? criteriosZonaListos({
              provincia: ubicacion.provincia?.name,
              municipio: ubicacion.municipio?.name,
              postalCode,
              horizontalDivision: filtro,
            })
          : criteriosMunicipioListos({
              provincia: ubicacion.provincia?.name,
              municipio: ubicacion.municipio?.name,
              postalCode,
              horizontalDivision: filtro,
            });
      if (!origen || zonaOcupada) return;
      zona.nueva();
      seleccionFincas.conservarPara(claveZonaUi(origen));
      irAResultados();
      void zona.preparar(origen).finally(() => setRecientesKey((n) => n + 1));
      return;
    }
    if (!criterios) return;
    const origen = { ...criterios, horizontalDivision: filtro };
    setPaginas([]);
    seleccionFincas.conservarPara(claveCriterios(origen));
    sincronizarUrl(origen);
    irAResultados();
    void ejecutarBusqueda(origen, null, 0);
  };

  const irSiguiente = () => {
    const ultima = paginas[paginas.length - 1]?.data;
    if (loading || !criterios || !ultima?.pagination.hasNextPage || !ultima.pagination.nextCursor) {
      return;
    }
    void ejecutarBusqueda(criterios, ultima.pagination.nextCursor, paginas.length);
  };

  useEffect(() => {
    const provinceCode = ubicacion.provincia?.code;
    const municipality = ubicacion.municipio?.name;
    if (!provinceCode || !municipality) {
      setMunicipioPostal(null);
      setDueñosPostal([]);
      return;
    }
    const controller = new AbortController();
    const cp = postalCode.replace(/\s+/g, "");
    void fetchCodigosPostalesMunicipio(
      { provinceCode, municipality, postalCode: /^\d{5}$/.test(cp) ? cp : undefined },
      controller.signal
    )
      .then((data) => {
        setMunicipioPostal(data.municipality);
        setDueñosPostal(data.owners);
      })
      .catch((err) => {
        if (esAbortError(err)) return;
        setMunicipioPostal(null);
        setDueñosPostal([]);
      });
    return () => controller.abort();
  }, [ubicacion.provincia?.code, ubicacion.municipio?.name, postalCode]);

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

  const continuarId = searchParams.get("continuar")?.trim() ?? "";
  useEffect(() => {
    if (!continuarId) return;
    setModo("zona");
    void zona.continuar(continuarId);
    // Al cambiar el id de la URL (o recargar) se hidrata de nuevo, como al recargar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [continuarId]);

  return (
    <div className={cn((seleccion.fincas.length > 0 || revision.fincas.length > 0) && "pb-32 md:pb-24")}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#5D6B67]">Catastro</p>
      <PageHeader
        title="Buscar fincas"
        description="Rastreamos Catastro por bloques y nos quedamos las fincas sin división horizontal."
        descriptionClassName="max-w-[58ch] text-[15px] text-[#5D6B67]"
      />

      <form
        onSubmit={onSubmit}
        className="mt-8 rounded-2xl border border-[#E6E3DD] bg-white p-3.5 shadow-[0_1px_2px_rgba(19,28,26,.04)] min-[780px]:p-[22px]"
      >
        <fieldset className="mb-5">
          <legend className="text-sm font-medium text-[#131C1A]">¿Qué quieres buscar?</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Qué quieres buscar">
            {MODOS_BUSQUEDA.map((item) => (
              <label
                key={item.value}
                className={cn(
                  "flex cursor-pointer flex-col gap-1 rounded-2xl border-[1.5px] px-4 py-3 transition-colors",
                  modo === item.value
                    ? "border-[#0B7461] bg-[#E8F3EF] text-[#131C1A]"
                    : "border-[#E6E3DD] bg-white text-[#5D6B67] hover:border-[#DAD6CE]"
                )}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="radio"
                    name="modo"
                    value={item.value}
                    checked={modo === item.value}
                    onChange={() => onModo(item.value)}
                    className="h-4 w-4 accent-[var(--accent,#0f766e)]"
                  />
                  {item.label}
                </span>
                <span className="pl-6 text-xs font-normal text-neutral-500">{item.descripcion}</span>
              </label>
            ))}
          </div>
          {modo === "zona" ? (
            <p className="mt-3 rounded-xl border border-accent/20 bg-accent/5 px-4 py-2.5 text-sm text-foreground">
              {EXPLICACION_ZONA}
            </p>
          ) : null}
          {buscarTodoElMunicipio ? (
            <p className="mt-3 rounded-xl border border-accent/20 bg-accent/5 px-4 py-2.5 text-sm text-foreground">
              {EXPLICACION_MUNICIPIO}
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
              <Label htmlFor="via">Calle (opcional)</Label>
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
                    : "Opcional. Si no eliges calle se recorre todo el municipio.")
                }
                emptyText="Escribe al menos 2 letras para filtrar el callejero oficial."
                getKey={claveCalle}
                getLabel={etiquetaCalle}
                filterItems={filtrarCallesLocal}
                onChange={onCalle}
              />
            </div>
          ) : null}

          {campos.numero && ubicacion.calle ? (
            <div className="space-y-2">
              <Label htmlFor="numero">Portal / número</Label>
              <Input
                id="numero"
                value={numero}
                onChange={(event) => {
                  resetResultados();
                  setNumero(event.target.value);
                }}
                placeholder="Ej. 14 — déjalo vacío para toda la calle"
                inputMode="numeric"
                className="min-h-[46px]"
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="postalCode">
              Código postal
              <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                {modo === "zona" ? "Obligatorio" : "Opcional"}
              </span>
            </Label>
            <Input
              id="postalCode"
              inputMode="numeric"
              maxLength={5}
              value={postalCode}
              required={modo === "zona"}
              aria-invalid={avisoCpZona || avisoCpAjeno ? true : undefined}
              aria-describedby="postalCode-ayuda"
              onChange={(event) => {
                resetResultados();
                setPostalCode(event.target.value);
              }}
              placeholder={municipioPostal?.codes[0] ?? (modo === "zona" ? "46388" : "28004")}
              autoComplete="postal-code"
              className="min-h-[46px] font-mono"
            />
            {municipioPostal && municipioPostal.codes.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-xs text-neutral-500">
                  {textoAyudaCodigosMunicipio(municipioPostal.name, municipioPostal.codes)}
                </p>
                <div
                  className={cn(
                    "flex flex-wrap gap-1.5",
                    municipioPostal.codes.length > 12 && "max-h-28 overflow-y-auto pr-1"
                  )}
                  role="listbox"
                  aria-label={`Códigos postales de ${nombreMunicipioVisible(municipioPostal.name)}`}
                >
                  {municipioPostal.codes.map((codigo) => {
                    const activo = postalCode.replace(/\s+/g, "") === codigo;
                    return (
                      <button
                        key={codigo}
                        type="button"
                        role="option"
                        aria-selected={activo}
                        onClick={() => {
                          resetResultados();
                          setPostalCode(codigo);
                        }}
                        className={cn(
                          "min-h-9 rounded-full border px-2.5 font-mono text-[13px] font-semibold",
                          activo
                            ? "border-[#0B7461] bg-[#E8F3EF] text-[#08594B]"
                            : "border-[#E6E3DD] bg-white text-[#5D6B67]"
                        )}
                      >
                        {codigo}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <p
              id="postalCode-ayuda"
              className={cn("text-xs", avisoCpZona || avisoCpAjeno ? "text-red-700" : "text-neutral-500")}
            >
              {avisoCpZona ??
                avisoCpAjeno ??
                (modo === "zona"
                  ? "Obligatorio. Solo se quedan las fincas de ese CP."
                  : "Si lo pones, oculta las fincas de otro código postal.")}
            </p>
          </div>

          <div className="space-y-2 md:col-span-2 xl:col-span-3">
            <p className="text-sm font-medium text-[#131C1A]">Qué fincas quieres ver</p>
            <div className="flex flex-col gap-1.5 min-[780px]:flex-row min-[780px]:flex-wrap" role="group" aria-label="Qué fincas quieres ver">
              {FILTROS_DIVISION_FORM.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    resetResultados();
                    setHorizontalDivision(item.value);
                  }}
                  className={cn(
                    "min-h-11 rounded-[10px] border px-3.5 text-left text-[13.5px] font-medium min-[780px]:min-h-0 min-[780px]:rounded-full min-[780px]:px-3 min-[780px]:py-1.5 min-[780px]:text-[13px] min-[780px]:font-semibold",
                    horizontalDivision === item.value
                      ? "border-[#0B7461] bg-[#E8F3EF] text-[#08594B]"
                      : "border-[#E6E3DD] bg-white text-[#5D6B67]"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-[#5D6B67]">{ayudaFiltroDivision(horizontalDivision)}</p>
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

        <div className="mt-6 flex flex-col gap-3 min-[780px]:flex-row min-[780px]:flex-wrap min-[780px]:items-center">
          {modo === "zona" || buscarTodoElMunicipio ? (
            <Button
              type="submit"
              disabled={
                (modo === "zona" ? !criteriosZona : !criteriosMunicipio) ||
                zonaOcupada ||
                cpAjenoAlMunicipio
              }
              className="h-[50px] w-full bg-[#0B7461] text-[15px] hover:bg-[#08594B] min-[780px]:h-auto min-[780px]:w-auto min-[780px]:text-sm"
            >
              <Search className="h-4 w-4" strokeWidth={1.5} aria-hidden />
              {zona.estado.fase === "preparando" ? "Preparando…" : "Rastrear fincas"}
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={loading || !criterios || cpAjenoAlMunicipio}
              className="h-[50px] w-full bg-[#0B7461] text-[15px] hover:bg-[#08594B] min-[780px]:h-auto min-[780px]:w-auto min-[780px]:text-sm"
            >
              <Search className="h-4 w-4" strokeWidth={1.5} aria-hidden />
              {loading ? "Buscando en Catastro..." : "Rastrear fincas"}
            </Button>
          )}
          <p className="text-center text-xs text-[#5D6B67] min-[780px]:text-left">Tarda unos minutos. Puedes pausar cuando quieras.</p>
        </div>
      </form>

      <section id="resultados" ref={resultadosRef} className="mt-8 scroll-mt-[6.5rem]" aria-live="polite">
        {modo === "zona" || zona.estado.fase !== "formulario" ? (
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
            onSiguienteBloque={() => {
              const origen =
                modo === "zona"
                  ? criteriosZona
                  : criteriosMunicipio;
              if (origen) void zona.siguienteBloque(origen);
            }}
            onNuevaBusqueda={() => {
              zona.nueva();
              seleccionFincas.limpiar();
              setFiltroRevision("ALL");
            }}
            onToggleSeleccion={onToggleSeleccion}
            onMarcarPagina={onMarcarPagina}
            onToggleRevision={onToggleRevision}
            onExportarRevision={onExportarRevision}
            onVerTodas={() => buscarConFiltroDivision("ALL")}
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
                seleccion={seleccion}
                revision={revision}
                filtroRevision={filtroRevision}
                onFiltroRevision={setFiltroRevision}
                onToggleSeleccion={onToggleSeleccion}
                onMarcarPagina={onMarcarPagina}
                onExportarRevision={onExportarRevision}
                onSiguiente={irSiguiente}
                onVerTodas={() => buscarConFiltroDivision("ALL")}
              />
            ) : null}
          </>
        )}
      </section>

      {mostrarRecientes ? <BusquedasRecientes refreshKey={recientesKey} compact /> : null}

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
  seleccion,
  revision,
  filtroRevision,
  onFiltroRevision,
  onToggleSeleccion,
  onMarcarPagina,
  onExportarRevision,
  onSiguiente,
  onVerTodas,
}: {
  resultado: ResultadoBusquedaUi;
  loading: boolean;
  seleccion: SeleccionFincas;
  revision: RevisionFincas;
  filtroRevision: FiltroRevisionComercial;
  onFiltroRevision: (filtro: FiltroRevisionComercial) => void;
  onToggleSeleccion: (finca: FincaBusquedaUi) => void;
  onMarcarPagina: (fincas: FincaBusquedaUi[], marcar: boolean) => void;
  onExportarRevision: () => void;
  onSiguiente: () => void;
  onVerTodas: () => void;
}) {
  const visibles = filtrarPorRevisionComercial(resultado.results, filtroRevision, revision);
  const recuento = recuentoEstadosDivision(visibles);
  const seleccionadasEnPagina = visibles.filter((finca) =>
    estaSeleccionada(seleccion, finca.fincaReference)
  ).length;
  const barraPaginas =
    resultado.results.length > 0 || resultado.pagination.hasNextPage ? (
      <BarraPaginacion
        viendo={resultado.results.length}
        total={resultado.results.length}
        hayMas={resultado.pagination.hasNextPage}
        cargando={loading}
        onMas={onSiguiente}
      />
    ) : null;
  const cobertura = textosCobertura({
    complete: resultado.coverage.complete,
    completeCandidates: resultado.coverage.completeCandidates,
    hasNextPage: resultado.pagination.hasNextPage,
    possibleCut: resultado.coverage.possibleCut,
  });

  return (
    <div className="scroll-mt-[6.4rem] space-y-4 sm:scroll-mt-[6.9rem]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-base font-semibold text-foreground">
            {`${recuento.ALL.toLocaleString("es-ES")} fincas · ${recuento.NO.toLocaleString("es-ES")} candidatas`}
            {revision.fincas.length > 0 ? ` · ${textoRevision(revision.fincas.length)}` : null}
            {seleccionadasEnPagina > 0 ? ` · ${seleccionadasEnPagina} seleccionadas` : null}
          </p>
          {resultado.pagination.hasNextPage || !resultado.coverage.complete ? (
            <p className="text-sm text-neutral-500">
              Resultados de los portales revisados hasta ahora.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-neutral-600">
            <span className="sr-only">Filtrar por revisión</span>
            <select
              className={SELECT_CLASS}
              value={filtroRevision}
              onChange={(event) => onFiltroRevision(event.target.value as FiltroRevisionComercial)}
              aria-label="Filtrar por revisión"
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
        <VacioResultados
          filtro={resultado.search.horizontalDivision}
          onVerTodas={onVerTodas}
        />
      ) : (
        <ListaFincasCatastro
          fincas={visibles}
          hrefDe={(finca) => rutaFincaPersistida(finca.fincaReference)}
          seleccionada={(ref) => estaSeleccionada(seleccion, ref)}
          onToggleSeleccion={onToggleSeleccion}
          onMarcarPagina={onMarcarPagina}
          fincasSeleccionadas={seleccion.fincas.map((finca) => finca.fincaReference)}
          topeExterno
          pie={barraPaginas ? <div className="border-t border-[#F2F0EB] px-3.5 py-3">{barraPaginas}</div> : null}
        />
      )}
    </div>
  );
}
