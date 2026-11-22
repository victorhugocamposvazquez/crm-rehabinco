/** Cómo se recorta una foto dentro de su hueco. 1 y 0 dejan el encuadre de la plantilla. */
export type EncuadreFoto = {
  zoom: number;
  x: number;
  y: number;
  rot: number;
  voltear?: boolean;
  /** Perspectiva vertical, de −100 a 100. 0 es el plano de la foto. */
  vertical?: number;
  /** Perspectiva horizontal, de −100 a 100. */
  horizontal?: number;
};

export const ENCUADRE_BASE: EncuadreFoto = { zoom: 1, x: 0, y: 0, rot: 0 };

export function encuadreDe(raw: unknown): EncuadreFoto {
  if (!raw || typeof raw !== "object") return ENCUADRE_BASE;
  const o = raw as Partial<EncuadreFoto>;
  const zoom = typeof o.zoom === "number" && Number.isFinite(o.zoom) ? Math.min(3, Math.max(1, o.zoom)) : 1;
  const x = typeof o.x === "number" && Number.isFinite(o.x) ? Math.max(-80, Math.min(80, o.x)) : 0;
  const y = typeof o.y === "number" && Number.isFinite(o.y) ? Math.max(-80, Math.min(80, o.y)) : 0;
  const rot = typeof o.rot === "number" && Number.isFinite(o.rot) ? ((o.rot % 360) + 360) % 360 : 0;
  const vertical = eje(o.vertical);
  const horizontal = eje(o.horizontal);
  return {
    zoom, x, y, rot,
    ...(o.voltear === true ? { voltear: true } : {}),
    ...(vertical ? { vertical } : {}),
    ...(horizontal ? { horizontal } : {}),
  };
}

function eje(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.max(-100, Math.min(100, Math.round(n)));
}

/** Hay giro, zoom, desplazamiento, volteo o perspectiva. */
export function encuadreTocado(raw: unknown): boolean {
  const enc = encuadreDe(raw);
  return enc.zoom !== 1 || enc.x !== 0 || enc.y !== 0 || enc.rot !== 0 || enc.voltear === true || enc.vertical != null || enc.horizontal != null;
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

/** Grados de inclinación a tope de deslizador. Con 0 la foto sigue plana. */
const TOPE_PERSPECTIVA = 30;

function gradosPerspectiva(valor: number): number {
  return Math.round((valor / 100) * TOPE_PERSPECTIVA * 10) / 10;
}

/**
 * Al inclinar, el borde que se aleja se encoge. Esto lo amplía para que siga tapando el hueco.
 * La distancia de cámara es 1,35 veces el alto, la misma que usa `transformEncuadre`.
 */
export function escalaPerspectiva(enc: EncuadreFoto): number {
  const factor = (grados: number) => {
    const s = Math.sin((Math.abs(grados) * Math.PI) / 180);
    return (1.35 + 0.5 * s) / 1.35;
  };
  return factor(gradosPerspectiva(enc.vertical ?? 0)) * factor(gradosPerspectiva(enc.horizontal ?? 0));
}

/** `altoPx` es el alto del hueco. La perspectiva va en píxeles y tiene que crecer con la foto. */
export function transformEncuadre(raw: unknown, proporcion = 1, altoPx = 0): string {
  const enc = encuadreDe(raw);
  const escala = Math.round(escalaEncuadre(enc, proporcion) * escalaPerspectiva(enc) * 1000) / 1000;
  const giro = enc.voltear ? " scaleX(-1)" : "";
  const plano = `translate(${enc.x}%, ${enc.y}%) rotate(${enc.rot}deg) scale(${escala})${giro}`;
  const v = enc.vertical ?? 0;
  const h = enc.horizontal ?? 0;
  if (!v && !h) return plano;
  const alto = altoPx > 0 ? altoPx : 1000;
  const partes = [`perspective(${Math.round(alto * 1.35)}px)`];
  if (v) partes.push(`rotateX(${gradosPerspectiva(v)}deg)`);
  if (h) partes.push(`rotateY(${gradosPerspectiva(h)}deg)`);
  return `${plano} ${partes.join(" ")}`;
}
