"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PropuestaPresupuesto } from "@/lib/presupuesto-propuesta";
import { Plus, Trash2 } from "lucide-react";

export function DestacadosPdfField({
  propuesta,
  onChange,
}: {
  propuesta: PropuestaPresupuesto;
  onChange: (next: PropuestaPresupuesto) => void;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-border p-4">
      <div>
        <p className="text-sm font-medium">Destacados del PDF</p>
        <p className="mt-1 text-xs text-neutral-500">
          Chips de zona, barra de cifras, tarjetas de régimen especial y avisos. El copiloto los rellena si el Word o el PDF de Design los trae.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label>Chips de portada</Label>
        <Input
          placeholder="TRIBUNA, PREFERENCIA, MARATÓN"
          value={propuesta.chips_portada.join(", ")}
          onChange={(e) =>
            onChange({
              ...propuesta,
              chips_portada: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
            })
          }
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Título de la barra de régimen</Label>
          <Input
            value={propuesta.regimen_titulo}
            onChange={(e) => onChange({ ...propuesta, regimen_titulo: e.target.value })}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Texto destacado</Label>
          <Input
            placeholder="Importe ejecutado fuera de condiciones ordinarias de obra"
            value={propuesta.regimen_destacado}
            onChange={(e) => onChange({ ...propuesta, regimen_destacado: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Importe destacado</Label>
          <Input
            placeholder="200.036,00 €"
            value={propuesta.regimen_importe}
            onChange={(e) => onChange({ ...propuesta, regimen_importe: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Pie de la barra</Label>
          <Input
            placeholder="SOBRE 267.495,00 € TOTALES"
            value={propuesta.regimen_pie}
            onChange={(e) => onChange({ ...propuesta, regimen_pie: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Cifras (%, horas, partidas…)</Label>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1"
            onClick={() =>
              onChange({
                ...propuesta,
                regimen_metricas: [...propuesta.regimen_metricas, { valor: "", etiqueta: "" }],
              })
            }
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            Cifra
          </Button>
        </div>
        {propuesta.regimen_metricas.map((m, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2">
            <Input
              className="w-28"
              placeholder="74,8 %"
              value={m.valor}
              onChange={(e) =>
                onChange({
                  ...propuesta,
                  regimen_metricas: propuesta.regimen_metricas.map((x, idx) =>
                    idx === i ? { ...x, valor: e.target.value } : x
                  ),
                })
              }
            />
            <Input
              className="min-w-[160px] flex-1"
              placeholder="DEL IMPORTE EN RÉGIMEN ESPECIAL"
              value={m.etiqueta}
              onChange={(e) =>
                onChange({
                  ...propuesta,
                  regimen_metricas: propuesta.regimen_metricas.map((x, idx) =>
                    idx === i ? { ...x, etiqueta: e.target.value } : x
                  ),
                })
              }
            />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label="Quitar cifra"
              onClick={() =>
                onChange({
                  ...propuesta,
                  regimen_metricas: propuesta.regimen_metricas.filter((_, idx) => idx !== i),
                })
              }
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Tarjetas de régimen (nocturno, urgencia…)</Label>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1"
            onClick={() =>
              onChange({
                ...propuesta,
                regimenes: [...propuesta.regimenes, { chip: "", titulo: "", texto: "" }],
              })
            }
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            Tarjeta
          </Button>
        </div>
        {propuesta.regimenes.map((r, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex flex-wrap gap-2">
              <Input
                className="w-40"
                placeholder="NOCTURNO"
                value={r.chip}
                onChange={(e) =>
                  onChange({
                    ...propuesta,
                    regimenes: propuesta.regimenes.map((x, idx) =>
                      idx === i ? { ...x, chip: e.target.value } : x
                    ),
                  })
                }
              />
              <Input
                className="min-w-[160px] flex-1"
                placeholder="Trabajo en horario nocturno"
                value={r.titulo}
                onChange={(e) =>
                  onChange({
                    ...propuesta,
                    regimenes: propuesta.regimenes.map((x, idx) =>
                      idx === i ? { ...x, titulo: e.target.value } : x
                    ),
                  })
                }
              />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label="Quitar tarjeta"
                onClick={() =>
                  onChange({ ...propuesta, regimenes: propuesta.regimenes.filter((_, idx) => idx !== i) })
                }
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.5} />
              </Button>
            </div>
            <textarea
              className="flex min-h-[64px] w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
              placeholder="Texto de justificación…"
              value={r.texto}
              onChange={(e) =>
                onChange({
                  ...propuesta,
                  regimenes: propuesta.regimenes.map((x, idx) =>
                    idx === i ? { ...x, texto: e.target.value } : x
                  ),
                })
              }
            />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Factores de valoración (filete azul)</Label>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1"
            onClick={() =>
              onChange({
                ...propuesta,
                factores_valoracion: [...propuesta.factores_valoracion, { titulo: "", texto: "" }],
              })
            }
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            Factor
          </Button>
        </div>
        {propuesta.factores_valoracion.map((f, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2">
            <Input
              className="w-44"
              placeholder="RECINTO EN USO"
              value={f.titulo}
              onChange={(e) =>
                onChange({
                  ...propuesta,
                  factores_valoracion: propuesta.factores_valoracion.map((x, idx) =>
                    idx === i ? { ...x, titulo: e.target.value } : x
                  ),
                })
              }
            />
            <Input
              className="min-w-[180px] flex-1"
              placeholder="Protección diaria de acabados…"
              value={f.texto}
              onChange={(e) =>
                onChange({
                  ...propuesta,
                  factores_valoracion: propuesta.factores_valoracion.map((x, idx) =>
                    idx === i ? { ...x, texto: e.target.value } : x
                  ),
                })
              }
            />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label="Quitar factor"
              onClick={() =>
                onChange({
                  ...propuesta,
                  factores_valoracion: propuesta.factores_valoracion.filter((_, idx) => idx !== i),
                })
              }
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
