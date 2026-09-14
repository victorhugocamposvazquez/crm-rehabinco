"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import type { CoberturaCp } from "@/lib/captacion/cobertura";

export default function CoberturaCatastroPage() {
  const [filas, setFilas] = useState<CoberturaCp[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    void fetch("/api/catastro/cobertura")
      .then(async (respuesta) => {
        const json = (await respuesta.json()) as { ok?: boolean; error?: string; cobertura?: CoberturaCp[] };
        if (!respuesta.ok || !json.ok) {
          setError(json.error ?? "No se ha podido leer la cobertura.");
          return;
        }
        setFilas(json.cobertura ?? []);
      })
      .catch(() => setError("No se ha podido leer la cobertura."))
      .finally(() => setCargando(false));
  }, []);

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Catastro", href: "/catastro" }, { label: "Cobertura" }]}
        title="Cobertura"
        description="CPs rastreados en Catastro Explorer. No es un mapa; es el archivo de territorio."
      />
      {error ? <p className="mt-6 text-sm text-red-700">{error}</p> : null}
      <div className="mt-6 overflow-hidden rounded-2xl border border-[#E6E3DD] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#F6F5F1] text-[12px] uppercase tracking-wide text-[#5D6B67]">
            <tr>
              <th className="px-4 py-2">CP</th>
              <th className="px-4 py-2">Municipio</th>
              <th className="px-4 py-2">Calles</th>
              <th className="px-4 py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={fila.postalCode} className="border-t border-[#F2F0EB]">
                <td className="px-4 py-2 font-mono">{fila.postalCode}</td>
                <td className="px-4 py-2">
                  {fila.municipio}
                  {fila.provincia ? `, ${fila.provincia}` : ""}
                </td>
                <td className="px-4 py-2">
                  {fila.streetsProcessed}/{fila.streetsFound || "—"}
                </td>
                <td className="px-4 py-2">{fila.complete ? "Completo" : "En curso"}</td>
              </tr>
            ))}
            {filas.length === 0 && !error ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[#5D6B67]">
                  {cargando ? "Cargando cobertura…" : "Aún no hay búsquedas por código postal."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
