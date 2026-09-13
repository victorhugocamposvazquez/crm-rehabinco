"use client";

import { useSyncExternalStore } from "react";
import { MEDIA_MOVIL_CATASTRO } from "@/lib/catastro/vista-movil";

function subscribe(onStoreChange: () => void) {
  const mql = window.matchMedia(MEDIA_MOVIL_CATASTRO);
  mql.addEventListener("change", onStoreChange);
  return () => mql.removeEventListener("change", onStoreChange);
}

function getSnapshot() {
  return window.matchMedia(MEDIA_MOVIL_CATASTRO).matches;
}

export function useVistaMovilCatastro() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
