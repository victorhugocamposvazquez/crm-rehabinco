"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BadgeCatastroExplorer } from "./BadgeCatastroExplorer";
import { CatastroPropertyModal } from "./CatastroPropertyModal";
import { fetchFincaPersistida } from "@/lib/catastro/explorer/history-ui";
import type { FincaBusquedaUi } from "@/lib/catastro/search-ui";

export function CatastroPropertyFicha({
  fincaReference,
  propertyCreatedAt,
}: {
  fincaReference: string;
  propertyCreatedAt?: string | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const [finca, setFinca] = useState<FincaBusquedaUi | null>(null);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abrir = async () => {
    setAbierto(true);
    if (finca) return;
    setCargando(true);
    setError(null);
    try {
      const data = await fetchFincaPersistida(fincaReference);
      setFinca(data.finca);
      setLastSeenAt(data.lastSeenAt ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido cargar la información catastral.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <BadgeCatastroExplorer />
      <Button type="button" variant="secondary" size="sm" onClick={() => void abrir()}>
        Ver información catastral
      </Button>
      {abierto && finca ? (
        <CatastroPropertyModal
          open
          onClose={() => setAbierto(false)}
          finca={finca}
          lastSeenAt={lastSeenAt}
          propertyCreatedAt={propertyCreatedAt}
        />
      ) : null}
      {abierto && !finca ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !cargando && setAbierto(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm text-neutral-600">
              {cargando ? "Cargando información catastral…" : error}
            </p>
            <Button type="button" variant="secondary" size="sm" className="mt-4" onClick={() => setAbierto(false)}>
              Cerrar
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
