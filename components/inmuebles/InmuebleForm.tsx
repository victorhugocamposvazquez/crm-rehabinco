"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus } from "lucide-react";
import { ClienteQuickSheet } from "@/components/clientes/ClienteQuickSheet";
import {
  ESTADOS_INMUEBLE,
  ESTADO_INMUEBLE_LABEL,
  TIPOS_INMUEBLE,
  TIPOS_OPERACION,
  TIPO_INMUEBLE_LABEL,
  TIPO_OPERACION_LABEL,
  type InmuebleFormValues,
} from "@/lib/inmuebles/catalogo";

export function InmuebleForm({
  values,
  onChange,
  clientes,
  onClienteCreado,
  cancelHref,
  saving,
  error,
  submitLabel,
  onSubmit,
}: {
  values: InmuebleFormValues;
  onChange: (patch: Partial<InmuebleFormValues>) => void;
  clientes: Array<{ id: string; nombre: string }>;
  onClienteCreado: (cliente: { id: string; nombre: string }) => void;
  cancelHref: string;
  saving: boolean;
  error: string | null;
  submitLabel: string;
  onSubmit: () => void;
}) {
  const [showQuickClient, setShowQuickClient] = useState(false);
  const set = (patch: Partial<InmuebleFormValues>) => onChange(patch);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="space-y-8"
    >
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-neutral-400">Captación</h2>
        <div className="space-y-2">
          <Label>Propietario (ofertante) *</Label>
          <select
            value={values.ofertante_id}
            onChange={(e) => set({ ofertante_id: e.target.value })}
            required
            className="flex h-10 w-full rounded-lg border border-border bg-white px-4 text-base"
          >
            <option value="">Selecciona un cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowQuickClient(true)}
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-foreground hover:underline"
          >
            <UserPlus className="h-3.5 w-3.5" strokeWidth={1.5} />
            Crear cliente desde aquí
          </button>
          <ClienteQuickSheet
            open={showQuickClient}
            onOpenChange={setShowQuickClient}
            onSuccess={(cliente) => {
              onClienteCreado(cliente);
              set({ ofertante_id: cliente.id });
            }}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo de inmueble</Label>
            <select
              value={values.tipo_inmueble}
              onChange={(e) => set({ tipo_inmueble: e.target.value })}
              className="flex h-10 w-full rounded-lg border border-border bg-white px-4 text-base"
            >
              {TIPOS_INMUEBLE.map((t) => (
                <option key={t} value={t}>
                  {TIPO_INMUEBLE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Operación</Label>
            <select
              value={values.tipo_operacion}
              onChange={(e) => set({ tipo_operacion: e.target.value as InmuebleFormValues["tipo_operacion"] })}
              className="flex h-10 w-full rounded-lg border border-border bg-white px-4 text-base"
            >
              {TIPOS_OPERACION.map((t) => (
                <option key={t} value={t}>
                  {TIPO_OPERACION_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Título</Label>
          <Input
            placeholder="Piso 3 hab. reforma, Oleiros"
            value={values.titulo}
            onChange={(e) => set({ titulo: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Tipología (libre)</Label>
          <Input
            placeholder="Dúplex, a reformar, esquina…"
            value={values.tipologia}
            onChange={(e) => set({ tipologia: e.target.value })}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-neutral-400">Ubicación</h2>
        <div className="space-y-2">
          <Label>Dirección</Label>
          <Input
            placeholder="Calle, número, piso"
            value={values.direccion}
            onChange={(e) => set({ direccion: e.target.value })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Código postal</Label>
            <Input value={values.codigo_postal} onChange={(e) => set({ codigo_postal: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Localidad / zona</Label>
            <Input
              placeholder="Oleiros"
              value={values.localidad}
              onChange={(e) => set({ localidad: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Referencia catastral</Label>
          <Input
            placeholder="14 caracteres"
            value={values.referencia_catastral}
            onChange={(e) => set({ referencia_catastral: e.target.value })}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-neutral-400">Características</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Habitaciones</Label>
            <Input type="number" min="0" value={values.habitaciones} onChange={(e) => set({ habitaciones: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Baños</Label>
            <Input type="number" min="0" value={values.banos} onChange={(e) => set({ banos: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Aseos</Label>
            <Input type="number" min="0" value={values.aseos} onChange={(e) => set({ aseos: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Planta</Label>
            <Input placeholder="3ª, bajo, ático" value={values.planta} onChange={(e) => set({ planta: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Año</Label>
            <Input type="number" min="1800" max="2100" value={values.anio_construccion} onChange={(e) => set({ anio_construccion: e.target.value })} />
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={values.ascensor}
              onChange={(e) => set({ ascensor: e.target.checked })}
              className="h-4 w-4 rounded border-border"
            />
            Ascensor
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>m² útiles</Label>
            <Input type="number" min="0" step="0.01" value={values.superficie_util} onChange={(e) => set({ superficie_util: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>m² construidos</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={values.superficie_construida || values.superficie_m2}
              onChange={(e) => set({ superficie_construida: e.target.value, superficie_m2: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>m² parcela</Label>
            <Input type="number" min="0" step="0.01" value={values.superficie_parcela} onChange={(e) => set({ superficie_parcela: e.target.value })} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-neutral-400">Precio y estado</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {(values.tipo_operacion === "venta" || values.tipo_operacion === "ambos") && (
            <div className="space-y-2">
              <Label>Precio venta (€)</Label>
              <Input type="number" min="0" step="0.01" value={values.precio_venta} onChange={(e) => set({ precio_venta: e.target.value })} />
            </div>
          )}
          {(values.tipo_operacion === "alquiler" || values.tipo_operacion === "ambos") && (
            <div className="space-y-2">
              <Label>Precio alquiler (€/mes)</Label>
              <Input type="number" min="0" step="0.01" value={values.precio_alquiler} onChange={(e) => set({ precio_alquiler: e.target.value })} />
            </div>
          )}
          <div className="space-y-2">
            <Label>Estado</Label>
            <select
              value={values.estado}
              onChange={(e) => set({ estado: e.target.value as InmuebleFormValues["estado"] })}
              className="flex h-10 w-full rounded-lg border border-border bg-white px-4 text-base"
            >
              {ESTADOS_INMUEBLE.map((e) => (
                <option key={e} value={e}>
                  {ESTADO_INMUEBLE_LABEL[e]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.publicado}
            onChange={(e) => set({ publicado: e.target.checked })}
            className="h-4 w-4 rounded border-border"
          />
          Listo para matching (publicado internamente)
        </label>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-neutral-400">Textos</h2>
        <div className="space-y-2">
          <Label>Descripción (ficha)</Label>
          <textarea
            className="flex min-h-[100px] w-full rounded-lg border border-border bg-white px-4 py-2 text-base"
            placeholder="Texto que verá el comercial al presentar el inmueble."
            value={values.descripcion}
            onChange={(e) => set({ descripcion: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Vídeo (URL YouTube / Vimeo)</Label>
          <Input
            placeholder="https://"
            value={values.video_url}
            onChange={(e) => set({ video_url: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Notas internas</Label>
          <textarea
            className="flex min-h-[72px] w-full rounded-lg border border-border bg-white px-4 py-2 text-base"
            placeholder="Solo equipo"
            value={values.notas}
            onChange={(e) => set({ notas: e.target.value })}
          />
        </div>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2 pt-2">
        <Button type="button" variant="secondary" asChild>
          <Link href={cancelHref}>Cancelar</Link>
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
