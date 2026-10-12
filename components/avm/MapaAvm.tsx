"use client";

import React, { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { htmlMarcadorSujeto, TILES_CARTO_OSCURO } from "@/lib/avm/ui/mapa-leaflet";

type Props = {
  lat: number;
  lng: number;
  zoom?: number;
  arrastrable?: boolean;
  onMover?: (lat: number, lng: number) => void;
  className?: string;
};

export function MapaAvm({ lat, lng, zoom = 16, arrastrable = false, onMover, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mover = useRef(onMover);
  mover.current = onMover;
  const coords = `${lat.toFixed(6)},${lng.toFixed(6)}`;

  useEffect(() => {
    let mapa: { remove: () => void } | null = null;
    let vivo = true;
    (async () => {
      const L = (await import("leaflet")).default;
      if (!vivo || !ref.current) return;
      const m = L.map(ref.current, { zoomControl: true, attributionControl: true }).setView([lat, lng], zoom);
      L.tileLayer(TILES_CARTO_OSCURO.url, {
        attribution: TILES_CARTO_OSCURO.attribution,
        subdomains: TILES_CARTO_OSCURO.subdomains,
        maxZoom: 20,
      }).addTo(m);
      const icon = L.divIcon({
        className: "",
        html: htmlMarcadorSujeto(),
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      const pin = L.marker([lat, lng], { draggable: arrastrable, icon }).addTo(m);
      if (arrastrable && onMover) {
        pin.on("dragend", () => {
          const p = pin.getLatLng();
          mover.current?.(p.lat, p.lng);
        });
      }
      mapa = m;
    })();
    return () => {
      vivo = false;
      mapa?.remove();
    };
  }, [arrastrable, zoom, coords]);

  return (
    <div
      ref={ref}
      className={className ?? "h-[260px] w-full overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-soft)]"}
    />
  );
}
