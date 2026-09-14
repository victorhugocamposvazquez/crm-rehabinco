"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import type { FincaCaptacionApi } from "@/lib/catastro-host/captacion-filas";
import { BandejaCaptacion } from "@/components/captacion/BandejaCaptacion";

export function FincasAsignadasComercial() {
  const [items, setItems] = useState<FincaCaptacionApi[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void fetch("/api/catastro/mine")
      .then(async (respuesta) => {
        const json = (await respuesta.json()) as {
          ok?: boolean;
          error?: string;
          items?: FincaCaptacionApi[];
        };
        if (!vivo) return;
        if (!respuesta.ok || !json.ok) {
          setError(json.error ?? "No se han podido cargar tus fincas.");
          setItems([]);
          return;
        }
        setItems(json.items ?? []);
      })
      .catch(() => {
        if (!vivo) return;
        setError("No se han podido cargar tus fincas.");
        setItems([]);
      });
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Catastro", href: "/catastro" }]}
        title="Tus fincas"
        description="Trabaja las que te ha asignado dirección: estado, próxima acción y alta de propiedad cuando toque."
      />
      {error ? (
        <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}
      {items == null ? (
        <p className="mt-8 text-sm text-[#5D6B67]">Cargando tus fincas…</p>
      ) : items.length === 0 && !error ? (
        <p className="mt-8 rounded-2xl border border-[#E6E3DD] bg-white px-5 py-10 text-center text-sm text-[#5D6B67]">
          Aún no te han asignado fincas. Cuando dirección te asigne alguna, saldrá aquí.
        </p>
      ) : items.length > 0 ? (
        <div className="mt-8">
          <BandejaCaptacion items={items} />
        </div>
      ) : null}
    </div>
  );
}
