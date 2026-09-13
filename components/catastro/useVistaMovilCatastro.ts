"use client";

import { useEffect, useState } from "react";
import { MEDIA_MOVIL_CATASTRO } from "@/lib/catastro/vista-movil";

export function useVistaMovilCatastro() {
  const [movil, setMovil] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(MEDIA_MOVIL_CATASTRO);
    const onChange = () => setMovil(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return movil;
}
