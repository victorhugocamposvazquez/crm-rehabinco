"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { valorarInmueble } from "@/lib/actions/avm-valuar";
import { etiquetaUnidad, unidadesAgrupadas } from "@/lib/avm/ui/unidades";
import type { TwinUnit } from "@/lib/avm/twin-builder";

type Props = {
  crmPropertyId?: string;
  listingId?: string;
  catastralRef?: string | null;
  address?: string | null;
  className?: string;
};

export function BotonValorar({ crmPropertyId, listingId, catastralRef, address, className }: Props) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [units, setUnits] = useState<TwinUnit[] | null>(null);

  async function pedir(extra: { catastralRef?: string } = {}) {
    setOcupado(true);
    setError(null);
    const ref = (extra.catastralRef ?? catastralRef ?? "").replace(/\s/g, "");
    const body = {
      input: {
        crmPropertyId,
        listingId,
        ...(ref ? { catastralRef: ref } : address ? { address } : {}),
      },
      channel: "crm" as const,
    };
    const res = await valorarInmueble(body);
    setOcupado(false);
    if (res.status === 409 && "units" in res.body) {
      setUnits(res.body.units);
      return;
    }
    if (res.status === 200 && "valuationId" in res.body) {
      router.push(`/valoraciones/${res.body.valuationId}`);
      return;
    }
    setError("error" in res.body ? res.body.error : "No se ha podido valorar");
  }

  const grupos = units ? unidadesAgrupadas(units) : null;

  return (
    <>
      <Button type="button" variant="secondary" size="sm" className={className} disabled={ocupado} onClick={() => void pedir()}>
        {ocupado ? "Valorando…" : "Valorar"}
      </Button>
      {error ? <p className="mt-2 text-[12px] text-red-600">{error}</p> : null}
      {grupos ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-label="Elige la unidad">
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-xl bg-[var(--surface)] p-4">
            <h2 className="text-[16px] font-medium">¿Qué unidad es?</h2>
            <Lista titulo="Viviendas" items={grupos.viviendas} onElegir={(ref) => void pedir({ catastralRef: ref })} />
            {grupos.otros.length ? <Lista titulo="Otros usos" items={grupos.otros} onElegir={(ref) => void pedir({ catastralRef: ref })} /> : null}
            <button type="button" className="mt-3 text-[13px] text-[var(--text-3)]" onClick={() => setUnits(null)}>Cancelar</button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Lista({ titulo, items, onElegir }: { titulo: string; items: TwinUnit[]; onElegir: (ref: string) => void }) {
  if (!items.length) return null;
  return (
    <div className="mt-3">
      <p className="text-[12px] text-[var(--text-3)]">{titulo}</p>
      <ul className="mt-1 divide-y divide-[var(--border)]">
        {items.map((u) => (
          <li key={u.catastralRef}>
            <button type="button" className="w-full py-2 text-left text-[14px] hover:bg-[var(--surface-soft)]" onClick={() => onElegir(u.catastralRef)}>
              {etiquetaUnidad(u)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
