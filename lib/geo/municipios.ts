import municipiosEs from "./municipios-es.json";
import { MIN_LETRAS_LOCALIDAD } from "./constantes";

export { MIN_LETRAS_LOCALIDAD } from "./constantes";

export type MunicipioEs = {
  nombre: string;
  provincia: string;
};

type FilaMunicipio = { n: string; p: string };

const MUNICIPIOS: MunicipioEs[] = (municipiosEs as FilaMunicipio[]).map((fila) => ({
  nombre: fila.n,
  provincia: fila.p,
}));

export function normalizarLocalidad(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function tokens(texto: string): string[] {
  return normalizarLocalidad(texto)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
}

function coincideMunicipio(m: MunicipioEs, q: string): boolean {
  const nombre = normalizarLocalidad(m.nombre);
  const provincia = normalizarLocalidad(m.provincia);
  if (nombre.startsWith(q) || nombre.includes(q)) return true;
  if (provincia.startsWith(q)) return true;
  return tokens(m.nombre).some((t) => t.startsWith(q)) || tokens(m.provincia).some((t) => t.startsWith(q));
}

export function etiquetaMunicipio(m: MunicipioEs): string {
  return m.provincia && m.provincia !== m.nombre ? `${m.nombre} (${m.provincia})` : m.nombre;
}

export function buscarMunicipios(query: string, limite = 12): MunicipioEs[] {
  const q = normalizarLocalidad(query);
  if (q.length < MIN_LETRAS_LOCALIDAD) return [];
  const empieza: MunicipioEs[] = [];
  const resto: MunicipioEs[] = [];
  for (const m of MUNICIPIOS) {
    if (!coincideMunicipio(m, q)) continue;
    const nombre = normalizarLocalidad(m.nombre);
    if (nombre.startsWith(q) || tokens(m.nombre).some((t) => t.startsWith(q))) empieza.push(m);
    else resto.push(m);
    if (empieza.length >= limite) break;
  }
  return [...empieza, ...resto].slice(0, limite);
}
