"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseDecimalMientrasEscribe } from "@/lib/decimales-input";
import type { PropuestaPresupuesto } from "@/lib/presupuesto-propuesta";
import { totalesAmpliacion, type LineaImporte } from "@/lib/presupuesto-totales";
import { Plus, Trash2 } from "lucide-react";

export function AmpliacionCampos({
  propuesta,
  lineas,
  porcentajeImpuesto,
  onChange,
}: {
  propuesta: PropuestaPresupuesto;
  lineas: LineaImporte[];
  porcentajeImpuesto: number;
  onChange: (next: PropuestaPresupuesto) => void;
}) {
  if (propuesta.tipo !== "ampliacion") return null;
  const tot = totalesAmpliacion({
    lineas,
    bajas: propuesta.bajas,
    ajusteComercial: propuesta.ajuste_comercial,
    origenTotal: propuesta.origen_total,
    porcentajeImpuesto,
  });
  const euro = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });

  return (
    <div className="space-y-4 rounded-xl border border-border p-4">
      <div>
        <p className="text-sm font-medium">Ampliación sobre un presupuesto cerrado</p>
        <p className="mt-1 text-xs text-neutral-500">
          El incremento neto se calcula una vez (altas − bajas + ajuste) y se pinta en portada y totales.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>N.º presupuesto inicial</Label>
          <Input
            placeholder="ESC-2026-09"
            value={propuesta.origen_numero}
            onChange={(e) => onChange({ ...propuesta, origen_numero: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Oferta inicial cerrada (€)</Label>
          <Input
            type="text"
            inputMode="decimal"
            placeholder="228000"
            value={propuesta.origen_total === 0 ? "" : String(propuesta.origen_total)}
            onChange={(e) =>
              onChange({
                ...propuesta,
                origen_total: parseDecimalMientrasEscribe(e.target.value, { allowNegative: false }),
              })
            }
          />
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Bajas (partidas que se quitan del inicial)</Label>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1"
            onClick={() =>
              onChange({
                ...propuesta,
                bajas: [...propuesta.bajas, { descripcion: "", importe: 0 }],
              })
            }
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            Baja
          </Button>
        </div>
        {propuesta.bajas.map((b, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2">
            <Input
              className="min-w-[180px] flex-1"
              placeholder="Partida 02 · mano de obra de moqueta"
              value={b.descripcion}
              onChange={(e) =>
                onChange({
                  ...propuesta,
                  bajas: propuesta.bajas.map((item, idx) =>
                    idx === i ? { ...item, descripcion: e.target.value } : item
                  ),
                })
              }
            />
            <Input
              className="w-32"
              type="text"
              inputMode="decimal"
              placeholder="12400"
              value={b.importe === 0 ? "" : String(b.importe)}
              onChange={(e) =>
                onChange({
                  ...propuesta,
                  bajas: propuesta.bajas.map((item, idx) =>
                    idx === i
                      ? {
                          ...item,
                          importe: parseDecimalMientrasEscribe(e.target.value, { allowNegative: false }),
                        }
                      : item
                  ),
                })
              }
            />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label="Quitar baja"
              onClick={() =>
                onChange({ ...propuesta, bajas: propuesta.bajas.filter((_, idx) => idx !== i) })
              }
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label>Ajuste comercial (€)</Label>
        <Input
          type="text"
          inputMode="decimal"
          placeholder="-1040"
          value={propuesta.ajuste_comercial === 0 ? "" : String(propuesta.ajuste_comercial)}
          onChange={(e) =>
            onChange({
              ...propuesta,
              ajuste_comercial: parseDecimalMientrasEscribe(e.target.value, { allowNegative: true }),
            })
          }
        />
        <p className="text-xs text-neutral-500">Negativo para mantener la oferta (ej. −1.040 €).</p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={propuesta.mostrar_repercusion}
          onChange={(e) => onChange({ ...propuesta, mostrar_repercusion: e.target.checked })}
        />
        Mostrar bloque de repercusión en el PDF
      </label>
      <div className="rounded-lg bg-neutral-50 px-3 py-2 text-sm">
        <p>
          Altas {euro(tot.altas)} − bajas {euro(tot.bajas)} {tot.ajuste !== 0 ? `+ ajuste ${euro(tot.ajuste)}` : ""} ={" "}
          <strong>incremento neto {euro(tot.incrementoNeto)}</strong>
        </p>
        {propuesta.origen_total > 0 && (
          <p className="mt-1 text-neutral-600">
            Resultante {euro(tot.resultante)} + IVA {euro(tot.ivaResultante)} = {euro(tot.totalResultante)}
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label>Condicionantes de ejecución</Label>
        <textarea
          className="flex min-h-[88px] w-full rounded-lg border border-border bg-white px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Turnos diurnos y nocturnos por la premura…"
          value={propuesta.condicionantes_ejecucion}
          onChange={(e) => onChange({ ...propuesta, condicionantes_ejecucion: e.target.value })}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={propuesta.mostrar_observaciones}
          onChange={(e) => onChange({ ...propuesta, mostrar_observaciones: e.target.checked })}
        />
        Incluir observaciones
      </label>
      {propuesta.mostrar_observaciones && (
        <textarea
          className="flex min-h-[72px] w-full rounded-lg border border-border bg-white px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Mediciones definitivas en obra…"
          value={propuesta.observaciones}
          onChange={(e) => onChange({ ...propuesta, observaciones: e.target.value })}
        />
      )}
    </div>
  );
}
