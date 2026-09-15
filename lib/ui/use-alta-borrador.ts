"use client";

import { useEffect, useState } from "react";
import {
  EVENTO_ALTA_BORRADOR,
  borrarAltaBorrador,
  escribirAltaBorrador,
  hayAltaBorrador,
  leerAltaBorrador,
  type TipoAlta,
} from "@/lib/ui/alta-borrador";

export function useAltaBorrador<T>({
  tipo,
  ambito = "libre",
  open,
  snapshot,
  estaVacio,
}: {
  tipo: TipoAlta;
  ambito?: string;
  open: boolean;
  snapshot: T;
  estaVacio: (valor: T) => boolean;
}) {
  const [hayBorrador, setHayBorrador] = useState(false);
  const [guardadoEn, setGuardadoEn] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (!open) {
      setListo(false);
      return;
    }
    const sobre = leerAltaBorrador<T>(tipo, ambito);
    if (sobre && !estaVacio(sobre.data)) {
      setHayBorrador(true);
      setGuardadoEn(sobre.savedAt);
    } else {
      setHayBorrador(false);
      setGuardadoEn(null);
    }
    const espera = window.setTimeout(() => setListo(true), 120);
    return () => window.clearTimeout(espera);
  }, [open, tipo, ambito, estaVacio]);

  useEffect(() => {
    if (!open || !listo) return;
    const espera = window.setTimeout(() => {
      if (estaVacio(snapshot)) {
        borrarAltaBorrador(tipo, ambito);
        setHayBorrador(false);
        setGuardadoEn(null);
        return;
      }
      const savedAt = escribirAltaBorrador(tipo, ambito, snapshot);
      setHayBorrador(true);
      setGuardadoEn(savedAt);
    }, 400);
    return () => window.clearTimeout(espera);
  }, [snapshot, open, listo, tipo, ambito, estaVacio]);

  return {
    hayBorrador,
    guardadoEn,
    leer: () => {
      const sobre = leerAltaBorrador<T>(tipo, ambito);
      if (!sobre || estaVacio(sobre.data)) return null;
      return sobre.data;
    },
    descartar: () => {
      borrarAltaBorrador(tipo, ambito);
      setHayBorrador(false);
      setGuardadoEn(null);
    },
    consumir: () => {
      borrarAltaBorrador(tipo, ambito);
      setHayBorrador(false);
      setGuardadoEn(null);
    },
  };
}

export function useHayAltaBorrador(tipo: TipoAlta, ambito = "libre") {
  const [hay, setHay] = useState(() => (typeof window === "undefined" ? false : hayAltaBorrador(tipo, ambito)));
  useEffect(() => {
    const sync = () => setHay(hayAltaBorrador(tipo, ambito));
    sync();
    window.addEventListener(EVENTO_ALTA_BORRADOR, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENTO_ALTA_BORRADOR, sync);
      window.removeEventListener("storage", sync);
    };
  }, [tipo, ambito]);
  return hay;
}
