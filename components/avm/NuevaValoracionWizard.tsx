"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MapaAvm } from "@/components/avm/MapaAvm";
import { PanelLateralValoracion } from "@/components/avm/nueva/PanelLateralValoracion";
import { PantallaGrupo } from "@/components/avm/nueva/PantallaGrupo";
import {
  buscarEnCrm,
  candidatosDireccion,
  construirGemelo,
  valorarInmueble,
  type ResultadoBusquedaCrm,
} from "@/lib/actions/avm-valuar";
import { computeLiveEstimate, computePrecision } from "@/lib/avm/estimate";
import { descartarBorrador, guardarBorrador, leerBorrador } from "@/lib/avm/ui/borrador-nueva";
import { normalizarReferencia, tipoReferencia } from "@/lib/avm/ui/referencia";
import { mensajeReferencia } from "@/lib/avm/ui/referencia-mensaje";
import { etiquetaUnidad, unidadesAgrupadas } from "@/lib/avm/ui/unidades";
import { filasConocidas } from "@/lib/avm/wizard-known";
import {
  canContinueScreen,
  screenForField,
  wizardScreens,
  type WizardScreenId,
} from "@/lib/avm/wizard-groups";
import { plantaNumero, type TwinUnit } from "@/lib/avm/twin-builder";
import { useAuth } from "@/lib/auth/auth-context";
import { createClient } from "@/lib/supabase/client";
import type { Channel, Twin } from "@/lib/avm/types";
import {
  BandBorrador,
  CampoEntrada,
  QNav,
  SegControl,
  SugerenciaChip,
  TagAvm,
} from "@/components/avm/nueva/wizard-ui";

type GemeloOk = Extract<Awaited<ReturnType<typeof construirGemelo>>, { ok: true }>;
type EntryTab = "direccion" | "referencia" | "mapa" | "crm";
type Candidato = Awaited<ReturnType<typeof candidatosDireccion>>[number];

const CENTRO_AGENCIA = { lat: 43.3665, lng: -8.406, label: "A Coruña" };

function normalizarEntryTab(tab: string): EntryTab {
  if (tab === "address" || tab === "direccion") return "direccion";
  if (tab === "ref" || tab === "referencia") return "referencia";
  if (tab === "pin" || tab === "mapa") return "mapa";
  if (tab === "crm") return "crm";
  return "direccion";
}

export function NuevaValoracionWizard({
  channel = "crm",
  landingSlug = "rehabinco",
}: {
  channel?: Channel;
  landingSlug?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromId = searchParams.get("from");
  const { user } = useAuth();

  const [pantalla, setPantalla] = useState<WizardScreenId>("address");
  const [historial, setHistorial] = useState<WizardScreenId[]>([]);
  const [entryTab, setEntryTab] = useState<EntryTab>("direccion");
  const setEntryTabSafe = useCallback((t: EntryTab) => setEntryTab(normalizarEntryTab(t)), []);
  const [origen, setOrigen] = useState("direccion");
  const [needsUnit, setNeedsUnit] = useState(false);
  const [unknown, setUnknown] = useState<Set<string>>(() => new Set());

  const [consulta, setConsulta] = useState("");
  const [sugerencias, setSugerencias] = useState<Candidato[]>([]);
  const [elegida, setElegida] = useState<Candidato | null>(null);
  const [pinMapa, setPinMapa] = useState(CENTRO_AGENCIA);
  const [referencia, setReferencia] = useState("");
  const [crmQ, setCrmQ] = useState("");
  const [crmRes, setCrmRes] = useState<ResultadoBusquedaCrm[]>([]);

  const [built, setBuilt] = useState<GemeloOk | null>(null);
  const [units, setUnits] = useState<TwinUnit[] | null>(null);
  const [filtroPlanta, setFiltroPlanta] = useState("");

  const [mediana, setMediana] = useState<{ median: number; n: number; trend: number | null; label?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [borradorBanner, setBorradorBanner] = useState<{ etiqueta: string } | null>(null);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);

  const twin = built?.twin ?? null;
  const screens = useMemo(() => wizardScreens(channel, needsUnit), [channel, needsUnit]);
  const stepIndex = screens.findIndex((s) => s.id === pantalla);
  const stepMeta = screens[stepIndex];

  const precision = twin ? computePrecision(twin) : 0;
  const estimado = twin ? computeLiveEstimate(twin, mediana?.median ?? null) : null;
  const conocidos = twin ? filasConocidas(twin, unknown, built?.fieldSources ?? {}) : [];
  const confirmados = conocidos.filter((r) => r.key !== "address" && r.key !== "catastralRef" && !r.unknown).length;

  const puedeContinuar = canContinueScreen(pantalla, twin, unknown, { email, consent, channel });
  const listoValorar = pantalla === "valorar";

  const ir = useCallback((siguiente: WizardScreenId) => {
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

  const siguiente = useCallback(() => {
    const next = screens[stepIndex + 1]?.id;
    if (next) ir(next);
  }, [screens, stepIndex, ir]);

  function patchTwin(patch: Partial<Twin>, touched: (keyof Twin)[]) {
    if (!built) return;
    const unk = new Set(unknown);
    const prefilled = built.prefilledFields.filter((f) => !touched.includes(f as keyof Twin));
    const fieldSources = { ...built.fieldSources };
    for (const f of touched) {
      delete fieldSources[f];
      if (patch[f as keyof Twin] === null) unk.add(String(f));
      else unk.delete(String(f));
    }
    setUnknown(unk);
    setBuilt({
      ...built,
      twin: { ...built.twin, ...patch },
      prefilledFields: prefilled,
      fieldSources,
    });
  }

  useEffect(() => {
    if (!user?.id || built) return;
    const b = leerBorrador(user.id);
    if (b) setBorradorBanner({ etiqueta: b.etiqueta });
  }, [user?.id, built]);

  function reanudarBorrador() {
    if (!user?.id) return;
    const b = leerBorrador(user.id);
    if (!b?.built) return;
    setBuilt(b.built as GemeloOk);
    setOrigen(b.origen);
    setEntryTab(normalizarEntryTab(b.entryTab));
    setPantalla((b.pantalla as WizardScreenId) ?? "address");
    setHistorial((b.historial ?? []) as WizardScreenId[]);
    setUnknown(new Set((b as { unknown?: string[] }).unknown ?? []));
    setBorradorBanner(null);
  }

  useEffect(() => {
    if (consulta.trim().length < 4) {
      setSugerencias([]);
      return;
    }
    const t = window.setTimeout(() => void candidatosDireccion(consulta).then(setSugerencias), 300);
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
      unknown: [...unknown],
    } as Parameters<typeof guardarBorrador>[1]);
  }, [user?.id, built, pantalla, entryTab, origen, twin, historial, unknown]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.defaultPrevented) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA") return;
      if (pantalla === "address" || pantalla === "valorar") return;
      if (!puedeContinuar || ocupado) return;
      e.preventDefault();
      siguiente();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [puedeContinuar, ocupado, pantalla, siguiente]);

  function trasGemelo(res: GemeloOk, pendingUnits: TwinUnit[] | null) {
    setBuilt(res);
    setUnknown(new Set());
    if (pendingUnits && pendingUnits.length > 1) {
      setUnits(pendingUnits);
      setNeedsUnit(true);
      ir("unit");
      return;
    }
    setUnits(null);
    setNeedsUnit(false);
    ir("building");
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
    const pending = res.units.length > 1 ? res.units : null;
    trasGemelo(res, pending);
  }

  async function terminar() {
    if (!built) return;
    setOcupado(true);
    const payload = {
      input: {
        twin: built.twin,
        fieldSources: built.fieldSources,
        prefilledFields: built.prefilledFields,
        propertySource: built.propertySource,
        geocodingSource: built.geocodingSource,
        warnings: built.warnings,
      },
      channel,
      ...(channel === "landing" ? { landingSlug } : {}),
    };
    const res =
      channel === "landing"
        ? await fetch("/api/avm/valuate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
            .then(async (r) => ({ status: r.status as number, body: await r.json() }))
            .catch(() => ({ status: 500, body: { error: "Error de red" } }))
        : await valorarInmueble(payload);
    setOcupado(false);
    if (res.status === 200 && "valuationId" in res.body) {
      if (user?.id) descartarBorrador(user.id);
      router.push(`/valoraciones/${(res.body as { valuationId: string }).valuationId}`);
      return;
    }
    if (res.status === 409 && "units" in res.body) {
      setUnits(res.body.units);
      setNeedsUnit(true);
      setPantalla("unit");
      return;
    }
    setError("error" in res.body ? res.body.error : "No se ha podido valorar");
  }

  function irCampo(key: string) {
    const dest = screenForField(key);
    setPantalla(dest);
  }

  const titulos: Record<WizardScreenId, { title: string; hint: string }> = {
    address: {
      title: channel === "crm" ? "¿Qué inmueble valoramos?" : "¿Dónde está tu vivienda?",
      hint: "Dirección, referencia catastral o un punto en el mapa.",
    },
    unit: {
      title: "¿Cuál es tu vivienda?",
      hint: "Elige la unidad en la parcela; no adivinamos.",
    },
    building: {
      title: channel === "crm" ? "Datos del inmueble" : "Hemos encontrado tu vivienda",
      hint:
        channel === "crm"
          ? "Lo que viene de Catastro ya está puesto y marcado; corrige lo que haga falta. Con tipo y superficie basta para continuar."
          : "Confirma y completa; con tipo y superficie basta para continuar.",
    },
    state: {
      title: "Estado y distribución",
      hint: "Si no sabes algo, márcalo con «No lo sé»: la precisión lo refleja y nada se bloquea.",
    },
    about: { title: "Sobre ti", hint: "Nos ayuda a adaptar el informe. Sin compromiso." },
    email: {
      title: "Tu valoración está lista",
      hint: "Déjanos tu email para verla y recibir el informe.",
    },
    valorar: { title: "Lista para valorar", hint: "Revisa el resumen y pulsa Valorar." },
  };

  const navLabel = pantalla === "email" ? "Ver mi valoración" : pantalla === "valorar" ? "Valorar" : "Continuar";

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
              <span>
                Paso {stepIndex + 1} de {screens.length} · {stepMeta?.label ?? ""}
              </span>
            </div>

            <h2 className="text-[22px] font-semibold tracking-[-0.02em]">{titulos[pantalla].title}</h2>
            <p className="mb-5 mt-1 text-[14px] text-[var(--text-3)]">{titulos[pantalla].hint}</p>

            {pantalla === "address" ? (
              <Entrada
                channel={channel}
                tab={entryTab}
                setTab={setEntryTabSafe}
                consulta={consulta}
                setConsulta={setConsulta}
                sugerencias={sugerencias}
                elegida={elegida}
                onElegirDireccion={(s) => {
                  setConsulta(s.address);
                  setElegida(s);
                  setPinMapa({ lat: s.lat, lng: s.lng, label: CENTRO_AGENCIA.label });
                }}
                onLimpiarElegida={() => setElegida(null)}
                referencia={referencia}
                setReferencia={setReferencia}
                refTipo={tipoReferencia(referencia)}
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
                onContinuarDireccion={(s) => {
                  void cargar(
                    {
                      carto: {
                        address: s.address,
                        lat: s.lat,
                        lng: s.lng,
                        postcode: s.postcode,
                        municipality: s.municipality,
                        province: s.province,
                        streetType: s.streetType,
                        streetName: s.streetName,
                        streetNumber: s.streetNumber,
                        ...(s.muniCode ? { muniCode: s.muniCode } : {}),
                        ...(s.catastralRef ? { catastralRef: s.catastralRef } : {}),
                      },
                    },
                    "direccion",
                  );
                }}
                onMoverPin={(lat, lng) => {
                  setPinMapa((p) => ({ ...p, lat, lng }));
                  setElegida((e) => (e ? { ...e, lat, lng } : e));
                }}
              />
            ) : null}

            {pantalla === "unit" && units ? (
              <Unidades
                grupos={unidadesAgrupadas(units)}
                filtroPlanta={filtroPlanta}
                setFiltroPlanta={setFiltroPlanta}
                onElegir={(ref) => void cargar({ catastralRef: ref }, "unidad")}
              />
            ) : null}

            {pantalla === "building" && twin && built ? (
              <>
                <PantallaGrupo
                  group="building"
                  twin={twin}
                  unknown={unknown}
                  sources={built.fieldSources}
                  onPatch={patchTwin}
                />
                <QNav label={navLabel} disabled={!puedeContinuar || ocupado} onContinuar={siguiente} extra={<span className="text-[12px] text-[var(--text-3)]">· obligatorio</span>} />
              </>
            ) : null}

            {pantalla === "state" && twin && built ? (
              <>
                <PantallaGrupo group="state" twin={twin} unknown={unknown} sources={built.fieldSources} onPatch={patchTwin} />
                <QNav label={navLabel} disabled={!puedeContinuar || ocupado} onContinuar={siguiente} />
              </>
            ) : null}

            {pantalla === "about" && twin && built ? (
              <>
                <PantallaGrupo group="about" twin={twin} unknown={unknown} sources={built.fieldSources} onPatch={patchTwin} />
                <QNav label="Continuar" disabled={!puedeContinuar} onContinuar={siguiente} />
              </>
            ) : null}

            {pantalla === "email" ? (
              <div className="space-y-4">
                <CampoEntrada label="Correo electrónico">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
                  />
                </CampoEntrada>
                <label className="flex items-start gap-2 text-[13px] text-[var(--text-3)]">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                  Acepto que la agencia me contacte sobre esta valoración.
                </label>
                <QNav label={navLabel} disabled={!puedeContinuar} onContinuar={siguiente} />
              </div>
            ) : null}

            {pantalla === "valorar" && twin ? (
              <div className="space-y-3">
                <p className="text-[14px] text-[var(--text-3)]">
                  {twin.address.formattedAddress ?? "Inmueble listo"} · {confirmados} datos en el resumen
                </p>
                <Button type="button" className="lg:hidden" disabled={ocupado} onClick={() => void terminar()}>
                  Valorar
                </Button>
              </div>
            ) : null}

            {error ? <p className="mt-4 text-[13px] text-red-600">{error}</p> : null}
          </div>
          <p className="mt-3 text-[12px] text-[var(--text-3)]">
            {channel === "crm"
              ? "Dos pantallas de datos. Lo obligatorio lleva punto; en lo demás vale «No lo sé». Enter avanza. Borrador 24 h."
              : "Gratis y sin compromiso. Los datos se rellenan desde Catastro; tú confirmas lo que falta."}
          </p>
        </div>

        <PanelLateralValoracion
          precision={precision}
          estimado={estimado}
          twin={twin}
          confirmados={confirmados}
          conocidos={conocidos}
          onIrCampo={irCampo}
          mediana={mediana}
          listoValorar={listoValorar}
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
        conocidos={conocidos}
        onIrCampo={irCampo}
        mediana={mediana}
        listoValorar={listoValorar}
        ocupado={ocupado}
        onValorar={() => void terminar()}
      />
    </div>
  );
}

function Entrada(props: {
  channel: Channel;
  tab: EntryTab;
  setTab: (t: EntryTab) => void;
  consulta: string;
  setConsulta: (v: string) => void;
  sugerencias: Candidato[];
  elegida: Candidato | null;
  onElegirDireccion: (s: Candidato) => void;
  onLimpiarElegida: () => void;
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
  onContinuarDireccion: (s: Candidato) => void;
  onMoverPin: (lat: number, lng: number) => void;
}) {
  const continuarDireccion = () => {
    if (!props.elegida || props.ocupado) return;
    props.onContinuarDireccion(props.elegida);
  };
  const tabs: { id: EntryTab; label: string }[] = [
    { id: "direccion", label: "Dirección" },
    { id: "referencia", label: "Referencia catastral" },
    { id: "mapa", label: "En el mapa" },
    ...(props.channel === "crm" ? [{ id: "crm" as const, label: "Del CRM" }] : []),
  ];
  const refMsg = mensajeReferencia(props.referencia);
  return (
    <div className="space-y-4">
      <SegControl options={tabs} value={props.tab} onChange={props.setTab} />

      {props.tab === "direccion" ? (
        <div className="mt-2 space-y-2">
          <CampoEntrada label="Dirección" icon="search">
            <input
              value={props.consulta}
              onChange={(e) => {
                const v = e.target.value;
                props.setConsulta(v);
                if (!v.trim()) props.onLimpiarElegida();
                else if (props.elegida && v.trim() !== props.elegida.address) props.onLimpiarElegida();
              }}
              placeholder="Calle, número y municipio"
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
              autoComplete="off"
              onKeyDown={(e) => {
                if (e.key !== "Enter" || props.ocupado) return;
                if (props.elegida) {
                  e.preventDefault();
                  continuarDireccion();
                  return;
                }
                const unica = props.sugerencias.length === 1 ? props.sugerencias[0] : null;
                if (unica) {
                  e.preventDefault();
                  props.onElegirDireccion(unica);
                  props.onContinuarDireccion(unica);
                }
              }}
            />
          </CampoEntrada>
          {!props.elegida ? (
            <div className="flex flex-col gap-1.5">
              {props.sugerencias.slice(0, 8).map((s) => (
                <SugerenciaChip
                  key={`${s.lat}-${s.lng}-${s.address}`}
                  titulo={s.address}
                  subtitulo={[s.municipality, s.province ? `prov. ${s.province}` : null].filter(Boolean).join(" · ")}
                  onClick={() => props.onElegirDireccion(s)}
                />
              ))}
            </div>
          ) : null}
          {props.elegida ? (
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <TagAvm className="text-foreground">{props.elegida.address}</TagAvm>
                <button
                  type="button"
                  className="text-[12px] text-[var(--text-3)] underline underline-offset-2"
                  onClick={() => {
                    props.onLimpiarElegida();
                  }}
                >
                  Cambiar
                </button>
              </div>
              <QNav disabled={props.ocupado || !props.elegida} onContinuar={continuarDireccion} />
              <p className="text-[12px] text-[var(--text-3)]">CartoCiudad · arrastra el marcador si hace falta</p>
              <MapaAvm
                className="h-[220px] w-full overflow-hidden rounded-lg border border-[var(--border)]"
                lat={props.pinMapa.lat}
                lng={props.pinMapa.lng}
                arrastrable
                onMover={props.onMoverPin}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {props.tab === "referencia" ? (
        <div className="mt-2 space-y-2">
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
          <p className={`min-h-4 text-[12px] ${refMsg.clase === "err" ? "text-red-600" : refMsg.clase === "ok" ? "text-emerald-600" : "text-[var(--text-3)]"}`}>
            {refMsg.texto}
          </p>
          <QNav label="Buscar" disabled={!refMsg.ok || props.ocupado} onContinuar={props.onBuscarRef} />
        </div>
      ) : null}

      {props.tab === "mapa" ? (
        <div className="mt-2 space-y-2">
          <MapaAvm
            className="h-[360px] w-full overflow-hidden rounded-lg border border-[var(--border)]"
            lat={props.pinMapa.lat}
            lng={props.pinMapa.lng}
            zoom={13}
            arrastrable
            onMover={(lat, lng) => props.setPinMapa((p) => ({ ...p, lat, lng }))}
          />
          <QNav label="Usar este punto" disabled={props.ocupado} onContinuar={props.onUsarPin} />
        </div>
      ) : null}

      {props.tab === "crm" ? (
        <div className="mt-2 space-y-2">
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
                className="flex w-full gap-3 rounded-lg border border-[var(--border)] px-3 py-2.5 text-left hover:bg-[var(--surface-soft)]"
                onClick={() => props.onElegirCrm(r)}
              >
                <span className="text-[12px] text-[var(--text-3)]">{r.tipo === "inmueble" ? "Inmueble" : "Captación"}</span>
                <span className="flex-1">
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
            className="flex w-full items-center justify-between rounded-lg border border-[var(--border)] px-3.5 py-2.5 text-left hover:bg-[var(--surface-soft)]"
            onClick={() => onElegir(u.catastralRef)}
          >
            <span className="text-[14px]">{etiquetaUnidad(u)}</span>
            <span className="font-mono text-[11px] text-[var(--text-3)]">…{u.catastralRef.slice(-6)}</span>
          </button>
        ))}
      </div>
      {grupos.otros.length ? (
        <details>
          <summary className="cursor-pointer text-[13px] text-[var(--text-3)]">Otros usos · {grupos.otros.length}</summary>
          <div className="mt-2 flex flex-col gap-2">
            {grupos.otros.map((u) => (
              <button key={u.catastralRef} type="button" className="rounded-lg border px-3 py-2 text-left" onClick={() => onElegir(u.catastralRef)}>
                {etiquetaUnidad(u)}
              </button>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
