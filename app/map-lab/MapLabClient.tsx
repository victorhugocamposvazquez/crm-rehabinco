"use client";

import { AvmMap } from "@/lib/avm/ui/Map";
import type { AdjustedComparable } from "@/lib/avm/types";

export function MapLabClient() {
  const lat = 43.3654271;
  const lng = -8.408791;

  const comps: AdjustedComparable[] = [
    {
      listingId: "1",
      portal: "fotocasa",
      title: "Piso",
      price: 340000,
      surface: 100,
      pricePerM2: 3400,
      rooms: 3,
      floor: 4,
      hasElevator: true,
      hasGarage: true,
      hasTerrace: null,
      isExterior: true,
      conditionHint: null,
      lastSeen: "2026-10-01",
      distanceM: 120,
      radiusM: 300,
      adjustments: {},
      adjustedPpm2: 3400,
      weight: 0.71,
    },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-10 bg-[#0a0a0b] p-6 text-[#f3f3f1]">
      <section id="informe-oscuro">
        <h1 className="mb-2 text-lg font-semibold">Informe · vectorial oscuro</h1>
        <AvmMap lat={lat} lng={lng} comparables={comps} anillos ortofotoToggle />
      </section>
      <section id="informe-ortofoto">
        <h1 className="mb-2 text-lg font-semibold">Informe · activa «Ortofoto» arriba a la derecha</h1>
        <p className="mb-2 text-[12px] text-[#9b9ba3]">Misma vista con capa PNOA IGN.</p>
        <AvmMap lat={lat} lng={lng} comparables={comps} anillos ortofotoToggle />
      </section>
      <section id="nueva-mapa">
        <h1 className="mb-2 text-lg font-semibold">Nueva valoración · En el mapa</h1>
        <AvmMap
          className="h-[360px] w-full overflow-hidden rounded-lg border border-[#26262b] bg-[#0f1114]"
          lat={lat}
          lng={lng}
          zoom={13}
          arrastrable
        />
      </section>
    </div>
  );
}
