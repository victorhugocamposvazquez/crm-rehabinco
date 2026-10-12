"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { ValoracionesNav } from "@/components/avm/ValoracionesNav";
import { useAuth } from "@/lib/auth/auth-context";
import { isAdmin } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_ADJUSTMENTS } from "@/lib/avm/comparables";
import { PENALTIES } from "@/lib/avm/confidence";
import { PRECISION_WEIGHTS } from "@/lib/avm/estimate";

type Stats = {
  listings: { portal: string; operation: string; active: number; clusters: number }[];
  municipalities: { portal: string; municipalities: number; lastRun: string | null }[];
  historyMonths: number;
  zonesWithMedian: number;
  censusSections: number;
  postcodePolygons: number;
  inspireMunicipalities: number;
  catastroCache: number;
  valuations: number;
  confidenceBands: { baja: number; media: number; alta: number };
  layers: Record<string, Record<string, number>>;
  environmentLayers: { layer: string; source: string; category: string | null; n: number; loaded_at: string }[];
  closes: number;
  medianAbsError: number | null;
};

export default function MetodologiaPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const permitido = isAdmin(user?.role);

  useEffect(() => {
    if (!permitido) return;
    const supabase = createClient();
    void supabase.rpc("avm_method_stats", { p_empty: false }).then(({ data }) => {
      if (data) setStats(data as Stats);
    });
  }, [permitido]);

  if (!permitido) {
    return (
      <div>
        <PageHeader title="Cómo valoramos" />
        <p className="text-[14px] text-[var(--text-2)]">Esta página es de quien ve los ajustes de la agencia.</p>
      </div>
    );
  }

  return (
    <div className="metodologia">
      <style>{`@media print { .no-print { display: none !important } body { background: white } }`}</style>
      <div className="no-print">
        <PageHeader
          title="Cómo valoramos"
          actions={<Button type="button" size="sm" variant="secondary" onClick={() => window.print()}>Exportar PDF</Button>}
        />
        <ValoracionesNav actual="/valoraciones/metodologia" />
      </div>
      <article className="space-y-8 text-[14px]">
        <p>El valor de cierre sale de los anuncios cercanos, ajustados al inmueble y descontados de oferta a cierre. El alquiler usa sus propios comparables cuando hay al menos seis a menos de 1.500 m.</p>
        <Seccion titulo="Mercado cargado">
          {stats ? (
            <>
              <Tabla
                columnas={["Portal", "Operación", "Anuncios", "Clústeres"]}
                filas={stats.listings.map((l) => [l.portal, l.operation, String(l.active), String(l.clusters)])}
              />
              <Tabla
                columnas={["Portal", "Municipios", "Última pasada"]}
                filas={stats.municipalities.map((m) => [m.portal, String(m.municipalities), m.lastRun ? new Date(m.lastRun).toLocaleString("es-ES") : "—"])}
              />
              <p>{stats.historyMonths} meses de histórico · {stats.zonesWithMedian} zonas con mediana · {stats.censusSections} secciones censales · {stats.postcodePolygons} polígonos de CP · {stats.inspireMunicipalities} municipios INSPIRE · {stats.catastroCache} entradas en caché de Catastro.</p>
            </>
          ) : <p>Cargando cifras…</p>}
        </Seccion>
        <Seccion titulo="Valoraciones de la agencia">
          {stats ? (
            <>
              <p>{stats.valuations} valoraciones. Confianza: {stats.confidenceBands.baja} baja, {stats.confidenceBands.media} media, {stats.confidenceBands.alta} alta.</p>
              <Tabla
                columnas={["Capa", "Principal", "Respaldo", "Degradada", "Sin dato"]}
                filas={Object.entries(stats.layers).map(([capa, estados]) => [capa, pct(estados.primary), pct(estados.fallback), pct(estados.degraded), pct(estados.missing)])}
              />
              <p>{stats.closes} filas en el descuento de cierre.{stats.closes >= 20 && stats.medianAbsError != null ? ` Error mediano absoluto ${stats.medianAbsError} %.` : " El error frente a cierres posteriores se publica a partir de 20."}</p>
            </>
          ) : null}
        </Seccion>
        <Seccion titulo="Entorno · capas públicas" id="entorno-capas">
          {stats?.environmentLayers?.length ? (
            <>
              <p className="text-[var(--text-2)]">
                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[12px] font-medium text-emerald-700 dark:text-emerald-400">
                  activa
                </span>{" "}
                Indicadores objetivos (OSM, transporte, ruido, inundabilidad…). No cambian el precio ni la confianza.
              </p>
              <Tabla
                columnas={["Capa", "Fuente", "Categoría", "Elementos", "Cargado"]}
                filas={stats.environmentLayers.map((e) => [
                  e.layer,
                  e.source,
                  e.category ?? "—",
                  String(e.n),
                  e.loaded_at ? new Date(e.loaded_at).toLocaleString("es-ES") : "—",
                ])}
              />
            </>
          ) : (
            <p className="text-[var(--text-3)]">
              Sin capas cargadas. Ejecuta los scripts en <code className="text-[12px]">scripts/env-load/</code> (ver README).
            </p>
          )}
        </Seccion>
        <Seccion titulo="Ajustes">
          <Tabla
            columnas={["Ajuste", "Factor"]}
            filas={[
              ["Elasticidad de superficie", String(DEFAULT_ADJUSTMENTS.sizeElasticity)],
              ["Planta con ascensor", String(DEFAULT_ADJUSTMENTS.floorWithElevatorPerFloor)],
              ["Planta sin ascensor", String(DEFAULT_ADJUSTMENTS.floorNoElevatorPerFloor)],
              ["Bajo", String(DEFAULT_ADJUSTMENTS.groundFloor)],
              ["Exterior frente a interior", String(DEFAULT_ADJUSTMENTS.exteriorVsInterior)],
              ["Garaje", String(DEFAULT_ADJUSTMENTS.garage)],
              ["Terraza", String(DEFAULT_ADJUSTMENTS.terrace)],
              ["Reforma reciente", String(DEFAULT_ADJUSTMENTS.renovatedRecent)],
              ...Object.entries(DEFAULT_ADJUSTMENTS.condition).map(([k, v]) => [`Estado ${k}`, String(v)]),
            ]}
          />
        </Seccion>
        <Seccion titulo="Penalizaciones de confianza">
          <Tabla
            columnas={["Capa", "Respaldo", "Degradada", "Sin dato"]}
            filas={Object.entries(PENALTIES).map(([capa, puntos]) => [capa, String(puntos.fallback ?? 0), String(puntos.degraded ?? 0), String(puntos.missing ?? 0)])}
          />
        </Seccion>
        <Seccion titulo="Peso de la precisión">
          <Tabla columnas={["Campo", "Peso"]} filas={PRECISION_WEIGHTS.map((p) => [String(p.key), String(p.weight)])} />
        </Seccion>
      </article>
    </div>
  );
}

function pct(n: number | undefined): string {
  return n == null ? "0 %" : `${n} %`;
}

function Seccion({ titulo, id, children }: { titulo: string; id?: string; children: ReactNode }) {
  return (
    <section id={id}>
      <h2 className="mb-2 text-[18px] font-medium">{titulo}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Tabla({ columnas, filas }: { columnas: string[]; filas: string[][] }) {
  return (
    <table className="w-full text-left text-[13px]">
      <thead>
        <tr>{columnas.map((c) => <th key={c} className="py-1 pr-3 font-medium text-[var(--text-3)]">{c}</th>)}</tr>
      </thead>
      <tbody>
        {filas.map((fila, i) => (
          <tr key={i} className="border-t border-[var(--border)]">
            {fila.map((celda, j) => <td key={j} className="py-1 pr-3">{celda}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
