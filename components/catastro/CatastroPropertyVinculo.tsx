"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ClienteQuickSheet } from "@/components/clientes/ClienteQuickSheet";
import { createClient } from "@/lib/supabase/client";
import {
  TEXTO_BADGE_VINCULADA,
  etiquetasVinculoPropiedad,
  rutaPropiedadCrm,
  type CatastroPropertyLink,
} from "@/lib/catastro/explorer";
import { crearPropiedadDesdeFincaUi } from "@/lib/catastro/explorer/history-ui";

export function CatastroPropertyVinculo({
  fincaReference,
  links,
  onLinksChange,
  compact = false,
}: {
  fincaReference: string;
  links: CatastroPropertyLink[];
  onLinksChange?: (links: CatastroPropertyLink[]) => void;
  compact?: boolean;
}) {
  const [creando, setCreando] = useState(false);
  const [eligiendo, setEligiendo] = useState(false);
  const [clientes, setClientes] = useState<Array<{ id: string; nombre: string }>>([]);
  const [ofertanteId, setOfertanteId] = useState("");
  const [quickCliente, setQuickCliente] = useState(false);
  const etiquetas = etiquetasVinculoPropiedad(links);
  const principal = links[0];

  useEffect(() => {
    if (!eligiendo) return;
    const supabase = createClient();
    void supabase
      .from("clientes")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => setClientes(data ?? []));
  }, [eligiendo]);

  const crear = async (conOfertante: boolean) => {
    if (creando || links.length > 0) return;
    if (conOfertante && !ofertanteId) {
      toast.error("Selecciona un propietario (ofertante)");
      return;
    }
    setCreando(true);
    try {
      const resultado = await crearPropiedadDesdeFincaUi(fincaReference, conOfertante ? ofertanteId : null);
      onLinksChange?.([resultado.link]);
      setEligiendo(false);
      toast.success(resultado.created ? "Propiedad creada." : "Esta finca ya estaba vinculada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se ha podido crear la propiedad.");
    } finally {
      setCreando(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {etiquetas.badge ? (
        <span className="inline-flex w-fit rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-sky-800">
          {TEXTO_BADGE_VINCULADA}
        </span>
      ) : null}
      {principal ? (
        <Button asChild variant={compact ? "ghost" : "secondary"} size="sm">
          <Link href={rutaPropiedadCrm(principal.propertyId)}>{etiquetas.accion}</Link>
        </Button>
      ) : (
        <Button
          type="button"
          variant={compact ? "ghost" : "secondary"}
          size="sm"
          onClick={() => setEligiendo(true)}
        >
          {etiquetas.accion}
        </Button>
      )}

      {eligiendo && !principal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !creando && setEligiendo(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="ofertante-catastro-title"
          >
            <h2 id="ofertante-catastro-title" className="text-base font-semibold text-foreground">
              Crear propiedad
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              Puedes crear el inmueble ahora y añadir el propietario cuando lo localices. No se inventa un cliente.
            </p>
            <div className="mt-4 space-y-2">
              <Label htmlFor="ofertante-catastro">Propietario (opcional)</Label>
              <select
                id="ofertante-catastro"
                value={ofertanteId}
                onChange={(e) => setOfertanteId(e.target.value)}
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
                onClick={() => setQuickCliente(true)}
                className="text-xs font-medium text-foreground hover:underline"
              >
                Crear cliente desde aquí
              </button>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setEligiendo(false)} disabled={creando}>
                Cancelar
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => void crear(false)} disabled={creando}>
                {creando ? "Creando…" : "Crear sin propietario"}
              </Button>
              <Button type="button" size="sm" onClick={() => void crear(true)} disabled={creando}>
                {creando ? "Creando…" : "Crear propiedad"}
              </Button>
            </div>
            <ClienteQuickSheet
              open={quickCliente}
              onOpenChange={setQuickCliente}
              onSuccess={(cliente) => {
                setClientes((prev) => [...prev, cliente].sort((a, b) => a.nombre.localeCompare(b.nombre)));
                setOfertanteId(cliente.id);
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
