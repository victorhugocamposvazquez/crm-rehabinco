"use client";

import { useEffect, useState } from "react";

import { CLAVE_DISENO, EVENTO_DISENO, parseDiseno, type Diseno } from "./diseno-config";

export type { Diseno } from "./diseno-config";

export function leerDiseno(): Diseno {
  if (typeof document === "undefined") return "clasico";
  return parseDiseno(document.documentElement.dataset.diseno);
}

export function fijarDiseno(diseno: Diseno): void {
  const html = document.documentElement;
  if (diseno === "aire") html.dataset.diseno = "aire";
  else delete html.dataset.diseno;
  try {
    localStorage.setItem(CLAVE_DISENO, diseno);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(EVENTO_DISENO, { detail: diseno }));
}

export function useDiseno(): [Diseno, (d: Diseno) => void] {
  const [diseno, setDiseno] = useState<Diseno>("clasico");
  useEffect(() => {
    setDiseno(leerDiseno());
    const sync = () => setDiseno(leerDiseno());
    window.addEventListener(EVENTO_DISENO, sync);
    return () => window.removeEventListener(EVENTO_DISENO, sync);
  }, []);
  return [diseno, (d) => fijarDiseno(d)];
}
