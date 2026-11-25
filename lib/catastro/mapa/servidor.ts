import { CATASTRO_USER_AGENT } from "../constants";
import {
  parsearEdificios,
  parsearPortales,
  unirPortales,
  urlEdificios,
  urlPortales,
  type EdificioMapa,
  type Recuadro,
} from "./inspire";

type Entrada = { caduca: number; valor: { edificios: EdificioMapa[]; posibleCorte: boolean } };
const cache = new Map<string, Entrada>();
const TTL_MS = 60 * 60 * 1000;
const MAX_ENTRADAS = 200;

async function descargar(url: string, timeoutMs: number, fetcher: typeof fetch): Promise<string> {
  const res = await fetcher(url, {
    headers: { "User-Agent": CATASTRO_USER_AGENT, Accept: "application/xml,text/xml" },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Catastro respondió ${res.status}`);
  // El WFS declara ISO-8859-1.
  return new TextDecoder("latin1").decode(await res.arrayBuffer());
}

/**
 * Edificios y portales de un recuadro, directamente del WFS INSPIRE del Catastro.
 * Si fallan los portales se devuelven igual los edificios (sin dirección).
 */
export async function edificiosDeRecuadro(
  r: Recuadro,
  fetcher: typeof fetch = fetch
): Promise<{ edificios: EdificioMapa[]; posibleCorte: boolean; sinDirecciones: boolean }> {
  const clave = `${r.sur},${r.oeste},${r.norte},${r.este}`;
  const hit = cache.get(clave);
  if (hit && hit.caduca > Date.now()) return { ...hit.valor, sinDirecciones: false };

  const [bu, ad] = await Promise.allSettled([descargar(urlEdificios(r), 25_000, fetcher), descargar(urlPortales(r), 20_000, fetcher)]);
  if (bu.status === "rejected") throw bu.reason instanceof Error ? bu.reason : new Error(String(bu.reason));
  const { edificios, posibleCorte } = parsearEdificios(bu.value);
  const sinDirecciones = ad.status === "rejected";
  const valor = {
    edificios: sinDirecciones ? edificios : unirPortales(edificios, parsearPortales(ad.value)),
    posibleCorte,
  };
  if (!sinDirecciones) {
    if (cache.size >= MAX_ENTRADAS) cache.delete(cache.keys().next().value as string);
    cache.set(clave, { caduca: Date.now() + TTL_MS, valor });
  }
  return { ...valor, sinDirecciones };
}
