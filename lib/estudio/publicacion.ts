/**
 * Una publicación es una lista ordenada de pantallas (1 = imagen suelta, 2-10 = carrusel).
 * Cada pantalla tiene su diseño, sus datos ocultos, sus textos y sus fotos.
 * Formato, color, tipografía de base, objetivo y zona son de la publicación.
 * El tamaño, la posición y la tipografía de cada texto van aparte, por formato.
 */
import type { CreativeData } from "@/components/estudio/templates";
import { MAX_SLIDES, type FieldKey, type FormatId, type GoalId, type TemplateId, type ThemeId, type TypoId } from "./config";
import type { EncuadreFoto } from "./encuadre";
import { buildCreativeData, resolveSlots, type CreativeState, type InmuebleEstudio } from "./data";

export type Slide = {
  id: string;
  template: TemplateId;
  hidden: Partial<Record<FieldKey, boolean>>;
  overrides: Partial<Record<FieldKey, string>>;
  /** Índice de foto por hueco. null = orden de la ficha. */
  slots: number[] | null;
  /** Zoom, desplazamiento y giro de cada hueco de esta pantalla. */
  encuadre?: Partial<Record<number, EncuadreFoto>>;
};

export type Publication = {
  goal: GoalId;
  format: FormatId;
  theme: ThemeId;
  typo: TypoId;
  soloZona: boolean;
  slides: Slide[];
  /** Tamaño de letra por formato. Post y Story no se comparten. */
  escala: CreativeState["escala"];
  /** Desplazamiento por formato. */
  pos: CreativeState["pos"];
  /** Tipografía de cada texto, por formato. */
  tipografia: CreativeState["tipografia"];
};

let seq = 0;
const newId = () => `s${Date.now().toString(36)}${(seq++).toString(36)}`;

const generica = (nombre: string) => /^foto\s*\d+$/i.test(nombre.trim());

/** Datos ocultos por defecto según el tipo de pantalla. Hogar deja el teléfono a la vista. */
export function defaultHidden(t: TemplateId): Slide["hidden"] {
  if (t === "contacto") return { ref: true };
  if (t === "foto") return { pie: true };
  if (t === "hogar") return { ref: true, agente: true };
  return { ref: true, tel: true, agente: true };
}

export function makeSlide(template: TemplateId, photo: number | null = null): Slide {
  return {
    id: newId(),
    template,
    hidden: defaultHidden(template),
    overrides: {},
    slots: photo == null ? null : [photo, photo + 1, photo + 2, photo + 3, photo + 4],
  };
}

/** Se empieza con una sola imagen. El carrusel se arma después. */
export function initialPublication(template: TemplateId = "galeria"): Publication {
  return {
    goal: "nuevo", format: "feed", theme: "blanco", typo: "editorial", soloZona: true,
    slides: [makeSlide(template)], escala: {}, pos: {}, tipografia: {},
  };
}

export function slideToState(pub: Publication, slide: Slide): CreativeState {
  return {
    goal: pub.goal,
    template: slide.template,
    format: pub.format,
    theme: pub.theme,
    typo: pub.typo,
    hidden: slide.hidden,
    overrides: slide.overrides,
    slots: slide.slots,
    soloZona: pub.soloZona,
    escala: pub.escala,
    pos: pub.pos,
    tipografia: pub.tipografia ?? {},
  };
}

/** Une ficha + publicación + pantalla. Pasa por `buildCreativeData` para no perder hogar, visita ni el ajuste por formato. */
export function buildSlideData(inm: InmuebleEstudio, pub: Publication, slide: Slide): CreativeData {
  const data = buildCreativeData(inm, slideToState(pub, slide));
  data.encuadre = slide.encuadre ?? {};
  if (slide.overrides.pie == null) {
    const nombre = data.phName[0]?.trim() ?? "";
    data.f.pie = generica(nombre) ? "" : nombre;
  }
  if (!data.f.pie) data.sh.pie = false;
  return data;
}

/** Fotos ya usadas como pantalla «Foto». */
export function usedPhotoIndexes(pub: Publication, nFotos: number): number[] {
  return pub.slides.filter((s) => s.template === "foto").map((s) => resolveSlots(s.slots, nFotos)[0]);
}

/** Siguiente foto que todavía no está en el carrusel. Empieza por la segunda: la primera suele ir en la portada. */
export function nextUnusedPhoto(pub: Publication, nFotos: number): number {
  const n = Math.max(1, nFotos);
  const used = usedPhotoIndexes(pub, n);
  for (let j = 1; j <= n; j++) if (!used.includes(j % n)) return j % n;
  return 1 % n;
}

export function slideLabel(inm: InmuebleEstudio, slide: Slide, templateName: (t: TemplateId) => string): string {
  if (slide.template === "foto") {
    const nombre = inm.fotos[resolveSlots(slide.slots, inm.fotos.length)[0]]?.nombre?.trim() ?? "";
    return !nombre || generica(nombre) ? "Foto" : nombre;
  }
  if (slide.template === "contacto") return "Contacto";
  return templateName(slide.template);
}

export function cabeOtraPantalla(n: number) {
  return n < MAX_SLIDES;
}
