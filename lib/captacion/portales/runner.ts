import { cronZonaAutorizado } from "@/lib/catastro-host/zone-tick";

export { cronZonaAutorizado as cronPortalesAutorizado };

/** Sync por API desactivado: el rastreo vive en el worker `crawler/`. */
export async function ejecutarSyncPortales(): Promise<{
  ok: boolean;
  error?: string;
  alertas: number;
  nuevos: number;
  bajadas: number;
  retirados: number;
  omitidas: string[];
}> {
  return {
    ok: false,
    error:
      "Sync por API desactivado. Idealista no tiene credenciales; usa el worker crawler en el VPS.",
    alertas: 0,
    nuevos: 0,
    bajadas: 0,
    retirados: 0,
    omitidas: [],
  };
}
