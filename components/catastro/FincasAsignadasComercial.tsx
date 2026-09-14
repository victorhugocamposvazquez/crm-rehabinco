"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { rutaFincaPersistida } from "@/lib/catastro/explorer/history-ui";
import type { FincaBusquedaUi } from "@/lib/catastro/search-ui";
import { ListaFincasCatastro } from "./ListaFincasCatastro";

export function FincasAsignadasComercial() {
  const [fincas, setFincas] = useState<FincaBusquedaUi[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void fetch("/api/catastro/mine")
      .then(async (respuesta) => {
        const json = (await respuesta.json()) as { ok?: boolean; error?: string; fincas?: FincaBusquedaUi[] };
        if (!vivo) return;
        if (!respuesta.ok || !json.ok) {
          setError(json.error ?? "No se han podido cargar tus fincas.");
          setFincas([]);
          return;
        }
        setFincas(json.fincas ?? []);
      })
      .catch(() => {
        if (!vivo) return;
        setError("No se han podido cargar tus fincas.");
        setFincas([]);
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
        description="Solo aparecen las que te ha asignado un administrador. Desde aquí creas la propiedad y la visita."
      />
      {error ? (
        <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}
      {fincas == null ? (
        <p className="mt-8 text-sm text-[#5D6B67]">Cargando tus fincas…</p>
      ) : fincas.length === 0 && !error ? (
        <p className="mt-8 rounded-2xl border border-[#E6E3DD] bg-white px-5 py-10 text-center text-sm text-[#5D6B67]">
          Aún no te han asignado fincas. Cuando dirección te asigne alguna, saldrá aquí.
        </p>
      ) : fincas.length > 0 ? (
        <div className="mt-8">
          <ListaFincasCatastro fincas={fincas} hrefDe={(finca) => rutaFincaPersistida(finca.fincaReference)} />
        </div>
      ) : null}
    </div>
  );
}
