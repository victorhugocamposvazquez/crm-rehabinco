/** Estudio de creatividades · configuración (formatos, colores, tipografías, objetivos y catálogo de diseños). */

export type FormatId = 'post' | 'feed' | 'story' | 'fb';
export const FORMATS: Record<FormatId, { label: string; ratio: string; w: number; h: number }> = {
  post: { label: 'Post', ratio: '1:1', w: 1080, h: 1080 },
  feed: { label: 'Feed', ratio: '4:5', w: 1080, h: 1350 },
  story: { label: 'Story', ratio: '9:16', w: 1080, h: 1920 },
  fb: { label: 'Facebook', ratio: '1.91:1', w: 1200, h: 628 },
};

export type ThemeId = 'blanco' | 'piedra' | 'arena' | 'negro' | 'atlantico';
export type Theme = { label: string; bg: string; fg: string; mut: string; acc: string; accFg: string; line: string; grid: string };
/** Colores de la creatividad (no del CRM). Los claros van primero: Blanco es el valor por defecto. */
export const THEMES: Record<ThemeId, Theme> = {
  blanco: { label: 'Blanco', bg: '#FFFFFF', fg: '#141414', mut: 'rgba(20,20,20,.62)', acc: '#141414', accFg: '#FFFFFF', line: 'rgba(0,0,0,.16)', grid: 'rgba(0,0,0,.06)' },
  piedra: { label: 'Piedra', bg: '#E5E4DF', fg: '#1F2326', mut: 'rgba(31,35,38,.66)', acc: '#1F2326', accFg: '#F2F1EC', line: 'rgba(31,35,38,.18)', grid: 'rgba(31,35,38,.07)' },
  arena: { label: 'Arena', bg: '#E8DFCF', fg: '#33281D', mut: 'rgba(51,40,29,.68)', acc: '#9A6A3A', accFg: '#FFF8EE', line: 'rgba(51,40,29,.22)', grid: 'rgba(51,40,29,.07)' },
  negro: { label: 'Negro', bg: '#000000', fg: '#FFFFFF', mut: 'rgba(255,255,255,.66)', acc: '#FFFFFF', accFg: '#000000', line: 'rgba(255,255,255,.24)', grid: 'rgba(255,255,255,.07)' },
  atlantico: { label: 'Atlántico', bg: '#10303F', fg: '#EFE7D8', mut: 'rgba(239,231,216,.72)', acc: '#D9B46A', accFg: '#10303F', line: 'rgba(239,231,216,.24)', grid: 'rgba(239,231,216,.07)' },
};

/**
 * Familias tipográficas. Con next/font las familias llevan nombre con hash, así que las plantillas
 * usan variables CSS: decláralas en app/layout.tsx (ver README, «Fuentes»).
 */
export const FONT = {
  sans: "var(--font-inter, 'Inter'), system-ui, sans-serif",
  serif: "var(--font-fraunces, 'Fraunces'), serif",
  bebas: "var(--font-bebas, 'Bebas Neue'), sans-serif",
  mono: "var(--font-jetbrains, 'JetBrains Mono'), monospace",
} as const;

export type TypoId = 'editorial' | 'moderna' | 'impacto';
export type Typo = { label: string; ff: string; fw: number; tt: 'none' | 'uppercase'; ls: string; it: 'italic' | 'normal'; k: number; lh: number };
export const TYPOS: Record<TypoId, Typo> = {
  editorial: { label: 'Editorial', ff: FONT.serif, fw: 500, tt: 'none', ls: '-.015em', it: 'italic', k: 1, lh: 1.02 },
  moderna: { label: 'Moderna', ff: FONT.sans, fw: 700, tt: 'none', ls: '-.035em', it: 'normal', k: 0.95, lh: 1.02 },
  impacto: { label: 'Impacto', ff: FONT.bebas, fw: 400, tt: 'uppercase', ls: '.01em', it: 'normal', k: 1.3, lh: 0.92 },
};

/** Qué se anuncia. Fija la etiqueta de la pieza y qué diseños se ofrecen primero. */
export type GoalId = 'nuevo' | 'bajada' | 'exclusiva' | 'openhouse' | 'vendido' | 'reforma';
export const GOALS: { id: GoalId; label: string; badge: string }[] = [
  { id: 'nuevo', label: 'Nuevo inmueble', badge: 'Nuevo' },
  { id: 'bajada', label: 'Bajada de precio', badge: 'Precio rebajado' },
  { id: 'exclusiva', label: 'Exclusiva', badge: 'En exclusiva' },
  { id: 'openhouse', label: 'Puertas abiertas', badge: 'Puertas abiertas' },
  { id: 'vendido', label: 'Vendido', badge: 'Vendido' },
  { id: 'reforma', label: 'Reforma', badge: 'Reformado por Rehabinco' },
];

export type TemplateId =
  | 'galeria' | 'bento' | 'moodboard' | 'triptico' | 'formas' | 'contactos' | 'collage'
  | 'portada' | 'bajada' | 'arco' | 'xxl' | 'plano' | 'openhouse' | 'vendido' | 'reforma';

export type TemplateDef = {
  id: TemplateId; nombre: string; desc: string;
  /** Nº de huecos de foto que usa (1 = una sola foto). */
  fotos: number;
  /** Si existe, el diseño solo se ofrece para ese objetivo. */
  only?: GoalId;
  /** Datos que pinta el diseño: son los que se listan en el panel «Datos». */
  uses: FieldKey[];
};

export type FieldKey = 'badge' | 'titulo' | 'zona' | 'precio' | 'm2' | 'hab' | 'banos' | 'energia' | 'evento' | 'evHora' | 'cta' | 'agente' | 'tel' | 'ref' | 'logo';
const GEN: FieldKey[] = ['badge', 'titulo', 'zona', 'precio', 'm2', 'hab', 'banos', 'logo'];

export const TEMPLATES: TemplateDef[] = [
  { id: 'galeria', nombre: 'Galería', fotos: 3, uses: GEN, desc: 'Una foto grande y dos de apoyo, como una doble página de revista.' },
  { id: 'bento', nombre: 'Mosaico', fotos: 4, uses: GEN, desc: 'Cuatro fotos y una tarjeta con el precio, en cuadrícula redondeada.' },
  { id: 'moodboard', nombre: 'Moodboard', fotos: 3, uses: GEN, desc: 'Fotos sueltas con cinta, nota manuscrita y sello del barrio.' },
  { id: 'triptico', nombre: 'Tríptico', fotos: 3, uses: GEN, desc: 'Tres fotos verticales en arco, escalonadas, con el precio en el centro.' },
  { id: 'formas', nombre: 'Formas', fotos: 3, uses: GEN, desc: 'Arco, círculo y rectángulo: tres fotos con geometría.' },
  { id: 'contactos', nombre: 'Tira de película', fotos: 4, uses: GEN, desc: 'Las fotos como una tira de negativos, con las superficies en grande.' },
  { id: 'collage', nombre: 'Polaroids', fotos: 3, uses: GEN, desc: 'Tres fotos tipo polaroid. Ideal para carrusel.' },
  { id: 'portada', nombre: 'Portada', fotos: 1, uses: [...GEN, 'agente', 'tel', 'ref'], desc: 'Como una portada de revista, con sello. Para anunciar entradas nuevas.' },
  { id: 'arco', nombre: 'Exclusiva', fotos: 1, uses: GEN, desc: 'Ventana en arco y composición centrada. Para viviendas especiales.' },
  { id: 'xxl', nombre: 'Precio XXL', fotos: 1, uses: GEN, desc: 'El precio enorme con la foto dentro de las cifras.' },
  { id: 'plano', nombre: 'Ficha técnica', fotos: 1, uses: [...GEN, 'energia', 'ref'], desc: 'Estilo plano de arquitecto, con superficies y certificado energético.' },
  { id: 'bajada', nombre: 'Bajada de precio', fotos: 1, only: 'bajada', uses: GEN, desc: 'La rebaja en grande y el precio anterior tachado.' },
  { id: 'openhouse', nombre: 'Puertas abiertas', fotos: 1, only: 'openhouse', uses: ['badge', 'titulo', 'zona', 'precio', 'evento', 'evHora'], desc: 'Polaroid y hoja de calendario con la fecha de la visita.' },
  { id: 'vendido', nombre: 'Vendido', fotos: 1, only: 'vendido', uses: ['badge', 'zona', 'cta', 'logo'], desc: 'Cinta cruzada sobre la foto y llamada a captar nuevos propietarios.' },
  { id: 'reforma', nombre: 'Antes y después', fotos: 1, only: 'reforma', uses: ['badge', 'titulo', 'zona', 'precio', 'logo'], desc: 'Foto partida en diagonal para enseñar una reforma.' },
];

/** Diseños que se marcan como «Recomendada» para cada objetivo (los `only` salen como «Hecha para esto»). */
export const RECOMMENDED: Partial<Record<GoalId, TemplateId[]>> = { nuevo: ['galeria', 'portada'], exclusiva: ['arco', 'formas'], bajada: ['xxl'] };

export const FIELD_LABELS: Record<FieldKey, string> = {
  badge: 'Etiqueta', titulo: 'Título', zona: 'Ubicación', precio: 'Precio', m2: 'Superficie (m²)', hab: 'Dormitorios', banos: 'Baños',
  energia: 'Certificado energético', evento: 'Fecha de la visita', evHora: 'Horario', cta: 'Llamada a la acción', agente: 'Agente', tel: 'Teléfono', ref: 'Referencia', logo: 'Logo Rehabinco',
};
/** Datos que no se editan desde el Estudio: el precio solo se cambia en la ficha. */
export const READONLY_FIELDS: FieldKey[] = ['precio', 'logo'];
/** Nº máximo de huecos de foto que maneja el estado. */
export const MAX_SLOTS = 5;

/** Diseños disponibles para un objetivo, ordenados: propios, recomendados, resto. */
export function templatesForGoal(goal: GoalId): (TemplateDef & { rank: 0 | 1 | 2 })[] {
  const rank = (t: TemplateDef): 0 | 1 | 2 => (t.only === goal ? 0 : (RECOMMENDED[goal] ?? []).includes(t.id) ? 1 : 2);
  return TEMPLATES.filter((t) => !t.only || t.only === goal)
    .map((t, i) => ({ t, i, r: rank(t) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(({ t, r }) => ({ ...t, rank: r }));
}

/** Tamaño en pantalla que cabe en una caja, manteniendo la proporción del formato. */
export function fitBox(fmt: FormatId, boxW: number, boxH: number): [number, number] {
  const { w, h } = FORMATS[fmt];
  const s = Math.min(boxW / w, boxH / h);
  return [Math.round(w * s), Math.round(h * s)];
}
