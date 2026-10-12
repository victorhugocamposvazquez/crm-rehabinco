"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { AdjustedComparable } from "@/lib/avm/types";

type Props = {
  lat: number;
  lng: number;
  comparables?: AdjustedComparable[];
  arrastrable?: boolean;
  onMover?: (lat: number, lng: number) => void;
  className?: string;
};

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
      const m = L.map(ref.current).setView([lat, lng], 16);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
      }).addTo(m);
      for (const radio of [100, 200, 300]) {
        L.circle([lat, lng], { radius: radio, color: "#111", weight: 1, fill: false, dashArray: "3 4" }).addTo(m);
      }
      const sujeto = L.marker([lat, lng], { draggable: arrastrable }).addTo(m);
      if (arrastrable && onMover) {
        sujeto.on("dragend", () => {
          const p = sujeto.getLatLng();
          mover.current?.(p.lat, p.lng);
        });
      }
      for (const c of comparables) {
        const metros = Math.max(12, Math.round(c.weight * 28));
        const ang = (c.listingId.charCodeAt(0) % 360) * (Math.PI / 180);
        const dLat = (c.distanceM * Math.cos(ang)) / 111320;
        const dLng = (c.distanceM * Math.sin(ang)) / (111320 * Math.cos((lat * Math.PI) / 180));
        L.circleMarker([lat + dLat, lng + dLng], {
          radius: Math.max(4, metros / 4),
          color: "#1d4ed8",
          weight: 1,
          fillOpacity: 0.7,
        }).addTo(m).bindTooltip(`${c.price.toLocaleString("es-ES")} € · ${c.distanceM} m`);
      }
      mapa = m;
    })();
    return () => {
      vivo = false;
      mapa?.remove();
    };
    // firma identifica los comparables sin recrear el mapa en cada render
  }, [lat, lng, arrastrable, firma]);

  return <div ref={ref} className={className ?? "h-72 w-full overflow-hidden rounded-xl border border-[var(--border)]"} />;
}
