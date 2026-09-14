export type PersonaMencion = {
  id: string;
  nombre: string;
  color: string | null;
};

export function aliasMencion(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] || nombre;
}

function escapeRegExp(valor: string) {
  return valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extraerMenciones(texto: string, equipo: PersonaMencion[]): PersonaMencion[] {
  const vistos = new Set<string>();
  const out: PersonaMencion[] = [];
  for (const persona of equipo) {
    const alias = aliasMencion(persona.nombre);
    if (!alias) continue;
    const re = new RegExp(`(^|\\s)@${escapeRegExp(alias)}\\b`, "i");
    if (re.test(` ${texto}`) && !vistos.has(persona.id)) {
      vistos.add(persona.id);
      out.push(persona);
    }
  }
  return out;
}

export function candidatosMencion(
  texto: string,
  cursor: number,
  equipo: PersonaMencion[]
): { query: string; start: number; items: PersonaMencion[] } | null {
  const antes = texto.slice(0, cursor);
  const match = antes.match(/@([^\s@]*)$/);
  if (!match) return null;
  const query = match[1].toLowerCase();
  const items = equipo.filter((persona) => {
    const alias = aliasMencion(persona.nombre).toLowerCase();
    const full = persona.nombre.toLowerCase();
    return alias.startsWith(query) || full.includes(query);
  });
  return { query, start: cursor - match[0].length, items };
}

export function insertarMencion(texto: string, start: number, cursor: number, nombre: string): { texto: string; cursor: number } {
  const alias = aliasMencion(nombre);
  const siguiente = `${texto.slice(0, start)}@${alias} ${texto.slice(cursor)}`;
  return { texto: siguiente, cursor: start + alias.length + 2 };
}

export function partesConMenciones(
  texto: string,
  equipo: PersonaMencion[]
): Array<{ texto: string; mencion?: PersonaMencion }> {
  if (!texto) return [];
  const aliases = [...equipo].sort((a, b) => aliasMencion(b.nombre).length - aliasMencion(a.nombre).length);
  const re = aliases.length
    ? new RegExp(`(@(?:${aliases.map((p) => escapeRegExp(aliasMencion(p.nombre))).join("|")}))\\b`, "gi")
    : null;
  if (!re) return [{ texto }];
  const partes: Array<{ texto: string; mencion?: PersonaMencion }> = [];
  let last = 0;
  for (const match of texto.matchAll(re)) {
    const idx = match.index ?? 0;
    if (idx > last) partes.push({ texto: texto.slice(last, idx) });
    const alias = match[1].slice(1);
    const persona = aliases.find((p) => aliasMencion(p.nombre).toLowerCase() === alias.toLowerCase());
    partes.push({ texto: match[1], mencion: persona });
    last = idx + match[0].length;
  }
  if (last < texto.length) partes.push({ texto: texto.slice(last) });
  return partes;
}
