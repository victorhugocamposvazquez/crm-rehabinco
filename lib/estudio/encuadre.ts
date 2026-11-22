/** Cómo se recorta una foto dentro de su hueco. 1 y 0 dejan el encuadre de la plantilla. */
export type EncuadreFoto = { zoom: number; x: number; y: number; rot: number; voltear?: boolean };

export const ENCUADRE_BASE: EncuadreFoto = { zoom: 1, x: 0, y: 0, rot: 0 };

export function encuadreDe(raw: unknown): EncuadreFoto {
  if (!raw || typeof raw !== "object") return ENCUADRE_BASE;
  const o = raw as Partial<EncuadreFoto>;
  const zoom = typeof o.zoom === "number" && Number.isFinite(o.zoom) ? Math.min(3, Math.max(1, o.zoom)) : 1;
  const x = typeof o.x === "number" && Number.isFinite(o.x) ? Math.max(-80, Math.min(80, o.x)) : 0;
  const y = typeof o.y === "number" && Number.isFinite(o.y) ? Math.max(-80, Math.min(80, o.y)) : 0;
  const rot = typeof o.rot === "number" && Number.isFinite(o.rot) ? ((o.rot % 360) + 360) % 360 : 0;
  return o.voltear === true ? { zoom, x, y, rot, voltear: true } : { zoom, x, y, rot };
}

/** Grados finos respecto al cuarto de vuelta más cercano, entre −45 y 45. */
export function enderezarDe(rot: number): number {
  const n = ((rot % 360) + 360) % 360;
  const cuarto = Math.round(n / 90) * 90;
  let delta = n - cuarto;
  if (delta > 45) delta -= 90;
  if (delta < -45) delta += 90;
  return delta;
}

/** Deja el cuarto de vuelta y cambia solo el enderezo. */
export function conEnderezar(rot: number, grados: number): number {
  const fino = Math.max(-45, Math.min(45, grados));
  const n = ((rot % 360) + 360) % 360;
  const cuarto = Math.round(n / 90) * 90;
  return ((cuarto + fino) % 360 + 360) % 360;
}

/**
 * Al girar, la foto tiene que seguir tapando el hueco.
 * `proporcion` es ancho/alto del hueco. En un cuadrado, 90° no amplía; unos pocos grados casi tampoco.
 */
export function escalaEncuadre(enc: EncuadreFoto, proporcion = 1): number {
  const rad = (enc.rot * Math.PI) / 180;
  const lado = Math.max(proporcion, 1 / Math.max(proporcion, 1e-3));
  return (Math.abs(Math.cos(rad)) + lado * Math.abs(Math.sin(rad))) * enc.zoom;
}

export function transformEncuadre(raw: unknown, proporcion = 1): string {
  const enc = encuadreDe(raw);
  const escala = Math.round(escalaEncuadre(enc, proporcion) * 1000) / 1000;
  const giro = enc.voltear ? " scaleX(-1)" : "";
  return `translate(${enc.x}%, ${enc.y}%) rotate(${enc.rot}deg) scale(${escala})${giro}`;
}
