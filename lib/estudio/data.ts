/** Estudio de creatividades · datos: de la ficha del inmueble + lo que el usuario cambia a lo que pinta la plantilla. */
import { GOALS, MAX_SLOTS, THEMES, TYPOS, type FieldKey, type FormatId, type GoalId, type TemplateId, type ThemeId, type TypoId } from "./config";
import type { CreativeData, Spec } from "@/components/estudio/templates";

export type FotoInmueble = {
  id: string;
  /** URL pública (Supabase Storage). Debe servirse con CORS para poder exportar a PNG. */
  url: string;
  /** Estancia: «Terraza», «Salón»… Sale como pie en polaroids y ficha técnica. */
  nombre: string;
  tipo: 'ext' | 'int';
};

/** Lo que el Estudio necesita de `propiedades`. Mapea aquí tus columnas reales (ver README, «Datos»). */
export type InmuebleEstudio = {
  id: string;
  ref: string;
  titulo: string;
  direccion: string;
  /** «Monte Alto, A Coruña»: lo que se enseña cuando se oculta la dirección exacta. */
  zona: string;
  barrio: string;
  precio: number;
  /** Precio antes de la última bajada, si la hubo. Sin él no se ofrece el objetivo «Bajada de precio». */
  precioAnterior?: number | null;
  m2: number;
  habitaciones: number;
  banos: number;
  energia?: string | null;
  agente: { nombre: string; iniciales: string; color: string };
  fotos: FotoInmueble[];
  /** Próxima visita del calendario, si la hay. */
  visita?: { evento: string; hora: string } | null;
};

/** Datos de agencia. La página del Estudio los rellena con la empresa de Ajustes. */
export const AGENCIA = { telefono: "664 85 93 06", web: "rehabinco.com", cta: "¿Vendes tu casa? Te la valoramos gratis" };

/** Todo lo que define una creatividad. Es lo que se guarda en `creatividades.estado` (jsonb). */
export type CreativeState = {
  goal: GoalId;
  template: TemplateId;
  format: FormatId;
  theme: ThemeId;
  typo: TypoId;
  /** Datos ocultos solo en esta pieza. */
  hidden: Partial<Record<FieldKey, boolean>>;
  /** Textos cambiados a mano; si falta la clave, manda la ficha. */
  overrides: Partial<Record<FieldKey, string>>;
  /** Índice de foto por hueco. null = orden de la ficha. */
  slots: number[] | null;
  /** true = se enseña la zona y no la calle con número. */
  soloZona: boolean;
  /** Tamaño de letra por formato y dato. 1 es el de la plantilla. Post y Story no se comparten. */
  escala: Partial<Record<FormatId, Partial<Record<FieldKey, number>>>>;
  /** Desplazamiento en % del cartel, por formato y dato. */
  pos: Partial<Record<FormatId, Partial<Record<FieldKey, { x: number; y: number }>>>>;
};

export const initialCreativeState: CreativeState = {
  goal: 'nuevo', template: 'galeria', format: 'post', theme: 'blanco', typo: 'editorial',
  hidden: { ref: true, tel: true, agente: true }, overrides: {}, slots: null, soloZona: true,
  escala: {}, pos: {},
};

const eur = (n: number) => n.toLocaleString('es-ES') + ' €';

type EscalaCampo = Partial<Record<FieldKey, number>>;
type PosCampo = Partial<Record<FieldKey, { x: number; y: number }>>;

/** Una pieza antigua guardaba el ajuste sin formato: era un número, no un mapa por formato. */
function escalaEsPlana(raw: object): boolean {
  return Object.values(raw).some((v) => typeof v === "number");
}
function posEsPlana(raw: object): boolean {
  return Object.values(raw).some((v) => !!v && typeof v === "object" && typeof (v as { x?: unknown }).x === "number");
}

/** El ajuste suelto de antes se queda en Post. El resto de formatos nace en el tamaño de la plantilla. */
export function anidarEscala(raw: unknown): CreativeState["escala"] {
  if (!raw || typeof raw !== "object") return {};
  if (escalaEsPlana(raw)) return { post: raw as EscalaCampo };
  return raw as CreativeState["escala"];
}
export function anidarPos(raw: unknown): CreativeState["pos"] {
  if (!raw || typeof raw !== "object") return {};
  if (posEsPlana(raw)) return { post: raw as PosCampo };
  return raw as CreativeState["pos"];
}
export function escalaDelFormato(raw: unknown, format: FormatId): EscalaCampo {
  return anidarEscala(raw)[format] ?? {};
}
export function posDelFormato(raw: unknown, format: FormatId): PosCampo {
  return anidarPos(raw)[format] ?? {};
}

/** Foto de cada hueco, siempre con MAX_SLOTS entradas (si faltan fotos, se repiten en orden). */
export function resolveSlots(slots: number[] | null, nFotos: number): number[] {
  const n = Math.max(1, nFotos);
  return Array.from({ length: MAX_SLOTS }, (_, i) => (slots?.[i] ?? i) % n);
}

/** Pone una foto en un hueco. Si ya estaba en otro hueco visible, se intercambian. */
export function assignPhoto(slots: number[] | null, nFotos: number, slot: number, photo: number, usedSlots: number): number[] {
  const sl = resolveSlots(slots, nFotos);
  const other = sl.slice(0, usedSlots).indexOf(photo);
  const prev = sl[slot];
  sl[slot] = photo;
  if (other >= 0 && other !== slot) sl[other] = prev;
  return sl;
}

/** Valor que sale de la ficha (o de la plantilla / agencia) para cada dato, sin ediciones del usuario. */
export function baseFields(inm: InmuebleEstudio, st: Pick<CreativeState, 'goal' | 'soloZona'>): Record<FieldKey, string> {
  const goal = GOALS.find((g) => g.id === st.goal) ?? GOALS[0];
  return {
    badge: goal.badge, titulo: inm.titulo, zona: st.soloZona ? inm.zona : inm.direccion, precio: eur(inm.precio),
    m2: String(inm.m2), hab: String(inm.habitaciones), banos: String(inm.banos), energia: inm.energia ?? '',
    ref: inm.ref, agente: inm.agente.nombre, tel: AGENCIA.telefono, cta: AGENCIA.cta,
    evento: inm.visita?.evento || "Fecha por confirmar", evHora: inm.visita?.hora || "Horario por confirmar", logo: "",
  };
}

/** Une ficha + estado en lo que necesita `<Creative>`. Función pura: úsala igual en cliente y en servidor. */
export function buildCreativeData(inm: InmuebleEstudio, st: CreativeState): CreativeData {
  const base = baseFields(inm, st);
  const f = { ...base } as CreativeData['f'];
  (Object.keys(base) as FieldKey[]).forEach((k) => { const o = st.overrides[k]; if (o != null) f[k] = o; });
  const antes = inm.precioAnterior && inm.precioAnterior > inm.precio ? inm.precioAnterior : null;
  f.antes = antes ? eur(antes) : '';
  f.dto = antes ? '-' + Math.round((1 - inm.precio / antes) * 100) + '%' : '';

  const sh = {} as CreativeData['sh'];
  (Object.keys(base) as FieldKey[]).forEach((k) => { sh[k] = !st.hidden[k]; });
  if (!f.energia) sh.energia = false;

  const nHab = Number(f.hab) || 0, nBan = Number(f.banos) || 0;
  const specs = ([
    { k: 'm2', v: f.m2, u: 'm²', l: 'Superficie' },
    { k: 'hab', v: f.hab, u: nHab === 1 ? 'dormitorio' : 'dormitorios', l: 'Dormitorios' },
    { k: 'banos', v: f.banos, u: nBan === 1 ? 'baño' : 'baños', l: 'Baños' },
  ] as Spec[]).filter((s) => sh[s.k]);

  const order = resolveSlots(st.slots, inm.fotos.length).map((i) => inm.fotos[i]);
  const millones = inm.precio >= 1e6;
  return {
    c: THEMES[st.theme], ty: TYPOS[st.typo], f, sh, specs,
    ph: order.map((p) => (p ? `url("${p.url}")` : 'none')), pf: order.map(() => 'none'), phName: order.map((p) => p?.nombre ?? ''),
    barrio: inm.barrio, m2: inm.m2,
    escala: escalaDelFormato(st.escala, st.format), pos: posDelFormato(st.pos, st.format),
    bigNum: millones ? (inm.precio / 1e6).toLocaleString('es-ES', { maximumFractionDigits: 2 }) : String(Math.round(inm.precio / 1000)),
    bigUnit: millones ? 'millones de euros' : 'mil euros',
  };
}
