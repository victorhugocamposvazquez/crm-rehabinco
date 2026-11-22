/** Cómo se recorta una foto dentro de su hueco. 1 y 0 dejan el encuadre de la plantilla. */
export type EncuadreFoto = { zoom: number; x: number; y: number; rot: number };

export const ENCUADRE_BASE: EncuadreFoto = { zoom: 1, x: 0, y: 0, rot: 0 };

export function encuadreDe(raw: unknown): EncuadreFoto {
  if (!raw || typeof raw !== "object") return ENCUADRE_BASE;
  const o = raw as Partial<EncuadreFoto>;
  const zoom = typeof o.zoom === "number" && Number.isFinite(o.zoom) ? Math.min(3, Math.max(1, o.zoom)) : 1;
  const x = typeof o.x === "number" && Number.isFinite(o.x) ? Math.max(-80, Math.min(80, o.x)) : 0;
  const y = typeof o.y === "number" && Number.isFinite(o.y) ? Math.max(-80, Math.min(80, o.y)) : 0;
  const rot = typeof o.rot === "number" && Number.isFinite(o.rot) ? ((o.rot % 360) + 360) % 360 : 0;
  return { zoom, x, y, rot };
}

/** Al girar, la foto tiene que seguir tapando el hueco. En 0° el zoom del usuario manda solo. */
export function escalaEncuadre(enc: EncuadreFoto): number {
  const a = ((enc.rot % 180) * Math.PI) / 180;
  const cubre = Math.abs(Math.cos(a)) + 2.05 * Math.abs(Math.sin(a));
  return cubre * enc.zoom;
}

export function transformEncuadre(raw: unknown): string {
  const enc = encuadreDe(raw);
  return `translate(${enc.x}%, ${enc.y}%) rotate(${enc.rot}deg) scale(${escalaEncuadre(enc)})`;
}
