"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseDecimalMientrasEscribe } from "@/lib/decimales-input";
import { codigoPartida } from "@/lib/presupuesto-propuesta";
import { Plus, Trash2 } from "lucide-react";

export type PartidaBorrador = {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  unidad: string;
  capitulo: string;
  _precioDraft?: string;
  _cantDraft?: string;
};

function nextCapituloTitulo(existentes: string[]) {
  let max = 0;
  for (const t of existentes) {
    const m = t.trim().match(/^(\d+)/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${String(max + 1).padStart(2, "0")} · `;
}

function grupos(lineas: PartidaBorrador[]) {
  const out: { titulo: string; capOrden: number; indices: number[] }[] = [];
  const seen = new Map<string, number>();
  lineas.forEach((l, i) => {
    const key = l.capitulo.trim() || "01 · Actuación";
    const idx = seen.get(key);
    if (idx === undefined) {
      seen.set(key, out.length);
      out.push({ titulo: key, capOrden: out.length + 1, indices: [i] });
    } else {
      out[idx].indices.push(i);
    }
  });
  return out;
}

function euro(n: number) {
  return n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

export function GaralPartidasEditor({
  lineas,
  onChange,
}: {
  lineas: PartidaBorrador[];
  onChange: (next: PartidaBorrador[]) => void;
}) {
  const caps = grupos(lineas);

  const patch = (i: number, next: Partial<PartidaBorrador>) =>
    onChange(lineas.map((l, idx) => (idx === i ? { ...l, ...next } : l)));

  const addCapitulo = () => {
    const titulo = nextCapituloTitulo(caps.map((c) => c.titulo));
    onChange([
      ...lineas,
      { descripcion: "", cantidad: 0, precioUnitario: 0, unidad: "ud", capitulo: titulo },
    ]);
  };

  const addPartida = (titulo: string) => {
    onChange([
      ...lineas,
      { descripcion: "", cantidad: 0, precioUnitario: 0, unidad: "ud", capitulo: titulo },
    ]);
  };

  const renameCapitulo = (titulo: string, nuevo: string) => {
    onChange(lineas.map((l) => (l.capitulo.trim() === titulo ? { ...l, capitulo: nuevo } : l)));
  };

  const removeCapitulo = (titulo: string) => {
    const next = lineas.filter((l) => l.capitulo.trim() !== titulo);
    onChange(
      next.length > 0
        ? next
        : [{ descripcion: "", cantidad: 0, precioUnitario: 0, unidad: "ud", capitulo: "01 · Actuación" }]
    );
  };

  const removePartida = (i: number) => {
    if (lineas.length <= 1) return;
    onChange(lineas.filter((_, idx) => idx !== i));
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-neutral-600">
        Igual que en el PDF: el <strong>capítulo</strong> agrupa y cada fila es una{" "}
        <strong>partida</strong> (1.01, 1.02…).
      </p>
      {caps.map((cap) => (
        <div key={cap.indices[0]} className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="space-y-2 border-b border-border bg-neutral-50 px-4 py-3">
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label>Capítulo</Label>
                <Input
                  placeholder="01 · Pavimentos"
                  value={cap.titulo}
                  onChange={(e) => renameCapitulo(cap.titulo, e.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label="Quitar capítulo"
                onClick={() => removeCapitulo(cap.titulo)}
                disabled={caps.length === 1}
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.5} />
              </Button>
            </div>
            <div className="rounded-md bg-[#f3f3f3] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-600">
              {cap.titulo.trim() || "Capítulo"}
            </div>
          </div>

          <div className="divide-y divide-border">
            {cap.indices.map((i, pos) => {
              const l = lineas[i];
              const cod = codigoPartida(cap.titulo, cap.capOrden, pos + 1);
              const importe = Number(l.cantidad) * Number(l.precioUnitario);
              return (
                <div key={i} className="space-y-3 px-4 py-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center rounded-md bg-neutral-900 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                      Partida {cod}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removePartida(i)}
                      disabled={lineas.length === 1}
                      aria-label={`Eliminar partida ${cod}`}
                      className="h-9 w-9 text-neutral-500"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Descripción de la partida</Label>
                    <textarea
                      className="flex min-h-[72px] w-full rounded-lg border border-border bg-white px-4 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Ej. Limpieza, lijado y desoxidado manual de barandilla metálica"
                      value={l.descripcion}
                      onChange={(e) => patch(i, { descripcion: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="space-y-1.5">
                      <Label>Ud</Label>
                      <Input
                        placeholder="m²"
                        value={l.unidad}
                        onChange={(e) => patch(i, { unidad: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Cant.</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="0"
                        value={
                          l._cantDraft !== undefined
                            ? l._cantDraft
                            : l.cantidad === 0
                              ? ""
                              : String(l.cantidad)
                        }
                        onChange={(e) => {
                          const raw = e.target.value;
                          patch(i, {
                            _cantDraft: raw,
                            cantidad: parseDecimalMientrasEscribe(raw, { allowNegative: false }),
                          });
                        }}
                        onBlur={() => {
                          if (l._cantDraft === undefined) return;
                          patch(i, {
                            cantidad: parseDecimalMientrasEscribe(l._cantDraft, { allowNegative: false }),
                            _cantDraft: undefined,
                          });
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Precio</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="0,00"
                        value={
                          l._precioDraft !== undefined
                            ? l._precioDraft
                            : l.precioUnitario === 0
                              ? ""
                              : String(l.precioUnitario)
                        }
                        onChange={(e) => {
                          const raw = e.target.value;
                          patch(i, {
                            _precioDraft: raw,
                            precioUnitario: parseDecimalMientrasEscribe(raw, { allowNegative: false }),
                          });
                        }}
                        onBlur={() => {
                          if (l._precioDraft === undefined) return;
                          patch(i, {
                            precioUnitario: parseDecimalMientrasEscribe(l._precioDraft, {
                              allowNegative: false,
                            }),
                            _precioDraft: undefined,
                          });
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Importe</Label>
                      <div className="flex h-10 items-center rounded-lg border border-border bg-neutral-50 px-3 text-sm font-semibold">
                        {euro(importe)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="border-t border-border px-4 py-3">
            <Button type="button" variant="secondary" size="sm" className="gap-1" onClick={() => addPartida(cap.titulo)}>
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
              Añadir partida
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={addCapitulo} className="gap-2">
        <Plus className="h-4 w-4" strokeWidth={1.5} />
        Añadir capítulo
      </Button>
    </div>
  );
}
