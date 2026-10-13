"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { enviarValoracionAPapelera } from "@/lib/actions/avm-papelera";
import { PageHeader } from "@/components/layout/PageHeader";
import { ValoracionesNav } from "@/components/avm/ValoracionesNav";
import { InformeValoracion } from "@/components/avm/InformeValoracion";
import { InformeAcciones } from "@/components/avm/InformeAcciones";
import { hydrateEnvironmentForInforme } from "@/lib/avm/environment-hydrate";
import { createClient } from "@/lib/supabase/client";
import type { Environment, Twin, ValuationResult } from "@/lib/avm/types";
import { subtituloInforme, tituloInforme } from "@/lib/avm/ui/labels";

export default function InformePage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const [confirmar, setConfirmar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [dato, setDato] = useState<{
    result: ValuationResult;
    twin: Twin;
    fieldSources: Record<string, string>;
    creada: string;
    mesesHistorico: number;
    primerMes: string | null;
    entornoCoverage: import("@/lib/avm/entorno-coverage").EntornoCoverage | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("avm_valuations")
      .select("created_at, deleted_at, channel, method_version, operation, value_mid, value_low, value_high, price_per_m2, rent_monthly, gross_yield, confidence, precision_score, sources_used, comparables, zone_stats, environment, explanation, inputs, range_method, rent_source, created_by")
      .eq("id", id)
      .single()
      .then(async ({ data, error: err }) => {
        if (err || !data) {
          setError(err?.message ?? "No está la valoración");
          return;
        }
        if (data.deleted_at) {
          setError("Esta valoración está en la papelera.");
          return;
        }
        const inputs = (data.inputs ?? {}) as { twin?: Twin; fieldSources?: Record<string, string> };
        const twin = inputs.twin ?? ({ address: { formattedAddress: null, lat: null, lng: null, postcode: null, catastralRef: null, countryCode: "es" } } as Twin);
        const zone = data.zone_stats as ValuationResult["zoneStats"];
        let mesesHistorico = 0;
        let primerMes: string | null = null;
        if (zone?.zoneKey && zone.zoneLevel) {
          const { data: meses } = await supabase
            .from("market_zone_stats")
            .select("month")
            .eq("zone_key", zone.zoneKey)
            .eq("zone_level", zone.zoneLevel)
            .eq("operation", data.operation ?? "sale")
            .eq("main_type", twin.mainType ?? "apartment")
            .order("month", { ascending: true });
          if (meses?.length) {
            mesesHistorico = meses.length;
            primerMes = meses[0].month;
          }
        }
        const storedEnvironment = data.environment as Environment | null;
        const hydrated = await hydrateEnvironmentForInforme(supabase, twin, storedEnvironment);
        const environment = hydrated.environment;
        const entornoCoverage = hydrated.coverage;
        const result: ValuationResult = {
          methodVersion: data.method_version,
          operation: data.operation,
          valueMid: Number(data.value_mid),
          valueLow: Number(data.value_low),
          valueHigh: Number(data.value_high),
          pricePerM2: data.price_per_m2 == null ? null : Number(data.price_per_m2),
          rentMonthly: data.rent_monthly == null ? null : Number(data.rent_monthly),
          rentSource: data.rent_source,
          rangeMethod: data.range_method,
          grossYield: data.gross_yield == null ? null : Number(data.gross_yield),
          confidence: data.confidence,
          precisionScore: data.precision_score,
          sourcesUsed: data.sources_used ?? [],
          comparables: data.comparables ?? [],
          zoneStats: zone,
          environment,
          explanation: data.explanation ?? [],
        };
        setDato({
          result,
          twin,
          fieldSources: inputs.fieldSources ?? {},
          creada: new Date(data.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }),
          mesesHistorico,
          primerMes,
          entornoCoverage,
        });
      });
  }, [id]);

  const twin = dato?.twin;

  return (
    <div className="mx-auto max-w-[1240px] pb-16">
      <PageHeader
        title={twin ? tituloInforme(twin) : "Informe"}
        description={dato ? subtituloInforme(dato.twin, dato.creada, dato.result.methodVersion) : undefined}
        actions={
          <div className="hidden items-center gap-2 min-[820px]:flex">
            <InformeAcciones />
            <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={() => setConfirmar(true)}>
              <Trash2 className="h-4 w-4" strokeWidth={1.7} />
              Papelera
            </Button>
          </div>
        }
        className="mb-5"
      />
      <ValoracionesNav actual="" />
      {error ? <p className="text-[13px] text-red-600">{error}</p> : null}
      {dato ? (
        <InformeValoracion
          creada={dato.creada}
          result={dato.result}
          twin={dato.twin}
          fieldSources={dato.fieldSources}
          valuationId={id}
          mesesHistoricoZona={dato.mesesHistorico}
          primerMesZona={dato.primerMes}
          entornoCoverage={dato.entornoCoverage}
        />
      ) : !error ? (
        <p className="text-[13px] text-[var(--text-3)]">Cargando informe…</p>
      ) : null}
      <AlertDialog
        open={confirmar}
        onOpenChange={setConfirmar}
        title="Enviar a la papelera"
        description="Dejará de verse en el listado. Puedes restaurarla desde la papelera."
        confirmLabel="Enviar a la papelera"
        variant="destructive"
        loading={enviando}
        onConfirm={async () => {
          setEnviando(true);
          const result = await enviarValoracionAPapelera(id);
          setEnviando(false);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Enviada a la papelera.");
          window.dispatchEvent(new Event("avm-papelera"));
          router.push("/valoraciones/papelera");
        }}
      />
    </div>
  );
}
