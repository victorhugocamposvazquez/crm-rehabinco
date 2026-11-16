'use client';
/** Estado de una creatividad con deshacer / rehacer. Las pulsaciones seguidas en un mismo campo cuentan como un solo paso. */
import { useCallback, useReducer } from 'react';
import { initialCreativeState, type CreativeState } from "./data";

type Patch = Partial<CreativeState> | ((s: CreativeState) => Partial<CreativeState>);
type Hist = { present: CreativeState; past: CreativeState[]; future: CreativeState[]; tag: string; at: number };
type Action =
  | { type: 'edit'; patch: Patch; tag?: string; at: number }
  | { type: 'undo' } | { type: 'redo' }
  | { type: 'reset'; state: CreativeState };

const MAX_HISTORY = 80;
const COALESCE_MS = 900;

function reducer(h: Hist, a: Action): Hist {
  switch (a.type) {
    case 'edit': {
      const patch = typeof a.patch === 'function' ? a.patch(h.present) : a.patch;
      const same = !!a.tag && a.tag === h.tag && a.at - h.at < COALESCE_MS;
      const past = same ? h.past : [...h.past, h.present].slice(-MAX_HISTORY);
      return { present: { ...h.present, ...patch }, past, future: [], tag: a.tag ?? '', at: a.at };
    }
    case 'undo':
      if (!h.past.length) return h;
      return { present: h.past[h.past.length - 1], past: h.past.slice(0, -1), future: [h.present, ...h.future], tag: '', at: 0 };
    case 'redo':
      if (!h.future.length) return h;
      return { present: h.future[0], past: [...h.past, h.present], future: h.future.slice(1), tag: '', at: 0 };
    case 'reset':
      return { present: a.state, past: [], future: [], tag: '', at: 0 };
  }
}

export function useCreative(initial: CreativeState = initialCreativeState) {
  const [h, dispatch] = useReducer(reducer, { present: initial, past: [], future: [], tag: '', at: 0 });
  /** `tag` agrupa cambios seguidos (p. ej. `type:titulo` mientras se escribe). */
  const edit = useCallback((patch: Patch, tag?: string) => dispatch({ type: 'edit', patch, tag, at: Date.now() }), []);
  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const redo = useCallback(() => dispatch({ type: 'redo' }), []);
  /** Al cambiar de inmueble: estado nuevo y sin historial. */
  const reset = useCallback((state: CreativeState = initialCreativeState) => dispatch({ type: 'reset', state }), []);
  return { state: h.present, edit, undo, redo, reset, canUndo: h.past.length > 0, canRedo: h.future.length > 0 };
}
