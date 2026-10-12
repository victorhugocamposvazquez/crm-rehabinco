"use client";

import React, { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { AdjustedComparable } from "../../lib/avm/types";
import { fmtEuros, fmtEurosPorM2, fmtNumero } from "../../lib/avm/ui/format";

type Props = {
  lat: number;
  lng: number;
  comparables?: AdjustedComparable[];
  arrastrable?: boolean;
  onMover?: (lat: number, lng: number) => void;
  className?: string;
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

export function MapaValoracion({ lat, lng, comparables = [], arrastrable = false, onMover, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mover = useRef(onMover);
  mover.current = onMover;
  const firma = comparables.map((c) => c.listingId).join(",");

  useEffect(() => {
    let mapa: { remove: () => void } | null = null;
    let vivo = true;
    (async () => {
      const L = (await import("leaflet")).default;
      if (!vivo || !ref.current) return;
      const m = L.map(ref.current, { zoomControl: true, attributionControl: true }).setView([lat, lng], 16);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: "&copy; OpenStreetMap &copy; CARTO",
        subdomains: "abcd",
        maxZoom: 20,
      }).addTo(m);

      const bounds = L.latLngBounds([]);
      for (const radio of [100, 200, 300]) {
        const circle = L.circle([lat, lng], { radius: radio, color: "#6a6a72", weight: 1, fill: false, dashArray: "4 5" }).addTo(m);
        bounds.extend(circle.getBounds());
      }

      const sujetoIcon = L.divIcon({
        className: "",
        html: '<div style="width:14px;height:14px;border-radius:50%;background:#f3f3f1;border:2px solid rgba(243,243,241,.35);box-shadow:0 0 0 2px #0a0a0b"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      const sujeto = L.marker([lat, lng], { draggable: arrastrable, icon: sujetoIcon }).addTo(m);
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

      if (bounds.isValid()) m.fitBounds(bounds, { padding: [16, 16], maxZoom: 17 });
      mapa = m;
    })();
    return () => {
      vivo = false;
      mapa?.remove();
    };
  }, [lat, lng, arrastrable, firma]);

  return (
    <div
      ref={ref}
      className={className ?? "aspect-square w-full overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-soft)]"}
    />
  );
}
