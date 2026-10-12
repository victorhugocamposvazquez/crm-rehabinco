"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { ValoracionesNav } from "@/components/avm/ValoracionesNav";
import { InformeValoracion } from "@/components/avm/InformeValoracion";
import { MapaValoracion } from "@/components/avm/MapaValoracion";
import { createClient } from "@/lib/supabase/client";
import type { Twin, ValuationResult } from "@/lib/avm/types";

export default function InformePage() {
  const params = useParams();
  const id = String(params.id);
  const [dato, setDato] = useState<{ result: ValuationResult; twin: Twin; fieldSources: Record<string, string>; creada: string; comercial: string | null; canal: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("avm_valuations")
      .select("created_at, channel, method_version, operation, value_mid, value_low, value_high, price_per_m2, rent_monthly, gross_yield, confidence, precision_score, sources_used, comparables, zone_stats, environment, explanation, inputs, range_method, rent_source, created_by")
      .eq("id", id)
      .single()
      .then(async ({ data, error: err }) => {
        if (err || !data) {
          setError(err?.message ?? "No está la valoración");
          return;
        }
        const inputs = (data.inputs ?? {}) as { twin?: Twin; fieldSources?: Record<string, string> };
        let comercial: string | null = null;
        if (data.created_by) {
          const { data: perfil } = await supabase.from("profiles").select("nombre_completo").eq("id", data.created_by).maybeSingle();
          comercial = perfil?.nombre_completo ?? null;
        }
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
          zoneStats: data.zone_stats,
          environment: data.environment,
          explanation: data.explanation ?? [],
        };
        setDato({
          result,
          twin: inputs.twin ?? ({ address: { formattedAddress: null, lat: null, lng: null, postcode: null, catastralRef: null } } as Twin),
          fieldSources: inputs.fieldSources ?? {},
          creada: new Date(data.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }),
          comercial,
          canal: data.channel,
        });
      });
  }, [id]);

  return (
    <div>
      <PageHeader
        title="Informe"
        breadcrumb={[{ label: "Valoraciones", href: "/valoraciones" }, { label: "Informe" }]}
        actions={
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="secondary" disabled title="fase 2">Marcar zona</Button>
            <Button type="button" size="sm" variant="secondary" disabled title="fase 2">Informe PDF</Button>
            <Button type="button" size="sm" variant="secondary" disabled title="fase 2">Enviar al propietario</Button>
          </div>
        }
      />
      <ValoracionesNav actual="" />
      {error ? <p className="text-[13px] text-red-600">{error}</p> : null}
      {dato ? (
        <>
          <InformeValoracion creada={dato.creada} result={dato.result} twin={dato.twin} fieldSources={dato.fieldSources} comercial={dato.comercial} canal={dato.canal} />
          {dato.twin.address?.lat != null && dato.twin.address.lng != null ? (
            <div className="mt-6">
              <MapaValoracion lat={dato.twin.address.lat} lng={dato.twin.address.lng} comparables={dato.result.comparables} />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
