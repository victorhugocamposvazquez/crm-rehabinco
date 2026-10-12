"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MapaAvm } from "@/components/avm/MapaAvm";
import { PanelLateralValoracion } from "@/components/avm/nueva/PanelLateralValoracion";
import { PreguntaPaso } from "@/components/avm/nueva/PreguntaPaso";
import {
  buscarEnCrm,
  candidatosDireccion,
  construirGemelo,
  valorarInmueble,
  type ResultadoBusquedaCrm,
} from "@/lib/actions/avm-valuar";
import { confirmedCount, nextStep, resolveFlow, type StepId } from "@/lib/avm/flow";
import { computeLiveEstimate, computePrecision } from "@/lib/avm/estimate";
import { descartarBorrador, guardarBorrador, leerBorrador } from "@/lib/avm/ui/borrador-nueva";
import { ETIQUETA_MAIN_TYPE, ETIQUETA_PROPERTY_TYPE } from "@/lib/avm/ui/labels";
import { normalizarReferencia, tipoReferencia } from "@/lib/avm/ui/referencia";
import { mensajeReferencia } from "@/lib/avm/ui/referencia-mensaje";
import {
  BandBorrador,
  CampoEntrada,
  QNav,
  SegControl,
  SugerenciaChip,
  TagAvm,
} from "@/components/avm/nueva/wizard-ui";
import { etiquetaUnidad, unidadesAgrupadas } from "@/lib/avm/ui/unidades";
import { plantaNumero, type TwinUnit } from "@/lib/avm/twin-builder";
import { useAuth } from "@/lib/auth/auth-context";
import { createClient } from "@/lib/supabase/client";
import type { Twin } from "@/lib/avm/types";

type GemeloOk = Extract<Awaited<ReturnType<typeof construirGemelo>>, { ok: true }>;

type Pantalla =
  | "entrada"
  | "mapa-direccion"
  | "unidad"
  | "catastro"
  | "pregunta"
  | "valorar";

type EntryTab = "direccion" | "referencia" | "mapa" | "crm";

const CENTRO_AGENCIA = { lat: 43.3665, lng: -8.406, label: "A Coruña" };

export function NuevaValoracionWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromId = searchParams.get("from");
  const { user } = useAuth();

  const [pantalla, setPantalla] = useState<Pantalla>("entrada");
  const [historial, setHistorial] = useState<Pantalla[]>([]);
  const [entryTab, setEntryTab] = useState<EntryTab>("direccion");
  const [origen, setOrigen] = useState("direccion");

  const [consulta, setConsulta] = useState("");
  const [sugerencias, setSugerencias] = useState<{ address: string; lat: number; lng: number }[]>([]);
  const [elegida, setElegida] = useState<{ address: string; lat: number; lng: number } | null>(null);
  const [pinMapa, setPinMapa] = useState(CENTRO_AGENCIA);
  const [referencia, setReferencia] = useState("");
  const [crmQ, setCrmQ] = useState("");
  const [crmRes, setCrmRes] = useState<ResultadoBusquedaCrm[]>([]);
  const [buscaMapa, setBuscaMapa] = useState("");
  const [sugerenciasMapa, setSugerenciasMapa] = useState<{ address: string; lat: number; lng: number }[]>([]);

  const [built, setBuilt] = useState<GemeloOk | null>(null);
  const [units, setUnits] = useState<TwinUnit[] | null>(null);
  const [filtroPlanta, setFiltroPlanta] = useState("");
  const [catastroOk, setCatastroOk] = useState(false);
  const [pasoActivo, setPasoActivo] = useState<StepId | null>(null);
  const [vistos, setVistos] = useState<StepId[]>([]);

  const [mediana, setMediana] = useState<{ median: number; n: number; trend: number | null; label?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [borradorBanner, setBorradorBanner] = useState<{ etiqueta: string } | null>(null);

  const twin = built?.twin ?? null;
  const prefilled = useMemo(() => new Set((built?.prefilledFields ?? []) as (keyof Twin)[]), [built]);
  const prefilledPasos = useMemo(
    () => (twin ? resolveFlow(twin, "crm", prefilled).filter((s) => s.prefilled && s.fields.length > 0) : []),
    [twin, prefilled],
  );

  const paso = useMemo(() => {
    if (!twin) return null;
    if (pasoActivo) return resolveFlow(twin, "crm", prefilled).find((s) => s.id === pasoActivo) ?? null;
    return nextStep(twin, "crm", prefilled);
  }, [twin, prefilled, pasoActivo]);

  const precision = twin ? computePrecision(twin) : 0;
  const estimado = twin ? computeLiveEstimate(twin, mediana?.median ?? null) : null;
  const confirmados = twin ? confirmedCount(twin, "crm", prefilled) : 0;
  const sinMasPasos = twin ? !nextStep(twin, "crm", prefilled) : false;
  const listoValorar = Boolean(twin && (pantalla === "valorar" || sinMasPasos));

  const refTipo = tipoReferencia(referencia);
  const grupos = units ? unidadesAgrupadas(units) : null;

  const ir = useCallback((siguiente: Pantalla) => {
    setPantalla((actual) => {
      setHistorial((h) => [...h, actual]);
      return siguiente;
    });
  }, []);

  const atras = useCallback(() => {
    setHistorial((h) => {
      const prev = h[h.length - 1];
      if (!prev) return h;
      setPantalla(prev);
      return h.slice(0, -1);
    });
  }, []);

  useEffect(() => {
    if (!user?.id || built) return;
    const b = leerBorrador(user.id);
    if (b) setBorradorBanner({ etiqueta: b.etiqueta });
  }, [user?.id, built]);

  function reanudarBorrador() {
    if (!user?.id) return;
    const b = leerBorrador(user.id);
    if (!b?.built) return;
    const ok = b.built as GemeloOk;
    setBuilt(ok);
    setOrigen(b.origen);
    setEntryTab(b.entryTab as EntryTab);
    setPantalla(b.pantalla as Pantalla);
    setHistorial((b.historial ?? []) as Pantalla[]);
    setBorradorBanner(null);
  }

  useEffect(() => {
    if (!fromId || built) return;
    const supabase = createClient();
    void supabase
      .from("avm_valuations")
      .select("inputs")
      .eq("id", fromId)
      .maybeSingle()
      .then(({ data }) => {
        const inputs = data?.inputs as { twin?: Twin; fieldSources?: GemeloOk["fieldSources"]; prefilledFields?: string[] };
        if (!inputs?.twin) return;
        setBuilt({
          ok: true,
          twin: inputs.twin,
          fieldSources: inputs.fieldSources ?? {},
          prefilledFields: [],
          propertySource: "manual",
          geocodingSource: "catastro",
          warnings: [],
          units: [],
        });
        setCatastroOk(false);
        setPantalla(prefilledPasos.length ? "catastro" : "pregunta");
      });
  }, [fromId, built, prefilledPasos.length]);

  useEffect(() => {
    if (consulta.trim().length < 4) {
      setSugerencias([]);
      return;
    }
    const t = window.setTimeout(() => {
      void candidatosDireccion(consulta).then(setSugerencias);
    }, 300);
    return () => clearTimeout(t);
  }, [consulta]);

  useEffect(() => {
    if (crmQ.trim().length < 2) {
      setCrmRes([]);
      return;
    }
    const t = window.setTimeout(() => void buscarEnCrm(crmQ).then(setCrmRes), 300);
    return () => clearTimeout(t);
  }, [crmQ]);

  useEffect(() => {
    if (buscaMapa.trim().length < 4) {
      setSugerenciasMapa([]);
      return;
    }
    const t = window.setTimeout(() => void candidatosDireccion(buscaMapa).then(setSugerenciasMapa), 300);
    return () => clearTimeout(t);
  }, [buscaMapa]);

  useEffect(() => {
    if (!twin?.address.lat || !twin.address.lng) return;
    const supabase = createClient();
    void supabase
      .rpc("avm_zone_median", {
        p_lat: twin.address.lat,
        p_lng: twin.address.lng,
        p_main_type: twin.mainType ?? "apartment",
        p_operation: "sale",
      })
      .then(({ data }) => {
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) {
          setMediana(null);
          return;
        }
        setMediana({
          median: row.median_ppm2 == null ? 0 : Number(row.median_ppm2),
          n: Number(row.n ?? 0),
          trend: row.trend_12m_pct == null ? null : Number(row.trend_12m_pct),
          label: twin.address.postcode ?? twin.address.locality ?? undefined,
        });
      });
  }, [twin?.address.lat, twin?.address.lng, twin?.mainType, twin?.address.postcode, twin?.address.locality]);

  useEffect(() => {
    if (!user?.id || !built) return;
    guardarBorrador(user.id, {
      pantalla,
      entryTab,
      origen,
      twin,
      built,
      historial: historial as string[],
      etiqueta: twin?.address.formattedAddress?.split(",")[0] ?? "Valoración a medias",
    });
  }, [user?.id, built, pantalla, entryTab, origen, twin, historial]);

  function trasGemelo(res: GemeloOk, pendingUnits: TwinUnit[] | null) {
    setBuilt(res);
    setCatastroOk(false);
    setVistos([]);
    setPasoActivo(null);
    if (pendingUnits && pendingUnits.length > 1) {
      setUnits(pendingUnits);
      ir("unidad");
      return;
    }
    setUnits(null);
    if (resolveFlow(res.twin, "crm", new Set(res.prefilledFields as (keyof Twin)[])).some((s) => s.prefilled && s.fields.length)) {
      ir("catastro");
      return;
    }
    ir(nextStep(res.twin, "crm", new Set(res.prefilledFields as (keyof Twin)[])) ? "pregunta" : "valorar");
  }

  async function cargar(input: Parameters<typeof construirGemelo>[0], orig: string) {
    setOcupado(true);
    setError(null);
    setOrigen(orig);
    const res = await construirGemelo(input);
    setOcupado(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (input.catastralRef) setUnits(null);
    const pending = res.units.length > 1 ? res.units : null;
    trasGemelo(res, pending);
  }

  function aplicar(patch: Partial<Twin>, pasoId?: StepId) {
    if (!built) return;
    const campos = Object.keys(patch) as (keyof Twin)[];
    setBuilt({
      ...built,
      twin: { ...built.twin, ...patch },
      prefilledFields: built.prefilledFields.filter((f) => !campos.includes(f as keyof Twin)),
    });
    setPasoActivo(null);
    if (pasoId) setVistos((ids) => (ids.includes(pasoId) ? ids : [...ids, pasoId]));
    const t = { ...built.twin, ...patch };
    const sig = nextStep(t, "crm", new Set(built.prefilledFields.filter((f) => !campos.includes(f as keyof Twin)) as (keyof Twin)[]));
    setPantalla(sig ? "pregunta" : "valorar");
  }

  async function terminar() {
    if (!built) return;
    setOcupado(true);
    const res = await valorarInmueble({
      input: {
        twin: built.twin,
        fieldSources: built.fieldSources,
        prefilledFields: built.prefilledFields,
        propertySource: built.propertySource,
        geocodingSource: built.geocodingSource,
        warnings: built.warnings,
      },
      channel: "crm",
    });
    setOcupado(false);
    if (res.status === 200 && "valuationId" in res.body) {
      if (user?.id) descartarBorrador(user.id);
      router.push(`/valoraciones/${res.body.valuationId}`);
      return;
    }
    if (res.status === 409 && "units" in res.body) {
      setUnits(res.body.units);
      setPantalla("unidad");
      return;
    }
    setError("error" in res.body ? res.body.error : "No se ha podido valorar");
  }

  const tituloPaso = useMemo(() => {
    const map: Record<Pantalla, string> = {
      entrada: "¿Qué inmueble valoramos?",
      "mapa-direccion": "Confirma la ubicación",
      unidad: "Elige la unidad",
      catastro: "Confirmado desde Catastro",
      pregunta: paso?.title ?? "Detalles del inmueble",
      valorar: "Lista para valorar",
    };
    return map[pantalla];
  }, [pantalla, paso?.title]);

  const totalPasos = 9;
  const indicePaso = pantalla === "entrada" ? 1 : pantalla === "mapa-direccion" ? 2 : pantalla === "unidad" ? 3 : pantalla === "catastro" ? 4 : pantalla === "pregunta" ? 5 + vistos.length : totalPasos;

  return (
    <div className="pb-24 lg:pb-8">
      {borradorBanner && !built ? (
        <BandBorrador
          etiqueta={borradorBanner.etiqueta}
          onReanudar={reanudarBorrador}
          onDescartar={() => {
            if (user?.id) descartarBorrador(user.id);
            setBorradorBanner(null);
          }}
        />
      ) : null}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 lg:max-w-[760px]">
          <div className="min-h-[300px] rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 min-[820px]:p-6">
            <div className="mb-3.5 flex items-center justify-between gap-2 text-[13px] text-[var(--text-3)]">
              <button type="button" className="hover:text-foreground disabled:opacity-40" onClick={atras} disabled={!historial.length}>
                ← Atrás
              </button>
              <span className="text-[var(--text-3)]">
                Paso {Math.min(indicePaso, totalPasos)} de {totalPasos} · {tituloPaso}
              </span>
            </div>

            {pantalla === "entrada" ? (
              <Entrada
                tab={entryTab}
                setTab={setEntryTab}
                consulta={consulta}
                setConsulta={setConsulta}
                sugerencias={sugerencias}
                onElegirDireccion={(s) => {
                  setElegida(s);
                  setPinMapa({ lat: s.lat, lng: s.lng, label: CENTRO_AGENCIA.label });
                  ir("mapa-direccion");
                }}
                referencia={referencia}
                setReferencia={setReferencia}
                refTipo={refTipo}
                ocupado={ocupado}
                onBuscarRef={() => void cargar({ catastralRef: normalizarReferencia(referencia) }, "referencia")}
                pinMapa={pinMapa}
                setPinMapa={setPinMapa}
                onUsarPin={() => void cargar({ lat: pinMapa.lat, lng: pinMapa.lng }, "mapa")}
                crmQ={crmQ}
                setCrmQ={setCrmQ}
                crmRes={crmRes}
                onElegirCrm={(r) => {
                  if (r.tipo === "anuncio") void cargar({ listingId: r.id }, "crm");
                  else void cargar({ crmPropertyId: r.id }, "crm");
                }}
                buscaMapa={buscaMapa}
                setBuscaMapa={setBuscaMapa}
                sugerenciasMapa={sugerenciasMapa}
              />
            ) : null}

            {pantalla === "mapa-direccion" && elegida ? (
              <div className="space-y-3">
                <h2 className="text-[22px] font-semibold tracking-[-0.02em]">Confirma la ubicación</h2>
                <p className="text-[14px] text-[var(--text-3)]">{elegida.address}</p>
                <MapaAvm
                  className="h-[260px] w-full overflow-hidden rounded-lg border border-[var(--border)]"
                  lat={pinMapa.lat}
                  lng={pinMapa.lng}
                  arrastrable
                  onMover={(lat, lng) => setPinMapa((p) => ({ ...p, lat, lng }))}
                />
                <p className="text-[12px] text-[var(--text-3)]">Si el punto no está en el portal, arrástralo.</p>
                <QNav
                  disabled={ocupado}
                  onContinuar={() => void cargar({ address: elegida.address, lat: pinMapa.lat, lng: pinMapa.lng }, "direccion")}
                />
              </div>
            ) : null}

            {pantalla === "unidad" && grupos ? (
              <Unidades
                grupos={grupos}
                filtroPlanta={filtroPlanta}
                setFiltroPlanta={setFiltroPlanta}
                onElegir={(ref) => void cargar({ catastralRef: ref }, "unidad")}
              />
            ) : null}

            {pantalla === "catastro" && twin ? (
              <CatastroConfirm
                twin={twin}
                prefilled={prefilledPasos}
                onCorregir={(id) => {
                  setPasoActivo(id);
                  ir("pregunta");
                }}
                onTodoOk={() => {
                  setCatastroOk(true);
                  const sig = nextStep(twin, "crm", prefilled);
                  setPantalla(sig ? "pregunta" : "valorar");
                }}
              />
            ) : null}

            {pantalla === "pregunta" && twin && paso ? (
              <PreguntaPaso
                pasoId={paso.id}
                title={paso.title}
                hint={paso.hint}
                twin={twin}
                optional={paso.optional}
                onContinuar={(patch) => aplicar(patch, paso.id)}
                onSaltar={() => {
                  setVistos((v) => [...v, paso.id]);
                  setPasoActivo(null);
                  const t = twin;
                  const sig = nextStep(t, "crm", prefilled);
                  setPantalla(sig && sig.id !== paso.id ? "pregunta" : "valorar");
                }}
              />
            ) : null}

            {pantalla === "valorar" && twin ? (
              <div className="space-y-3">
                <h2 className="text-[22px] font-semibold">Revisa y valora</h2>
                <p className="text-[14px] text-[var(--text-3)]">
                  {twin.address.formattedAddress ?? "Inmueble listo"} · {confirmados} detalles confirmados
                </p>
                <Button type="button" className="lg:hidden" disabled={ocupado} onClick={() => void terminar()}>
                  Valorar
                </Button>
              </div>
            ) : null}

            {error ? <p className="mt-4 text-[13px] text-red-600">{error}</p> : null}
          </div>
          <p className="mt-3 text-[12px] text-[var(--text-3)]">
            Una pregunta por pantalla. Enter avanza; «No lo sé» salta el paso. El borrador se guarda solo y se puede reanudar 24 h.
          </p>
        </div>

        <PanelLateralValoracion
          precision={precision}
          estimado={estimado}
          twin={twin}
          confirmados={confirmados}
          mediana={mediana}
          muestraCatastro={Boolean(built && prefilled.size > 0 && !catastroOk)}
          listoValorar={listoValorar || pantalla === "valorar"}
          ocupado={ocupado}
          onValorar={() => void terminar()}
        />
      </div>

      <PanelLateralValoracion
        compacto
        precision={precision}
        estimado={estimado}
        twin={twin}
        confirmados={confirmados}
        mediana={mediana}
        muestraCatastro={false}
        listoValorar={listoValorar || pantalla === "valorar"}
        ocupado={ocupado}
        onValorar={() => void terminar()}
      />
    </div>
  );
}

function Entrada(props: {
  tab: EntryTab;
  setTab: (t: EntryTab) => void;
  consulta: string;
  setConsulta: (v: string) => void;
  sugerencias: { address: string; lat: number; lng: number }[];
  onElegirDireccion: (s: { address: string; lat: number; lng: number }) => void;
  referencia: string;
  setReferencia: (v: string) => void;
  refTipo: ReturnType<typeof tipoReferencia>;
  ocupado: boolean;
  onBuscarRef: () => void;
  pinMapa: { lat: number; lng: number };
  setPinMapa: React.Dispatch<React.SetStateAction<{ lat: number; lng: number; label: string }>>;
  onUsarPin: () => void;
  crmQ: string;
  setCrmQ: (v: string) => void;
  crmRes: ResultadoBusquedaCrm[];
  onElegirCrm: (r: ResultadoBusquedaCrm) => void;
  buscaMapa: string;
  setBuscaMapa: (v: string) => void;
  sugerenciasMapa: { address: string; lat: number; lng: number }[];
}) {
  const tabs: { id: EntryTab; label: string }[] = [
    { id: "direccion", label: "Dirección" },
    { id: "referencia", label: "Referencia catastral" },
    { id: "mapa", label: "En el mapa" },
    { id: "crm", label: "Del CRM" },
  ];
  const refMsg = mensajeReferencia(props.referencia);
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[22px] font-semibold tracking-[-0.02em]">¿Qué inmueble valoramos?</h2>
      </div>
      <SegControl options={tabs} value={props.tab} onChange={props.setTab} />

      {props.tab === "direccion" ? (
        <div className="mt-4 space-y-2">
          <CampoEntrada label="Dirección" icon="search">
            <input
              value={props.consulta}
              onChange={(e) => props.setConsulta(e.target.value)}
              placeholder="Calle, número y municipio"
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
              autoComplete="off"
            />
          </CampoEntrada>
          <div className="flex flex-col gap-1.5">
            {props.sugerencias.slice(0, 6).map((s) => (
              <SugerenciaChip key={`${s.lat}-${s.lng}`} titulo={s.address} onClick={() => props.onElegirDireccion(s)} />
            ))}
          </div>
        </div>
      ) : null}

      {props.tab === "referencia" ? (
        <div className="mt-4 space-y-2">
          <CampoEntrada label="Referencia catastral" icon="file">
            <input
              value={props.referencia}
              onChange={(e) => props.setReferencia(e.target.value.toUpperCase().replace(/\s/g, ""))}
              className="min-w-0 flex-1 bg-transparent font-mono text-[15px] tracking-wide outline-none"
              placeholder="20 caracteres del inmueble, o 14 de la parcela"
              spellCheck={false}
              autoComplete="off"
              onKeyDown={(e) => {
                if (e.key === "Enter" && refMsg.ok && !props.ocupado) props.onBuscarRef();
              }}
            />
          </CampoEntrada>
          <p
            className={`min-h-4 text-[12px] ${refMsg.clase === "err" ? "text-red-600" : refMsg.clase === "ok" ? "text-emerald-600" : "text-[var(--text-3)]"}`}
          >
            {refMsg.texto}
          </p>
          <details className="text-[13px] text-[var(--text-3)]">
            <summary className="cursor-pointer text-foreground underline underline-offset-[3px]">¿Dónde la encuentro?</summary>
            <ul className="mt-2 list-disc pl-[18px]">
              <li>En el recibo del IBI, junto a la dirección.</li>
              <li>En la escritura o en la nota simple del Registro.</li>
              <li>En la Sede Electrónica del Catastro, buscando por dirección.</li>
            </ul>
          </details>
          <QNav label="Buscar" disabled={!refMsg.ok || props.ocupado} onContinuar={props.onBuscarRef} />
        </div>
      ) : null}

      {props.tab === "mapa" ? (
        <div className="mt-4 space-y-2">
          <p className="text-[12px] text-[var(--text-3)]">
            Acerca el mapa y arrastra el marcador hasta el portal. Se usa el punto para pedir a Catastro la parcela.
          </p>
          <CampoEntrada label="Buscar calle" icon="search">
            <input
              value={props.buscaMapa}
              onChange={(e) => props.setBuscaMapa(e.target.value)}
              placeholder="Nombre de calle"
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
            />
          </CampoEntrada>
          {props.sugerenciasMapa.length ? (
            <div className="flex flex-col gap-1.5">
              {props.sugerenciasMapa.slice(0, 4).map((s) => (
                <SugerenciaChip
                  key={`m-${s.lat}`}
                  titulo={s.address}
                  onClick={() => props.setPinMapa((p) => ({ ...p, lat: s.lat, lng: s.lng }))}
                />
              ))}
            </div>
          ) : null}
          <MapaAvm
            className="h-[360px] w-full overflow-hidden rounded-lg border border-[var(--border)]"
            lat={props.pinMapa.lat}
            lng={props.pinMapa.lng}
            zoom={13}
            arrastrable
            onMover={(lat, lng) => props.setPinMapa((p) => ({ ...p, lat, lng }))}
          />
          <p className="text-[12px] tabular-nums text-[var(--text-3)]">
            {props.pinMapa.lat.toFixed(5)} · {props.pinMapa.lng.toFixed(5)}
          </p>
          <QNav label="Usar este punto" disabled={props.ocupado} onContinuar={props.onUsarPin} />
        </div>
      ) : null}

      {props.tab === "crm" ? (
        <div className="mt-4 space-y-2">
          <CampoEntrada label="Inmueble o anuncio captado" icon="search">
            <input
              value={props.crmQ}
              onChange={(e) => props.setCrmQ(e.target.value)}
              placeholder="Dirección, referencia o id"
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
            />
          </CampoEntrada>
          <div className="flex flex-col gap-1.5">
            {props.crmRes.map((r) => (
              <button
                key={`${r.tipo}-${r.id}`}
                type="button"
                className="flex w-full gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-left hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
                onClick={() => props.onElegirCrm(r)}
              >
                <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg bg-[var(--surface-soft)] text-[var(--text-3)] text-[11px] font-semibold">
                  {r.tipo === "inmueble" ? "IN" : "AN"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] text-[var(--text-3)]">{r.tipo === "inmueble" ? "Inmueble" : "Captación"}</span>
                  <span className="block text-[14px]">{r.titulo}</span>
                  <span className="block text-[12px] text-[var(--text-3)]">{r.subtitulo}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Unidades({
  grupos,
  filtroPlanta,
  setFiltroPlanta,
  onElegir,
}: {
  grupos: ReturnType<typeof unidadesAgrupadas>;
  filtroPlanta: string;
  setFiltroPlanta: (v: string) => void;
  onElegir: (ref: string) => void;
}) {
  const filtroN = filtroPlanta ? plantaNumero(filtroPlanta) : null;
  const viviendas = grupos.viviendas.filter((u) => (filtroN == null ? true : plantaNumero(u.floor) === filtroN));
  return (
    <div className="space-y-4">
      <h2 className="text-[22px] font-semibold">Elige la unidad</h2>
      <input
        value={filtroPlanta}
        onChange={(e) => setFiltroPlanta(e.target.value)}
        placeholder="Filtrar por planta (ej. 3)"
        className="h-10 w-full max-w-xs rounded-lg border border-[var(--border)] px-3 text-[14px]"
      />
      <div className="flex flex-col gap-2">
        {viviendas.map((u) => (
          <button
            key={u.catastralRef}
            type="button"
            className="flex w-full items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-left hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
            onClick={() => onElegir(u.catastralRef)}
          >
            <span className="text-[14px]">
              <b>{etiquetaUnidad(u).split(" · ")[0]}</b>
              {etiquetaUnidad(u).includes(" · ") ? ` · ${etiquetaUnidad(u).split(" · ").slice(1).join(" · ")}` : ""}
            </span>
            <span className="font-mono text-[11px] text-[var(--text-3)]">…{u.catastralRef.slice(-6)}</span>
          </button>
        ))}
      </div>
      {grupos.otros.length ? (
        <details className="mt-1">
          <summary className="cursor-pointer list-none text-[13px] text-[var(--text-3)] before:mr-1 before:text-[var(--text-3)] before:content-['▸_'] open:before:content-['▾_']">
            Otros usos: locales, garajes y trasteros · {grupos.otros.length}
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            {grupos.otros.map((u) => (
              <button
                key={u.catastralRef}
                type="button"
                className="flex w-full items-center justify-between rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-left hover:bg-[var(--surface-soft)]"
                onClick={() => onElegir(u.catastralRef)}
              >
                <span className="text-[14px]">{etiquetaUnidad(u)}</span>
              </button>
            ))}
          </div>
        </details>
      ) : null}
      <p className="text-[12px] text-[var(--text-3)]">Viviendas primero, ordenadas por planta y puerta.</p>
    </div>
  );
}

function CatastroConfirm({
  twin,
  prefilled,
  onCorregir,
  onTodoOk,
}: {
  twin: Twin;
  prefilled: ReturnType<typeof resolveFlow>;
  onCorregir: (id: StepId) => void;
  onTodoOk: () => void;
}) {
  const tarjetas: { id: StepId; label: string; value: string }[] = [];
  for (const s of prefilled) {
    if (s.id === "surface" && twin.builtSurface) tarjetas.push({ id: s.id, label: "Superficie", value: `${twin.builtSurface} m²` });
    else if (s.id === "constructionYear" && twin.constructionYear) tarjetas.push({ id: s.id, label: "Año", value: String(twin.constructionYear) });
    else if (s.id === "floors" && twin.floorOfFlat != null)
      tarjetas.push({ id: s.id, label: "Planta", value: `${twin.floorOfFlat}ª${twin.numberOfFloors ? ` de ${twin.numberOfFloors}` : ""}` });
    else if (s.id === "propertyType" && twin.mainType)
      tarjetas.push({
        id: s.id,
        label: "Tipo",
        value: ETIQUETA_PROPERTY_TYPE[twin.propertyType ?? twin.mainType] ?? ETIQUETA_MAIN_TYPE[twin.mainType],
      });
  }
  return (
    <div className="space-y-4">
      <h2 className="text-[22px] font-semibold">Confirmado desde Catastro</h2>
      <p className="text-[14px] text-[var(--text-3)]">Hemos encontrado tu inmueble. Confírmalo o corrige lo que no cuadre.</p>
      <div className="mb-2 flex flex-wrap gap-2">
        {twin.address.formattedAddress ? <TagAvm className="text-foreground">{twin.address.formattedAddress}</TagAvm> : null}
        {twin.address.catastralRef ? (
          <TagAvm>
            ref. <span className="font-mono">{twin.address.catastralRef}</span>
          </TagAvm>
        ) : null}
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {tarjetas.map((t) => (
          <div key={t.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3.5 py-3">
            <p className="text-[12px] text-[var(--text-3)]">{t.label}</p>
            <div className="mt-0.5 flex items-center justify-between gap-2">
              <span className="font-semibold tabular-nums">
                {t.value} <TagAvm className="ml-1 border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">Catastro</TagAvm>
              </span>
              <button type="button" className="text-[12px] underline underline-offset-2" onClick={() => onCorregir(t.id)}>
                Corregir
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[12px] text-[var(--text-3)]">
        Si Catastro no respondiera, te pediríamos estos datos y la valoración saldría con menos confianza. Nunca se bloquea.
      </p>
      <QNav label="Todo correcto, continuar" onContinuar={onTodoOk} />
    </div>
  );
}
