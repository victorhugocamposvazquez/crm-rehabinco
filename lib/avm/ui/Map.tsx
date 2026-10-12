"use client";

import React, { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import type { AdjustedComparable } from "../types";
import { fmtEuros, fmtEurosPorM2, fmtNumero } from "./format";
import { htmlMarcadorSujeto } from "./mapa-leaflet";
import { ATRIBUCION_MAPA_BASE, ATRIBUCION_ORTOFOTO, urlEstiloMapa, WMTS_PNOA_MA } from "./map-config";

export type AvmMapProps = {
  lat: number;
  lng: number;
  zoom?: number;
  className?: string;
  arrastrable?: boolean;
  onMover?: (lat: number, lng: number) => void;
  /** Comparables con radio proporcional al peso. */
  comparables?: AdjustedComparable[];
  /** Anillos 100 / 200 / 300 m (informe). */
  anillos?: boolean;
  /** Muestra conmutador ortofoto IGN (informe). */
  ortofotoToggle?: boolean;
};

function anguloComparable(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h * (Math.PI / 180);
}

function destino(lat: number, lng: number, distanceM: number, ang: number): [number, number] {
  const dLat = (distanceM * Math.cos(ang)) / 111320;
  const dLng = (distanceM * Math.sin(ang)) / (111320 * Math.cos((lat * Math.PI) / 180));
  return [lat + dLat, lng + dLng];
}

export function AvmMap({
  lat,
  lng,
  zoom = 16,
  className,
  arrastrable = false,
  onMover,
  comparables = [],
  anillos = false,
  ortofotoToggle = false,
}: AvmMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mover = useRef(onMover);
  mover.current = onMover;
  const [ortofoto, setOrtofoto] = useState(false);
  const coords = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  const firmaComps = comparables.map((c) => c.listingId).join(",");

  useEffect(() => {
    let mapa: { remove: () => void } | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ortoLayer: any = null;
    let vivo = true;

    (async () => {
      const L = (await import("leaflet")).default;
      const maplibre = await import("maplibre-gl");
      maplibre.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      const { maplibreGL } = await import("@maplibre/maplibre-gl-leaflet");

      if (!vivo || !ref.current) return;

      const m = L.map(ref.current, {
        zoomControl: true,
        attributionControl: true,
        maxBounds: [
          [85, -180],
          [-85, 180],
        ],
        maxBoundsViscosity: 1,
        minZoom: 1,
      }).setView([lat, lng], zoom);

      maplibreGL({ style: urlEstiloMapa() }).addTo(m);

      m.attributionControl.setPrefix(false);
      m.attributionControl.addAttribution(ATRIBUCION_MAPA_BASE);

      if (ortofotoToggle) {
        ortoLayer = L.tileLayer(WMTS_PNOA_MA, {
          maxZoom: 20,
          opacity: 0.92,
          attribution: ATRIBUCION_ORTOFOTO,
        });
        if (ortofoto) {
          ortoLayer.addTo(m);
          m.attributionControl.addAttribution(ATRIBUCION_ORTOFOTO);
        }
      }

      const bounds = L.latLngBounds([]);

      if (anillos) {
        for (const radio of [100, 200, 300]) {
          const circle = L.circle([lat, lng], {
            radius: radio,
            color: "#6a6e76",
            weight: 1,
            fill: false,
            dashArray: "4 5",
          }).addTo(m);
          bounds.extend(circle.getBounds());
        }
      }

      const sujetoIcon = L.divIcon({
        className: "",
        html: htmlMarcadorSujeto(),
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      const sujeto = L.marker([lat, lng], { draggable: arrastrable, icon: sujetoIcon, zIndexOffset: 1000 }).addTo(m);
      bounds.extend([lat, lng]);
      if (arrastrable && onMover) {
        sujeto.on("dragend", () => {
          const p = sujeto.getLatLng();
          mover.current?.(p.lat, p.lng);
        });
      }

      for (const c of comparables) {
        const ang = anguloComparable(c.listingId);
        const pos = destino(lat, lng, c.distanceM, ang);
        const r = 4 + c.weight * 8;
        L.circleMarker(pos, {
          radius: r,
          color: "#7ab8ff",
          weight: 1,
          fillColor: "#7ab8ff",
          fillOpacity: 0.75,
        })
          .addTo(m)
          .bindTooltip(
            `${fmtEuros(c.price)} · ${fmtNumero(c.surface)} m² · ${fmtEurosPorM2(c.adjustedPpm2)} · ${fmtNumero(c.distanceM)} m`,
            { direction: "top" },
          );
        bounds.extend(pos);
      }

      if (anillos && bounds.isValid()) m.fitBounds(bounds, { padding: [16, 16], maxZoom: 17 });

      mapa = m;
    })();

    return () => {
      vivo = false;
      mapa?.remove();
    };
  }, [lat, lng, zoom, arrastrable, firmaComps, anillos, ortofotoToggle, ortofoto, coords]);

  return (
    <div className="relative">
      {ortofotoToggle ? (
        <button
          type="button"
          className={`absolute right-2 top-2 z-[1000] rounded-md border px-2.5 py-1 text-[12px] font-medium shadow-sm ${
            ortofoto
              ? "border-[var(--border-strong)] bg-[var(--surface)] text-foreground"
              : "border-[var(--border)] bg-[var(--surface)]/90 text-[var(--text-3)] backdrop-blur"
          }`}
          onClick={() => setOrtofoto((v) => !v)}
        >
          Ortofoto
        </button>
      ) : null}
      <div
        ref={ref}
        className={
          className ??
          "h-[260px] w-full overflow-hidden rounded-lg border border-[var(--border)] bg-[#0f1114]"
        }
        data-testid="avm-map"
      />
    </div>
  );
}

/** Alias corto para imports `Map`. */
export { AvmMap as Map };
