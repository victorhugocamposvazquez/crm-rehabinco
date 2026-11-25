"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { EdificioMapa } from "@/lib/catastro/mapa/inspire";
import { tieneDivisionHorizontal } from "@/lib/catastro/mapa/filtros";
import { ATRIBUCION_ORTOFOTO, WMTS_PNOA_MA } from "@/lib/avm/ui/map-config";

/** Mapa base del IGN (oficial, gratuito con atribución). */
const WMTS_IGN_BASE =
  "https://www.ign.es/wmts/ign-base?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=IGNBaseTodo&STYLE=default&FORMAT=image/jpeg&TILEMATRIXSET=GoogleMapsCompatible&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}";
const WMS_CATASTRO = "https://ovc.catastro.meh.es/Cartografia/WMS/ServidorWMS.aspx";

export const ZOOM_MIN_EDIFICIOS = 16;

export type VistaMapa = { lat: number; lng: number; zoom: number };
export type RecuadroMapa = { sur: number; oeste: number; norte: number; este: number };

const COLOR = {
  dh: "#0f766e",
  sinDh: "#b45309",
  trabajado: "#64748b",
  seleccion: "#0f172a",
};

export function MapaEdificios({
  vista,
  edificios,
  trabajados,
  seleccion,
  ortofoto,
  onMover,
  onSeleccionar,
}: {
  vista: VistaMapa;
  edificios: EdificioMapa[];
  trabajados: ReadonlySet<string>;
  seleccion: string | null;
  ortofoto: boolean;
  onMover: (vista: VistaMapa, recuadro: RecuadroMapa) => void;
  onSeleccionar: (ref: string) => void;
}) {
  const nodo = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapa = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const capas = useRef<{ edificios: any; orto: any; base: any } | null>(null);
  const mover = useRef(onMover);
  mover.current = onMover;
  const seleccionar = useRef(onSeleccionar);
  seleccionar.current = onSeleccionar;

  useEffect(() => {
    let vivo = true;
    (async () => {
      const L = (await import("leaflet")).default;
      if (!vivo || !nodo.current || mapa.current) return;
      const m = L.map(nodo.current, { zoomControl: false, minZoom: 6, maxZoom: 20 }).setView([vista.lat, vista.lng], vista.zoom);
      L.control.zoom({ position: "topleft" }).addTo(m);
      const base = L.tileLayer(WMTS_IGN_BASE, { maxZoom: 20, maxNativeZoom: 19, attribution: "IGN Base © IGN" }).addTo(m);
      const orto = L.tileLayer(WMTS_PNOA_MA, { maxZoom: 20, maxNativeZoom: 19, attribution: ATRIBUCION_ORTOFOTO });
      L.tileLayer
        .wms(WMS_CATASTRO, {
          layers: "Catastro",
          format: "image/png",
          transparent: true,
          minZoom: 15,
          maxZoom: 20,
          opacity: 0.55,
          attribution: "Dirección General del Catastro",
        })
        .addTo(m);
      const edificios = L.layerGroup().addTo(m);
      capas.current = { edificios, orto, base };
      m.attributionControl.setPrefix(false);
      const avisar = () => {
        const b = m.getBounds();
        const c = m.getCenter();
        mover.current(
          { lat: c.lat, lng: c.lng, zoom: m.getZoom() },
          { sur: b.getSouth(), oeste: b.getWest(), norte: b.getNorth(), este: b.getEast() }
        );
      };
      m.on("moveend", avisar);
      mapa.current = m;
      avisar();
    })();
    return () => {
      vivo = false;
      mapa.current?.remove();
      mapa.current = null;
      capas.current = null;
    };
    // Solo al montar: la vista inicial no se vuelve a imponer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = mapa.current;
    const c = capas.current;
    if (!m || !c) return;
    if (ortofoto) {
      c.orto.addTo(m);
      c.base.remove();
    } else {
      c.base.addTo(m);
      c.orto.remove();
    }
  }, [ortofoto]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const L = (await import("leaflet")).default;
      const c = capas.current;
      if (!vivo || !c) return;
      c.edificios.clearLayers();
      for (const e of edificios) {
        const marcado = trabajados.has(e.ref);
        const sel = e.ref === seleccion;
        const color = sel ? COLOR.seleccion : marcado ? COLOR.trabajado : tieneDivisionHorizontal(e) ? COLOR.dh : COLOR.sinDh;
        L.polygon(e.huella, {
          color,
          weight: sel ? 3 : 1.5,
          fillColor: color,
          fillOpacity: sel ? 0.35 : marcado ? 0.12 : 0.22,
        })
          .on("click", () => seleccionar.current(e.ref))
          .bindTooltip(`${e.inmuebles ?? "?"} inmuebles${e.anio ? ` · ${e.anio}` : ""}`, { direction: "top", sticky: true })
          .addTo(c.edificios);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [edificios, trabajados, seleccion]);

  /** Centrar en el edificio elegido desde la lista. */
  useEffect(() => {
    const m = mapa.current;
    if (!m || !seleccion) return;
    const e = edificios.find((x) => x.ref === seleccion);
    if (e && !m.getBounds().contains([e.lat, e.lng])) m.panTo([e.lat, e.lng]);
  }, [seleccion, edificios]);

  return <div ref={nodo} className="h-full w-full bg-[#eef1f4]" data-testid="mapa-edificios" />;
}
