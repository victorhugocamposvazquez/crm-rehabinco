"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./captacion-mapa.css";

export type PinMapaCaptacion = {
  id: string;
  lat: number;
  lng: number;
  aprox: boolean;
  precio: string;
};

const VISTA_CORUNA: L.LatLngExpression = [43.36, -8.41];
const ZOOM_INICIAL = 9;

type Props = {
  pins: PinMapaCaptacion[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
};

function iconoPin(p: PinMapaCaptacion, selected: boolean): L.DivIcon {
  const clases = ["captacion-map-pin", p.aprox ? "captacion-map-pin-aprox" : "", selected ? "captacion-map-pin-sel" : ""]
    .filter(Boolean)
    .join(" ");
  return L.divIcon({
    html: `<span class="${clases}">${p.precio}</span>`,
    className: "captacion-map-pin-wrap",
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

export function CaptacionMapaLeaflet({ pins, selectedId, onSelect, className }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const capa = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!contenedor.current || mapa.current) return;
    const instancia = L.map(contenedor.current, {
      scrollWheelZoom: true,
      zoomControl: true,
    }).setView(VISTA_CORUNA, ZOOM_INICIAL);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(instancia);
    mapa.current = instancia;
    capa.current = L.layerGroup().addTo(instancia);
    requestAnimationFrame(() => instancia.invalidateSize());
    return () => {
      instancia.remove();
      mapa.current = null;
      capa.current = null;
    };
  }, []);

  const pinsKey = pins.map((p) => `${p.id}:${p.lat}:${p.lng}:${p.precio}`).join("|");

  useEffect(() => {
    const m = mapa.current;
    const g = capa.current;
    if (!m || !g) return;
    g.clearLayers();
    if (pins.length === 0) {
      m.setView(VISTA_CORUNA, ZOOM_INICIAL);
      return;
    }
    for (const p of pins) {
      const marker = L.marker([p.lat, p.lng], { icon: iconoPin(p, p.id === selectedId) });
      marker.on("click", () => onSelect(p.id));
      marker.addTo(g);
    }
    const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng] as L.LatLngTuple));
    m.fitBounds(bounds.pad(0.12), { maxZoom: 14, animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo recentrar al cambiar el conjunto de pins
  }, [pinsKey]);

  useEffect(() => {
    const g = capa.current;
    if (!g) return;
    g.eachLayer((layer) => {
      if (!(layer instanceof L.Marker)) return;
      const latlng = layer.getLatLng();
      const p = pins.find((x) => x.lat === latlng.lat && x.lng === latlng.lng);
      if (p) layer.setIcon(iconoPin(p, p.id === selectedId));
    });
  }, [selectedId, pins]);

  useEffect(() => {
    const m = mapa.current;
    const p = pins.find((x) => x.id === selectedId);
    if (!m || !p) return;
    m.panTo([p.lat, p.lng], { animate: true });
  }, [selectedId, pins]);

  return <div ref={contenedor} className={className ?? "h-[340px] w-full"} role="application" aria-label="Mapa de anuncios" />;
}
