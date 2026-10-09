/**
 * Dónde está un anuncio de Idealista, en cualquier municipio de España.
 * El título del listado trae ciudad y, si existe, barrio. La calle y el número no son zona.
 */

export type LugarIdealista = {
  municipio: string | null;
  barrio: string | null;
};

const ARTICULO_GALLEGO = /^(?:a|o)\s+/i;
const DIRECCION =
  /^(calle|c\/|avda\.?|avenida|av\.|paseo|pº|pg\.?|rambla|plaza|praza|plaça|rúa|rua|carretera|ctra\.?|traves[ií]a|camino|ronda|glorieta|pasaje|pol[ií]gono|callej[oó]n|cuesta|lugar|lg\.?|aldea|urbanizaci[oó]n|v[ií]a)\b|(?:s\/n)$|^(?:ac|cp|dp|n)-?\d/i;
const NUMERO = /^\d+\s*(?:bis|b)?$/i;

function limpio(valor: string | null | undefined): string {
  return (valor ?? "").replace(/\s+/g, " ").trim();
}

function clave(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(ARTICULO_GALLEGO, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function esElMismoLugar(a: string | null | undefined, b: string | null | undefined): boolean {
  const izq = clave(limpio(a));
  const der = clave(limpio(b));
  return Boolean(izq) && izq === der;
}

export function esDireccion(valor: string | null | undefined): boolean {
  const texto = limpio(valor);
  if (!texto) return true;
  if (NUMERO.test(texto)) return true;
  if (/^(?:ac|cp|dp|n)-?\d/i.test(texto)) return true;
  // Idealista une dos barrios con guion: «Elviña - A Zapateira». Eso es zona, no una calle.
  if (texto.includes("-") || texto.includes("–")) return false;
  return DIRECCION.test(texto);
}

function barrioTrasEn(cabeza: string): string | null {
  const corte = cabeza.toLowerCase().lastIndexOf(" en ");
  if (corte < 0) return null;
  const candidato = cabeza.slice(corte + 4).trim();
  if (!candidato || esDireccion(candidato)) return null;
  return candidato;
}

/** Último tramo: municipio. El barrio es el lugar anterior que no sea calle ni número. */
export function lugarDeTituloIdealista(titulo: string | null | undefined): LugarIdealista {
  const tramos = limpio(titulo).split(",").map((s) => s.trim()).filter(Boolean);
  if (tramos.length < 2) return { municipio: null, barrio: null };
  const municipio = tramos[tramos.length - 1] ?? null;
  let barrio: string | null = null;
  for (let i = tramos.length - 2; i >= 0; i -= 1) {
    const tramo = tramos[i] ?? "";
    if (NUMERO.test(tramo)) continue;
    const candidato = i === 0 ? barrioTrasEn(tramo) : tramo;
    if (!candidato || esDireccion(candidato) || esElMismoLugar(candidato, municipio)) continue;
    barrio = candidato;
    break;
  }
  return { municipio, barrio };
}

/**
 * El título manda. Si no trae barrio, se conserva el que ya venía
 * siempre que no sea la ciudad, una calle o un número.
 */
export function lugarDeAnuncioIdealista(input: {
  titulo?: string | null;
  municipio?: string | null;
  barrio?: string | null;
}): LugarIdealista {
  const delTitulo = lugarDeTituloIdealista(input.titulo);
  const municipio = delTitulo.municipio || limpio(input.municipio) || null;
  const propuesto = delTitulo.barrio || limpio(input.barrio) || null;
  const barrio = propuesto && !esDireccion(propuesto) && !esElMismoLugar(propuesto, municipio) ? propuesto : null;
  return { municipio, barrio };
}

/** No sustituye un barrio ya guardado por la ciudad sola. */
export function zonaAlGuardar(
  nueva: string | null | undefined,
  municipio: string | null | undefined,
  anterior: string | null | undefined
): string | null {
  const entrante = lugarDeAnuncioIdealista({ municipio, barrio: nueva });
  if (entrante.barrio) return entrante.barrio;
  const previa = lugarDeAnuncioIdealista({ municipio: entrante.municipio ?? municipio, barrio: anterior });
  if (previa.barrio) return previa.barrio;
  return entrante.municipio ?? (limpio(municipio) || null);
}

/** `/venta-viviendas/a-coruna/eiris/` es un barrio. `/oleiros-a-coruna/` es el municipio. */
export function esListadoDeDistrito(url: string | null | undefined): boolean {
  if (!url) return false;
  let path = "";
  try {
    path = new URL(url).pathname;
  } catch {
    return false;
  }
  const partes = path.split("/").filter(Boolean);
  if (!/^(venta|alquiler)-viviendas$/.test(partes[0] ?? "")) return false;
  const ciudad = partes[1];
  const distrito = partes[2];
  if (!ciudad || !distrito) return false;
  if (/^pagina-\d+\.htm$/i.test(distrito) || /^con-/.test(distrito)) return false;
  if (distrito === ciudad || distrito.startsWith("area-de-")) return false;
  if (ciudad.endsWith("-provincia")) return false;
  return true;
}
