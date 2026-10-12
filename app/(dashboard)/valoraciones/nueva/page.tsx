"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { ValoracionesNav } from "@/components/avm/ValoracionesNav";
import { MapaValoracion } from "@/components/avm/MapaValoracion";
import { candidatosDireccion, construirGemelo, valorarInmueble } from "@/lib/actions/avm-valuar";
import { confirmedCount, resolveFlow } from "@/lib/avm/flow";
import { computeLiveEstimate, computePrecision } from "@/lib/avm/estimate";
import { etiquetaUnidad, unidadesAgrupadas } from "@/lib/avm/ui/unidades";
import { normalizarReferencia, tipoReferencia } from "@/lib/avm/ui/referencia";
import { createClient } from "@/lib/supabase/client";
import type { Twin } from "@/lib/avm/types";
import type { TwinUnit } from "@/lib/avm/twin-builder";

type Gemelo = Awaited<ReturnType<typeof construirGemelo>>;
type Ok = Extract<Gemelo, { ok: true }>;

export default function NuevaValoracionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromId = searchParams.get("from");
  const [consulta, setConsulta] = useState("");
  const [sugerencias, setSugerencias] = useState<{ address: string; lat: number; lng: number }[]>([]);
  const [referencia, setReferencia] = useState("");
  const [ayudaRef, setAyudaRef] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [built, setBuilt] = useState<Ok | null>(null);
  const [units, setUnits] = useState<TwinUnit[] | null>(null);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [mediana, setMediana] = useState<{ median: number; n: number; trend: number | null } | null>(null);
  const [corrigiendo, setCorrigiendo] = useState<string | null>(null);
  const [vistos, setVistos] = useState<string[]>([]);

  const twin = built?.twin ?? null;
  const prefilled = useMemo(() => new Set((built?.prefilledFields ?? []) as (keyof Twin)[]), [built]);
  const flujo = twin ? resolveFlow(twin, "crm", prefilled) : [];
  const paso = twin && !units
    ? flujo.find((s) => s.fields.length > 0 && !vistos.includes(s.id) && (corrigiendo === s.id || s.prefilled || s.fields.some((f) => twin[f] == null || twin[f] === undefined))) ?? null
    : null;
  const confirmados = twin ? confirmedCount(twin, "crm", prefilled) : 0;
  const precision = twin ? computePrecision(twin) : 0;
  const estimado = twin ? computeLiveEstimate(twin, mediana?.median ?? null) : null;

  useEffect(() => {
    if (!fromId || built) return;
    const supabase = createClient();
    void supabase
      .from("avm_valuations")
      .select("inputs, method_version")
      .eq("id", fromId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data?.inputs) return;
        const inputs = data.inputs as {
          twin?: Twin;
          fieldSources?: Ok["fieldSources"];
          prefilledFields?: string[];
        };
        if (!inputs.twin) return;
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
        setVistos([]);
        setCorrigiendo(null);
      });
  }, [fromId, built]);

  useEffect(() => {
    if (!twin?.address.lat || !twin.address.lng) return;
    const supabase = createClient();
    void supabase.rpc("avm_zone_median", {
      p_lat: twin.address.lat,
      p_lng: twin.address.lng,
      p_main_type: twin.mainType ?? "apartment",
      p_operation: "sale",
    }).then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.median_ppm2) return;
      setMediana({
        median: Number(row.median_ppm2),
        n: Number(row.n),
        trend: row.trend_12m_pct == null ? null : Number(row.trend_12m_pct),
      });
    });
  }, [twin?.address.lat, twin?.address.lng, twin?.mainType]);

  async function buscar(q: string) {
    setConsulta(q);
    if (q.trim().length < 3) {
      setSugerencias([]);
      return;
    }
    setSugerencias(await candidatosDireccion(q));
  }

  async function cargar(input: { address?: string; lat?: number; lng?: number; catastralRef?: string }) {
    setOcupado(true);
    setError(null);
    const res = await construirGemelo(input);
    setOcupado(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (res.warnings.some((w) => /no respondió|no hay caché|no se ha encontrado/i.test(w)) && !res.twin.address.lat && !res.units.length) {
      setError(res.warnings[0] || "La Sede del Catastro no ha encontrado esa referencia.");
      return;
    }
    if (input.catastralRef && tipoReferencia(input.catastralRef) === "inmueble") {
      setUnits(null);
    } else if (res.units.length > 1) {
      setUnits(res.units);
    } else {
      setUnits(null);
    }
    setBuilt(res);
    setCorrigiendo(null);
    setVistos([]);
  }

  function aplicar(patch: Partial<Twin>, pasoId?: string) {
    if (!built) return;
    const campos = Object.keys(patch) as (keyof Twin)[];
    setBuilt({
      ...built,
      twin: { ...built.twin, ...patch },
      prefilledFields: built.prefilledFields.filter((f) => !campos.includes(f as keyof Twin)),
    });
    setCorrigiendo(null);
    if (pasoId) setVistos((ids) => (ids.includes(pasoId) ? ids : [...ids, pasoId]));
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
      router.push(`/valoraciones/${res.body.valuationId}`);
      return;
    }
    if (res.status === 409 && "units" in res.body) {
      setUnits(res.body.units);
      return;
    }
    setError("error" in res.body ? res.body.error : "No se ha podido valorar");
  }

  const grupos = units ? unidadesAgrupadas(units) : null;
  const refTipo = tipoReferencia(referencia);

  return (
    <div>
      <PageHeader title="Nueva valoración" breadcrumb={[{ label: "Valoraciones", href: "/valoraciones" }, { label: "Nueva" }]} />
      <ValoracionesNav actual="/valoraciones/nueva" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-6">
          {!built || units ? (
            <section className="space-y-4">
              <label className="block text-[13px]">
                Dirección
                <input value={consulta} onChange={(e) => void buscar(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2" placeholder="Calle, número, municipio" />
              </label>
              {sugerencias.length ? (
                <ul className="rounded-lg border border-[var(--border)]">
                  {sugerencias.map((s) => (
                    <li key={`${s.lat}-${s.lng}`}>
                      <button type="button" className="w-full px-3 py-2 text-left text-[14px] hover:bg-[var(--surface-soft)]" onClick={() => void cargar({ address: s.address })}>
                        {s.address}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div>
                <label className="block text-[13px]">
                  Referencia catastral
                  <input value={referencia} onChange={(e) => setReferencia(e.target.value.toUpperCase())} className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 font-mono" placeholder="20 caracteres, o 14 de la parcela" />
                </label>
                <button type="button" className="mt-1 text-[12px] text-[var(--text-2)] underline" onClick={() => setAyudaRef((v) => !v)}>¿Dónde la encuentro?</button>
                {ayudaRef ? <p className="mt-1 text-[12px] text-[var(--text-3)]">En el recibo del IBI, la escritura, la nota simple o la Sede del Catastro.</p> : null}
                <Button type="button" className="mt-2" size="sm" disabled={!refTipo || ocupado} onClick={() => void cargar({ catastralRef: normalizarReferencia(referencia) })}>
                  Buscar referencia
                </Button>
                {referencia && !refTipo ? <p className="mt-1 text-[12px] text-red-600">Tiene que tener 14 o 20 caracteres, sin espacios.</p> : null}
              </div>

              <div>
                <p className="text-[13px]">¿No aparece? Marca el punto en el mapa</p>
                <div className="mt-2">
                  <MapaValoracion
                    lat={pin?.lat ?? 43.371}
                    lng={pin?.lng ?? -8.396}
                    arrastrable
                    onMover={(lat, lng) => setPin({ lat, lng })}
                  />
                </div>
                <Button type="button" className="mt-2" size="sm" variant="secondary" disabled={!pin || ocupado} onClick={() => pin && void cargar({ lat: pin.lat, lng: pin.lng })}>
                  Usar este punto
                </Button>
              </div>
            </section>
          ) : null}

          {grupos ? (
            <section>
              <h2 className="text-[16px] font-medium">Elige la unidad</h2>
              <Lista titulo="Viviendas" items={grupos.viviendas} onElegir={(ref) => void cargar({ catastralRef: ref })} />
              {grupos.otros.length ? <Lista titulo="Otros usos" items={grupos.otros} onElegir={(ref) => void cargar({ catastralRef: ref })} /> : null}
            </section>
          ) : null}

          {twin && !units && paso ? (
            <section className="space-y-3">
              <p className="text-[12px] text-[var(--text-3)]">{confirmados} detalles confirmados</p>
              {paso.prefilled && corrigiendo !== paso.id ? (
                <div>
                  <p className="text-[15px]">{paso.title}</p>
                  <p className="text-[13px] text-[var(--text-2)]">Confirmado desde Catastro</p>
                  <Button type="button" size="sm" className="mt-2" onClick={() => setVistos((ids) => [...ids, paso.id])}>Continuar</Button>
                  <Button type="button" size="sm" variant="secondary" className="ml-2 mt-2" onClick={() => setCorrigiendo(paso.id)}>Corregir</Button>
                </div>
              ) : (
                <Pregunta pasoId={paso.id} title={paso.title} hint={paso.hint} twin={twin} onListo={(patch) => aplicar(patch, paso.id)} />
              )}
            </section>
          ) : null}

          {twin && !units && !paso ? (
            <Button type="button" disabled={ocupado} onClick={() => void terminar()}>{ocupado ? "Valorando…" : "Valorar"}</Button>
          ) : null}
          {error ? <p className="text-[13px] text-red-600">{error}</p> : null}
        </div>

        <aside className="space-y-3 rounded-xl border border-[var(--border)] p-4">
          <p className="text-[12px] text-[var(--text-3)]">Precisión {precision} %</p>
          {estimado ? <p className="text-[20px] font-medium tabular-nums">{estimado.mid.toLocaleString("es-ES")} €</p> : <p className="text-[13px] text-[var(--text-3)]">La estimación aparece al tener coordenadas.</p>}
          <div className="text-[13px]">
            <p className="font-medium">Tu zona</p>
            {mediana ? (
              <p>{mediana.median.toLocaleString("es-ES")} €/m² · {mediana.n} anuncios{mediana.trend != null ? ` · ${mediana.trend} %` : ""}</p>
            ) : (
              <p className="text-[var(--text-3)]">Aún sin mediana.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Lista({ titulo, items, onElegir }: { titulo: string; items: TwinUnit[]; onElegir: (ref: string) => void }) {
  return (
    <div className="mt-3">
      <p className="text-[12px] uppercase tracking-wide text-[var(--text-3)]">{titulo}</p>
      <ul className="mt-1 divide-y divide-[var(--border)]">
        {items.map((u) => (
          <li key={u.catastralRef}>
            <button type="button" className="w-full py-2 text-left text-[14px]" onClick={() => onElegir(u.catastralRef)}>{etiquetaUnidad(u)}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Pregunta({ pasoId, title, hint, twin, onListo }: { pasoId: string; title: string; hint: string; twin: Twin; onListo: (p: Partial<Twin>) => void }) {
  const [texto, setTexto] = useState("");
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(texto);
        if (pasoId === "surface") onListo({ builtSurface: n });
        else if (pasoId === "constructionYear") onListo({ constructionYear: n });
        else if (pasoId === "condition") onListo({ buildingCondition: Math.min(5, Math.max(1, n)) as 1 | 2 | 3 | 4 | 5 });
        else if (pasoId === "floors") onListo({ floorOfFlat: n, numberOfFloors: twin.numberOfFloors });
        else if (pasoId === "side") onListo({ side: texto === "interior" ? "interior" : "exterior" });
        else if (pasoId === "renovated" || pasoId === "hasBalcony") onListo(pasoId === "renovated" ? { isRenovated: texto === "si" } : { hasBalcony: texto === "si" });
        else onListo({});
      }}
    >
      <h2 className="text-[18px] font-medium">{title}</h2>
      <p className="text-[13px] text-[var(--text-2)]">{hint}</p>
      {pasoId === "side" || pasoId === "renovated" || pasoId === "hasBalcony" ? (
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={() => onListo(pasoId === "side" ? { side: "exterior" } : pasoId === "renovated" ? { isRenovated: true } : { hasBalcony: true })}>Sí / Exterior</Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => onListo(pasoId === "side" ? { side: "interior" } : pasoId === "renovated" ? { isRenovated: false } : { hasBalcony: false })}>No / Interior</Button>
        </div>
      ) : (
        <>
          <input value={texto} onChange={(e) => setTexto(e.target.value)} className="w-full rounded-lg border border-[var(--border)] px-3 py-2" inputMode="decimal" />
          <Button type="submit" size="sm">Continuar</Button>
        </>
      )}
    </form>
  );
}
