/** Una publicación es una lista ordenada. Cada pieza es una foto del inmueble o un diseño. */
import type { FormatId, TemplateId } from "./config";
import { buildCreativeData, resolveSlots, type CreativeState, type InmuebleEstudio } from "./data";

export const MAX_COMPOSICION = 10;

export type PiezaComposicion =
  | { tipo: "foto"; foto: number }
  | { tipo: "diseno"; template: TemplateId };

/** El carrusel de Instagram admite cuadrado y 4:5. La story va aparte. */
export const FORMATOS_COMPOSICION = ["post", "feed"] as const;

export function datosDePieza(inm: InmuebleEstudio, st: CreativeState, pieza: PiezaComposicion, format: FormatId) {
  if (pieza.tipo === "foto") {
    const n = Math.max(1, inm.fotos.length);
    const foto = ((pieza.foto % n) + n) % n;
    const resto = resolveSlots(st.slots, n).filter((i) => i !== foto);
    return buildCreativeData(inm, { ...st, format, template: "foto", slots: [foto, ...resto] });
  }
  const overrides = { ...st.overrides };
  if (pieza.template !== st.template) {
    delete overrides.titulo;
    delete overrides.cta;
  }
  return buildCreativeData(inm, { ...st, format, template: pieza.template, overrides });
}
