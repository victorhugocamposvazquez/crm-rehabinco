"use client";
/**
 * Estado de la publicación con deshacer y rehacer.
 * Añadir, quitar, mover y editar pantallas pasa por aquí.
 */
import { useCallback, useReducer } from "react";
import { MAX_SLIDES, type TemplateId } from "./config";
import { defaultHidden, initialPublication, makeSlide, nextUnusedPhoto, type Publication, type Slide } from "./publicacion";

type Hist = { present: Publication; past: Publication[]; future: Publication[]; tag: string; at: number };
type Patch = Partial<Publication> | ((p: Publication) => Partial<Publication>);
type Action =
  | { type: "edit"; patch: Patch; tag?: string; at: number }
  | { type: "undo" } | { type: "redo" } | { type: "reset"; pub: Publication };

const MAX_HISTORY = 80;
const COALESCE_MS = 900;

function reducer(h: Hist, a: Action): Hist {
  switch (a.type) {
    case "edit": {
      const patch = typeof a.patch === "function" ? a.patch(h.present) : a.patch;
      if (!Object.keys(patch).length) return h;
      const same = !!a.tag && a.tag === h.tag && a.at - h.at < COALESCE_MS;
      return { present: { ...h.present, ...patch }, past: same ? h.past : [...h.past, h.present].slice(-MAX_HISTORY), future: [], tag: a.tag ?? "", at: a.at };
    }
    case "undo":
      return h.past.length ? { present: h.past[h.past.length - 1], past: h.past.slice(0, -1), future: [h.present, ...h.future], tag: "", at: 0 } : h;
    case "redo":
      return h.future.length ? { present: h.future[0], past: [...h.past, h.present], future: h.future.slice(1), tag: "", at: 0 } : h;
    case "reset":
      return { present: a.pub, past: [], future: [], tag: "", at: 0 };
  }
}

export function usePublication(initial: Publication = initialPublication()) {
  const [h, dispatch] = useReducer(reducer, { present: initial, past: [], future: [], tag: "", at: 0 });
  const pub = h.present;
  const edit = useCallback((patch: Patch, tag?: string) => dispatch({ type: "edit", patch, tag, at: Date.now() }), []);

  const editSlide = useCallback((index: number, fn: Partial<Slide> | ((s: Slide) => Partial<Slide>), tag?: string) =>
    edit((p) => ({ slides: p.slides.map((s, i) => (i === index ? { ...s, ...(typeof fn === "function" ? fn(s) : fn) } : s)) }), tag), [edit]);

  /** Inserta una pantalla justo después de `after`. Devuelve el índice nuevo. */
  const insertAfter = useCallback((after: number, slide: Slide): number => {
    const at = Math.min(after + 1, pub.slides.length);
    if (pub.slides.length >= MAX_SLIDES) return after;
    edit((p) => { const a = p.slides.slice(); a.splice(Math.min(after + 1, p.slides.length), 0, slide); return { slides: a }; });
    return at;
  }, [edit, pub.slides.length]);

  const remove = useCallback((index: number) => edit((p) => (p.slides.length > 1 ? { slides: p.slides.filter((_, i) => i !== index) } : {})), [edit]);

  const move = useCallback((from: number, to: number) => edit((p) => {
    if (to < 0 || to >= p.slides.length || from === to) return {};
    const a = p.slides.slice(); const [x] = a.splice(from, 1); a.splice(to, 0, x); return { slides: a };
  }), [edit]);

  const photoCount = pub.slides.filter((s) => s.template === "foto").length;
  const hasClosing = pub.slides.some((s) => s.template === "contacto");

  const addPhoto = useCallback((nFotos: number) => edit((p) => {
    if (p.slides.length >= MAX_SLIDES) return {};
    const idx = p.slides.map((s, i) => (s.template === "foto" ? i : -1)).filter((i) => i >= 0);
    const at = (idx.length ? idx[idx.length - 1] : 0) + 1;
    const a = p.slides.slice(); a.splice(at, 0, makeSlide("foto", nextUnusedPhoto(p, nFotos))); return { slides: a };
  }), [edit]);

  const removePhoto = useCallback(() => edit((p) => {
    const idx = p.slides.map((s, i) => (s.template === "foto" ? i : -1)).filter((i) => i >= 0);
    return idx.length ? { slides: p.slides.filter((_, i) => i !== idx[idx.length - 1]) } : {};
  }), [edit]);

  const toggleClosing = useCallback(() => edit((p) => (p.slides.some((s) => s.template === "contacto")
    ? { slides: p.slides.filter((s) => s.template !== "contacto") }
    : p.slides.length < MAX_SLIDES ? { slides: [...p.slides, makeSlide("contacto", 0)] } : {})), [edit]);

  const setTemplate = useCallback((index: number, t: TemplateId) => editSlide(index, (s) => ({ template: t, hidden: s.template === t ? s.hidden : defaultHidden(t) })), [editSlide]);

  return {
    pub, edit, editSlide, insertAfter, remove, move, addPhoto, removePhoto, toggleClosing, setTemplate, photoCount, hasClosing,
    undo: useCallback(() => dispatch({ type: "undo" }), []),
    redo: useCallback(() => dispatch({ type: "redo" }), []),
    reset: useCallback((p: Publication) => dispatch({ type: "reset", pub: p }), []),
    canUndo: h.past.length > 0,
    canRedo: h.future.length > 0,
  };
}
