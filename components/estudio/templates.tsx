'use client';
/**
 * Estudio de creatividades · motor de plantillas.
 *
 * Cada plantilla es una función pura (x: Ctx) => nodos, posicionada en % y con el texto en `em`
 * sobre el `font-size` de la raíz. Por eso la MISMA función sirve para la miniatura de la galería,
 * el lienzo del editor y la exportación a 1080 px: solo cambian W y H.
 *
 * Reglas al tocar una plantilla:
 *  - Todo dato del inmueble va envuelto en `x.fld(clave, estilo, ...)`: así se puede ocultar (ojo) y seleccionar al hacer clic.
 *  - Toda foto va con `x.pic(hueco, estilo)`: así se puede elegir qué foto ocupa cada hueco.
 *  - Nada de px fijos salvo los calculados a partir de x.W / x.H; usa %, em y x.tall / x.wide para adaptar el formato.
 */
import { createElement as h, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { MarcaRehabinco } from "@/components/estudio/marca";
import { FONT, FUENTES, TYPOS, type EstiloTexto, type TemplateId, type Theme, type Typo, type FieldKey } from "@/lib/estudio/config";
import { encuadreDe, transformEncuadre, type EncuadreFoto } from "@/lib/estudio/encuadre";

export type Spec = { k: 'm2' | 'hab' | 'banos'; v: string; u: string; l: string };

/** Datos ya resueltos (ficha + ediciones del usuario) que recibe una plantilla. Lo construye `buildCreativeData`. */
export type CreativeData = {
  c: Theme; ty: Typo;
  /** Valores de texto por clave (más `antes` y `dto` para la bajada de precio). */
  f: Record<FieldKey | 'antes' | 'dto', string>;
  /** Visible / oculto por clave. */
  sh: Record<FieldKey, boolean>;
  /** Superficie, dormitorios y baños visibles, en ese orden. */
  specs: Spec[];
  /** Fotos por hueco: valor CSS `url(...)`, filtro CSS de la edición con IA y nombre de la estancia. */
  ph: string[]; pf: string[]; phName: string[];
  barrio: string; m2: number; email: string;
  /** Precio en grande para «Precio XXL»: «525» + «mil euros». */
  bigNum: string; bigUnit: string;
  escala: Partial<Record<FieldKey, number>>;
  pos: Partial<Record<FieldKey, { x: number; y: number }>>;
  /** Fuente, negrita y cursiva pedidas para ese texto. Si falta, se queda la plantilla. */
  fuentes: Partial<Record<FieldKey, EstiloTexto>>;
  /** Zoom, movimiento y giro por hueco de foto. */
  encuadre?: Partial<Record<number, EncuadreFoto>>;
};

type Sel = {
  sel?: string;
  onSel?: (key: string) => void;
  onMove?: (key: FieldKey, pos: { x: number; y: number }) => void;
  onEncuadre?: (slot: number, enc: EncuadreFoto) => void;
};
type StatsOpts = { size?: number; center?: boolean; short?: boolean; line?: string; mut?: string };
type Ctx = CreativeData & Sel & {
  W: number; H: number; fs: number; tall: boolean; wide: boolean; edit: boolean;
  fld: (key: FieldKey, style: CSSProperties, ...kids: ReactNode[]) => ReactElement | null;
  pic: (i: number, style: CSSProperties) => ReactElement;
  stats: (o: StatsOpts) => ReactElement;
  foot: (color: string) => ReactElement;
};

const SERIF = FONT.serif, BEBAS = FONT.bebas, MONO = FONT.mono;
const d = (s: CSSProperties, ...k: ReactNode[]) => h('div', { style: s }, ...k);
const sp = (s: CSSProperties, ...k: ReactNode[]) => h('span', { style: s }, ...k);
const ab = (...o: CSSProperties[]): CSSProperties => Object.assign({ position: 'absolute' } as CSSProperties, ...o);
const bg = (u: string, f?: string, o?: CSSProperties): CSSProperties => Object.assign({ backgroundImage: u, backgroundSize: 'cover', backgroundPosition: 'center', filter: f || 'none' }, o || {});
const HD = (x: Ctx, size: number, o?: CSSProperties): CSSProperties => Object.assign({ fontFamily: x.ty.ff, fontWeight: x.ty.fw, textTransform: x.ty.tt, letterSpacing: x.ty.ls, fontSize: (size * x.ty.k).toFixed(3) + 'em', lineHeight: x.ty.lh } as CSSProperties, o || {});
/** Ancho en em, nunca en porcentaje: si no, el SVG vuelve a sus 499 px y se corta. */
const logo = (color: string, size: number, align?: 'left' | 'right' | 'center') => {
  const ancho = (size >= 0.9 ? 12 : size >= 0.45 ? 7.2 : size >= 0.4 ? 6.8 : size >= 0.36 ? 6.2 : 5.2) + 'em';
  return d({ display: 'flex', justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start', width: ancho, lineHeight: 0 },
    h(MarcaRehabinco, { color, width: ancho }));
};
const WD: Record<string, string> = { lun: 'Lunes', mar: 'Martes', mié: 'Miércoles', jue: 'Jueves', vie: 'Viernes', sáb: 'Sábado', dom: 'Domingo' };
/** «Sáb 21 nov» → { dia: '21', mes: 'NOV', wd: 'Sábado' } para la hoja de calendario. */
const parseEv = (s: string) => { const parts = (s || '').trim().split(/\s+/); const dia = (s.match(/\d+/) || ['21'])[0]; const mes = (parts[parts.length - 1] || 'nov').slice(0, 3).toUpperCase(); return { dia, mes, wd: WD[(parts[0] || '').toLowerCase().slice(0, 3)] || '' }; };
const EN_COLOR: Record<string, string> = { A: '#118C4F', B: '#4BA845', C: '#B7CF2D', D: '#E9D21B', E: '#EF9B1C', F: '#E5531E', G: '#D11E26' };
const pieFoto = (name: string) => (/^foto\s*\d+$/i.test((name || '').trim()) ? '' : name);
const camino = (d: string) => h('path', { d, strokeLinecap: 'round', strokeLinejoin: 'round' });
const icono = (...nodos: ReactNode[]) => h('svg', { viewBox: '0 0 24 24', width: '1.15em', height: '1.15em', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, 'aria-hidden': true, style: { flex: '0 0 auto', display: 'block' } }, ...nodos);
const ICO_TEL = 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z';
const ICO_PIN = 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z';
type Box = [string, string, string, string, number];

const R: Record<TemplateId, (x: Ctx) => ReactNode[]> = {
  foto: (x) => [
    x.pic(0, { position: 'absolute', inset: 0 }),
    x.fld('pie', ab({ left: '5%', bottom: '5%', fontSize: '.58em', fontWeight: 600, background: 'rgba(0,0,0,.6)', color: '#fff', padding: '.5em 1em', borderRadius: '99px' }), x.f.pie),
    x.fld('logo', ab({ right: '5%', bottom: '5.5%', textShadow: '0 1px 8px rgba(0,0,0,.65)' }), logo('#fff', .42, 'right')),
  ],
  hogar: x => { const { f, c } = x;
    const nHab = Number(f.hab) || 0, nBan = Number(f.banos) || 0;
    const hab = `${f.hab} ${nHab === 1 ? 'habitación' : 'habitaciones'}`;
    const ban = `${f.banos} ${nBan === 1 ? 'baño' : 'baños'}`;
    const foto = (i: number, o?: CSSProperties) => d(Object.assign({ position: 'relative', overflow: 'hidden', minHeight: 0 }, o || {}), x.pic(i, { position: 'absolute', inset: 0 }));
    return [d(ab({ inset: 0, display: 'flex', flexDirection: 'column', padding: x.wide ? '3.2% 4% 2.6%' : '4.4% 5% 3.4%', background: c.bg, color: c.fg, gap: x.wide ? '.4em' : '.65em' }),
      d({ display: 'flex', justifyContent: 'center' }, x.fld('logo', {}, logo(c.fg, .95, 'center'))),
      x.fld('titulo', { fontFamily: SERIF, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.12em', textAlign: 'center', fontSize: x.wide ? '1.05em' : x.tall ? '1.8em' : '1.5em', lineHeight: 1.05, margin: '0 3%' }, f.titulo),
      d({ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1.35fr 1fr', gridTemplateRows: '1fr 1fr', gap: '.28em' }, foto(0, { gridRow: '1 / 3' }), foto(1), foto(2)),
      d({ display: 'flex', background: c.fg, color: c.bg },
        d({ flex: '1.25 1 0', minWidth: 0, padding: '.75em .9em .85em' },
          d({ fontSize: '.36em', letterSpacing: '.16em', fontWeight: 650, opacity: .72 }, 'CARACTERÍSTICAS'),
          d({ fontSize: '.7em', lineHeight: 1.25, marginTop: '.28em', fontWeight: 500 }, x.fld('hab', { display: 'inline' }, hab), x.sh.hab && x.sh.banos ? ', ' : null, x.fld('banos', { display: 'inline' }, ban))),
        d({ width: '1px', background: c.bg, opacity: .28, margin: '.65em 0' }),
        d({ flex: '.8 1 0', minWidth: 0, padding: '.75em .9em .85em' },
          d({ fontSize: '.36em', letterSpacing: '.16em', fontWeight: 650, opacity: .72 }, 'PRECIO'),
          x.fld('precio', { fontSize: '1.15em', fontWeight: 650, letterSpacing: '-.03em', marginTop: '.12em', whiteSpace: 'nowrap' }, f.precio))),
      d({ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1em', fontSize: '.44em', lineHeight: 1.3 },
        d({ display: 'flex', flexDirection: 'column', gap: '.4em', minWidth: 0 },
          x.fld('tel', { display: 'flex', alignItems: 'center', gap: '.45em' }, icono(camino(ICO_TEL)), f.tel),
          d({ display: 'flex', alignItems: 'center', gap: '.45em' }, icono(camino('M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z'), h('polyline', { points: '22,6 12,13 2,6', strokeLinecap: 'round', strokeLinejoin: 'round' })), x.email)),
        x.fld('zona', { display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', gap: '.4em', maxWidth: '54%', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '.03em', fontWeight: 650 }, icono(camino(ICO_PIN), h('circle', { cx: 12, cy: 10, r: 2.6 })), f.zona)))]; },

  visita: x => { const { f, c } = x;
    return [d(ab({ inset: 0, display: 'flex', flexDirection: 'column', padding: x.wide ? '3% 4% 3%' : '4.8% 6% 4.2%', background: c.bg, color: c.fg, textAlign: 'center' }),
      d({ display: 'flex', justifyContent: 'center' }, x.fld('logo', {}, logo(c.fg, .95, 'center'))),
      x.fld('titulo', { fontFamily: SERIF, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.045em', fontSize: x.wide ? '1.2em' : x.tall ? '2em' : '1.68em', lineHeight: .98, marginTop: x.wide ? '.3em' : '.65em' }, f.titulo),
      x.fld('cta', { fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: x.wide ? '.52em' : '.7em', lineHeight: 1.35, marginTop: '.5em' }, f.cta),
      d({ width: '2.2em', height: '.07em', background: c.fg, margin: '.65em auto .55em' }),
      x.fld('zona', { fontSize: '.56em', fontWeight: 650 }, f.zona),
      d({ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', marginTop: '.75em' }, x.pic(0, { position: 'absolute', inset: 0 })))]; },

  galeria: x => { const { f, c } = x; const g = '.45em';
    const cell = (i: number, o?: CSSProperties) => d(Object.assign({ position: 'relative', overflow: 'hidden', minHeight: 0 }, o || {}), x.pic(i, { position: 'absolute', inset: 0 }));
    const grid = x.wide
      ? d(ab({ left: '4%', top: '9%', width: '52%', bottom: '9%', display: 'grid', gridTemplateColumns: '1.5fr 1fr', gridTemplateRows: '1fr 1fr', gap: g }), cell(0, { gridRow: '1 / 3' }), cell(1), cell(2))
      : d(ab({ left: '5%', right: '5%', top: '12.5%', height: x.tall ? '53%' : '52%', display: 'grid', gridTemplateColumns: x.tall ? '1fr 1fr' : '1.6fr 1fr', gridTemplateRows: x.tall ? '1.7fr 1fr' : '1fr 1fr', gap: g }),
          cell(0, x.tall ? { gridColumn: '1 / 3' } : { gridRow: '1 / 3' }), cell(1), cell(2));
    return [
      d(ab(x.wide ? { left: '60%', right: '5%', top: '9%' } : { left: '5%', right: '5%', top: '4.6%' }, { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }),
        x.fld('logo', {}, logo(c.fg, .42)), x.fld('badge', { fontFamily: SERIF, fontStyle: 'italic', fontSize: '.62em', color: c.acc }, f.badge)),
      grid,
      d(ab(x.wide ? { left: '60%', right: '5%', bottom: '9%' } : { left: '5%', right: '5%', bottom: '5%' }),
        x.fld('titulo', HD(x, 1.25, { fontStyle: x.ty.it, maxWidth: '92%' }), f.titulo),
        d({ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1em', borderTop: '1px solid ' + c.line, marginTop: '.6em', paddingTop: '.55em' },
          d({ minWidth: 0 }, x.fld('zona', { fontSize: '.56em', fontWeight: 600, marginBottom: '.45em' }, f.zona), x.stats({ size: 1.2 })),
          x.fld('precio', { fontSize: '1.6em', fontWeight: 700, letterSpacing: '-.03em', whiteSpace: 'nowrap' }, f.precio)))
    ]; },

  triptico: x => { const { f, c } = x; const n = x.wide ? 4 : 3;
    const strip = (i: number) => d({ flex: '1 1 0', position: 'relative', overflow: 'hidden', borderRadius: '999px 999px .4em .4em', marginTop: i % 2 ? '2.4em' : '0', marginBottom: i % 2 ? '0' : '2.4em' }, x.pic(i, { position: 'absolute', inset: 0 }));
    return [
      x.fld('logo', ab({ left: 0, right: 0, top: '4.5%', display: 'flex', justifyContent: 'center' }), logo(c.fg, .42, 'center')),
      d(ab({ left: '5%', right: '5%', top: x.tall ? '10%' : '12%', height: x.tall ? '50%' : x.wide ? '48%' : '48%', display: 'flex', gap: '.5em' }), ...Array.from({ length: n }, (_, i) => strip(i))),
      x.fld('precio', ab({ left: '50%', top: x.tall ? '56.5%' : x.wide ? '54%' : '55.5%', transform: 'translateX(-50%)', background: c.acc, color: c.accFg, padding: '.45em 1.1em', borderRadius: '99px', fontSize: '1.2em', fontWeight: 700, whiteSpace: 'nowrap', boxShadow: '0 .3em 1em rgba(0,0,0,.18)' }), f.precio),
      d(ab({ left: '8%', right: '8%', bottom: x.wide ? '6%' : '5.5%', textAlign: 'center' }),
        x.fld('badge', { fontFamily: SERIF, fontStyle: 'italic', fontSize: '.6em', color: c.acc }, f.badge),
        x.fld('titulo', HD(x, 1.2, { marginTop: '.2em', fontStyle: x.ty.it }), f.titulo),
        x.fld('zona', { fontSize: '.56em', fontWeight: 600, marginTop: '.5em' }, f.zona), d({ marginTop: '.55em' }, x.stats({ size: 1.2, center: true })))
    ]; },

  bento: x => { const { f, c } = x; const r = '.7em';
    const ph = (i: number, area: string) => d({ gridArea: area, position: 'relative', overflow: 'hidden', borderRadius: r, minHeight: 0 }, x.pic(i, { position: 'absolute', inset: 0 }),
      i === 0 ? x.fld('badge', ab({ left: '.8em', top: '.8em', background: 'rgba(255,255,255,.94)', color: '#141414', fontSize: '.42em', fontWeight: 600, padding: '.6em 1.1em', borderRadius: '99px' }), f.badge) : null);
    const lay = x.tall ? { cols: '1fr 1fr', rows: '1.5fr 1.5fr 1fr 1.25fr', areas: '"a a" "a a" "b c" "i i"' }
      : x.wide ? { cols: '1fr 1fr 1fr 1fr', rows: '1fr 1fr', areas: '"a a b c" "a a i i"' }
      : { cols: '1fr 1fr 1fr', rows: '1fr 1fr 1fr', areas: '"a a b" "a a c" "i i d"' };
    return [
      d(ab({ inset: '4%', display: 'grid', gridTemplateColumns: lay.cols, gridTemplateRows: lay.rows, gridTemplateAreas: lay.areas, gap: '.5em' }),
        ph(0, 'a'), ph(1, 'b'), ph(2, 'c'), x.tall || x.wide ? null : ph(3, 'd'),
        d({ gridArea: 'i', borderRadius: r, background: c.acc, color: c.accFg, padding: '.9em 1em', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 0, overflow: 'hidden' },
          d({ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '.8em' },
            x.fld('titulo', HD(x, 1.02, { fontStyle: x.ty.it }), f.titulo),
            x.fld('logo', { flex: '0 0 auto', opacity: .9 }, logo(c.accFg, .34, 'right'))),
          d({ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '.8em' },
            d({ minWidth: 0 }, x.fld('zona', { fontSize: '.52em', fontWeight: 600, opacity: .85, marginBottom: '.4em' }, f.zona), x.stats({ size: .78, short: true, line: 'rgba(128,128,128,.55)', mut: 'inherit' })),
            x.fld('precio', { fontSize: '1.2em', fontWeight: 700, letterSpacing: '-.02em', whiteSpace: 'nowrap' }, f.precio))))
    ]; },

  moodboard: x => { const { f, c } = x;
    const Lq: { p1: Box; p2: Box; p3: Box; note: Box; st: CSSProperties } = x.tall ? { p1: ['6%', '5%', '62%', '26%', -3], p2: ['44%', '22%', '50%', '20%', 4], p3: ['8%', '40%', '44%', '18%', -2], note: ['10%', '61%', '80%', '31%', 1.5], st: { right: '7%', top: '45%' } }
      : x.wide ? { p1: ['3%', '8%', '30%', '72%', -3], p2: ['30%', '20%', '26%', '56%', 4], p3: ['53%', '8%', '19%', '42%', -3], note: ['58%', '40%', '38%', '52%', 1.5], st: { left: '78%', top: '8%' } }
      : { p1: ['5%', '5%', '52%', '43%', -3], p2: ['54%', '8%', '41%', '32%', 4], p3: ['58%', '45%', '37%', '29%', -3], note: ['6%', '53%', '49%', '41%', 1.5], st: { left: '45%', top: '44%' } };
    const photo = (i: number, [l, t, w, hh, r]: Box, tape: string | null) => d(ab({ left: l, top: t, width: w, height: hh, border: '.32em solid #fff', transform: `rotate(${r}deg)`, boxShadow: '0 .5em 1.3em rgba(40,30,20,.28)', background: '#fff' }),
      x.pic(i, { position: 'absolute', inset: 0 }),
      tape ? d(ab({ left: tape, top: '-.75em', width: '26%', height: '1.25em', background: 'rgba(214,190,140,.7)', transform: 'rotate(-4deg)' })) : null);
    const [nl, nt, nw, nh, nr] = Lq.note;
    return [
      d(ab({ inset: 0, backgroundImage: `radial-gradient(${c.grid} 1px, transparent 1.2px)`, backgroundSize: '.45em .45em' })),
      photo(0, Lq.p1, '36%'), photo(1, Lq.p2, '40%'), photo(2, Lq.p3, null),
      d(ab({ left: nl, top: nt, width: nw, height: nh, background: '#FFFDF6', color: '#2A241C', transform: `rotate(${nr}deg)`, boxShadow: '0 .4em 1.1em rgba(40,30,20,.2)', padding: '1em 1.1em', backgroundImage: 'repeating-linear-gradient(180deg, transparent 0, transparent 1.15em, rgba(70,110,160,.16) 1.15em, rgba(70,110,160,.16) calc(1.15em + 1px))', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }),
        d(ab({ left: '42%', top: '-.7em', width: '22%', height: '1.25em', background: 'rgba(214,190,140,.7)', transform: 'rotate(3deg)' })),
        d({}, x.fld('badge', { fontFamily: SERIF, fontStyle: 'italic', fontSize: '.6em', color: '#9A6A3A' }, f.badge), x.fld('titulo', HD(x, 1.08, { marginTop: '.2em', fontStyle: x.ty.it, color: '#2A241C' }), f.titulo)),
        d({}, x.fld('precio', { fontSize: '1.5em', fontWeight: 700, letterSpacing: '-.03em', whiteSpace: 'nowrap', marginBottom: '.3em' }, f.precio), x.fld('zona', { fontSize: '.52em', fontWeight: 600, marginBottom: '.4em' }, f.zona), x.stats({ size: .9, short: true, line: 'rgba(42,36,28,.3)', mut: 'rgba(42,36,28,.7)' }))),
      d(ab(Lq.st, { width: '4.2em', height: '4.2em', borderRadius: '50%', border: '.12em solid ' + c.acc, color: c.acc, transform: 'rotate(-12deg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', background: c.bg }),
        d(ab({ inset: '.25em', borderRadius: '50%', border: '1px solid ' + c.acc, opacity: .6 })),
        d({ fontSize: '.36em', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', maxWidth: '7em', lineHeight: 1.2 }, x.barrio),
        d({ fontFamily: SERIF, fontStyle: 'italic', fontSize: '.42em', marginTop: '.2em' }, 'A Coruña')),
      x.fld('logo', ab(x.wide ? { left: '3%', bottom: '5%' } : { right: '5%', bottom: '4%' }), logo(c.fg, .36, x.wide ? 'left' : 'right'))
    ]; },

  formas: x => { const { f, c } = x;
    const cs = x.wide ? x.H * .44 : x.tall ? x.W * .46 : x.W * .36;
    const ARC = x.tall ? { left: '7%', top: '6%', width: '58%', height: '40%' } : x.wide ? { left: '4%', top: '9%', width: '27%', height: '82%' } : { left: '6%', top: '6%', width: '46%', height: '56%' };
    const CIR = x.tall ? { right: '6%', top: '27%' } : x.wide ? { left: '27%', top: '12%' } : { left: '47%', top: '8%' };
    const REC = x.tall ? { left: '9%', top: '49%', width: '42%', height: '15%' } : x.wide ? { left: '34%', top: '58%', width: '20%', height: '32%' } : { right: '6%', top: '42%', width: '32%', height: '21%' };
    return [
      d(ab(ARC, { borderRadius: '999px 999px .4em .4em', overflow: 'hidden' }), x.pic(0, { position: 'absolute', inset: 0 })),
      d(ab(CIR, { width: cs + 'px', height: cs + 'px', borderRadius: '50%', overflow: 'hidden', border: '.4em solid ' + c.bg, boxSizing: 'content-box' }), x.pic(1, { position: 'absolute', inset: 0 })),
      d(ab(REC, { borderRadius: '.8em', overflow: 'hidden' }), x.pic(2, { position: 'absolute', inset: 0 })),
      d(ab(x.tall ? { right: '10%', top: '52%' } : x.wide ? { left: '24%', top: '62%' } : { left: '55%', top: '37%' }, { width: '1.3em', height: '1.3em', borderRadius: '50%', background: c.acc })),
      x.fld('badge', ab(x.tall ? { right: '7%', top: '7%' } : x.wide ? { left: '60%', top: '10%' } : { right: '6%', top: '66%' }, { fontFamily: SERIF, fontStyle: 'italic', fontSize: '.6em', color: c.acc }), f.badge),
      d(ab(x.wide ? { left: '60%', right: '5%', bottom: '10%' } : { left: '6%', right: '6%', bottom: '5.5%' }),
        x.fld('titulo', HD(x, 1.22, { fontStyle: x.ty.it, maxWidth: '80%' }), f.titulo),
        d({ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1em', marginTop: '.6em' },
          d({ minWidth: 0 }, x.fld('zona', { fontSize: '.56em', fontWeight: 600, marginBottom: '.45em' }, f.zona), x.stats({ size: 1.2 })),
          d({ textAlign: 'right' }, x.fld('precio', { fontSize: '1.55em', fontWeight: 700, letterSpacing: '-.03em', whiteSpace: 'nowrap', borderBottom: '.1em solid ' + c.acc, paddingBottom: '.1em' }, f.precio), x.fld('logo', { marginTop: '.7em', display: 'flex', justifyContent: 'flex-end' }, logo(c.fg, .32, 'right')))))
    ]; },

  contactos: x => { const { f, c } = x; const n = x.wide ? 5 : x.tall ? 3 : 4;
    const holes = (pos: 'top' | 'bottom') => d(ab({ left: 0, right: 0, [pos]: '.28em', height: '.42em', backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,.85) 0 .5em, transparent .5em 1.1em)', borderRadius: '.1em' }));
    return [
      d(ab(x.wide ? { left: '5%', right: '50%', top: '9%' } : { left: '6%', right: '6%', top: '6%' }),
        d({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.7em' }, x.fld('badge', { fontFamily: SERIF, fontStyle: 'italic', fontSize: '.62em', color: c.acc }, f.badge), x.fld('logo', {}, logo(c.fg, .38, 'right'))),
        x.fld('titulo', HD(x, 1.55, { fontStyle: x.ty.it }), f.titulo),
        x.fld('zona', { fontSize: '.58em', fontWeight: 600, marginTop: '.6em' }, f.zona)),
      d(ab({ left: '-4%', right: '-4%', top: x.tall ? '36%' : x.wide ? '44%' : '41%', height: x.tall ? '24%' : x.wide ? '36%' : '31%', background: '#161412', transform: 'rotate(-2.5deg)', boxShadow: '0 .6em 1.6em rgba(0,0,0,.25)', padding: '1.05em 5% ' }),
        holes('top'), holes('bottom'),
        d({ display: 'flex', gap: '.45em', height: '100%' }, ...Array.from({ length: n }, (_, i) => d({ flex: '1 1 0', position: 'relative', minWidth: 0 },
          x.pic(i, { position: 'absolute', inset: 0 }),
          d(ab({ left: '.3em', top: '-.95em', fontFamily: MONO, fontSize: '.3em', color: '#E8A33D' }), (14 + i) + 'A ▸'))))),
      d(ab(x.wide ? { left: '5%', right: '5%', bottom: '7%' } : { left: '6%', right: '6%', bottom: '5.5%' }, { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1em' }),
        d({ display: 'flex', gap: '1.4em' }, ...x.specs.map(s => x.fld(s.k, {}, sp(HD(x, 1.2, { lineHeight: 1 }), s.v), sp({ fontSize: '.52em', color: c.mut, marginLeft: '.3em' }, s.u)))),
        x.fld('precio', { fontSize: '1.6em', fontWeight: 700, letterSpacing: '-.03em', whiteSpace: 'nowrap' }, f.precio))
    ]; },

  portada: x => { const { f, c } = x; return [
    x.pic(0, { position: 'absolute', inset: 0 }),
    d(ab({ inset: 0, background: 'linear-gradient(180deg,rgba(0,0,0,.62) 0%,rgba(0,0,0,0) 30%,rgba(0,0,0,0) 46%,rgba(0,0,0,.9) 100%)' })),
    x.fld('logo', ab({ left: '10%', right: '10%', top: '4.8%', display: 'flex', justifyContent: 'center' }), logo('#fff', 1.05, 'center')),
    x.fld('badge', ab({ right: '6%', top: x.tall ? '19%' : '25%', width: '4.9em', height: '4.9em', borderRadius: '50%', background: c.acc, color: c.accFg, transform: 'rotate(-12deg)', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', boxShadow: '0 .5em 1.4em rgba(0,0,0,.35)' }),
      d(ab({ inset: '.32em', borderRadius: '50%', border: '1px dashed currentColor', opacity: .55 })),
      d({ fontFamily: SERIF, fontStyle: 'italic', fontSize: '1.1em', lineHeight: .95, maxWidth: '3.7em' }, f.badge)),
    d(ab({ left: '5.5%', right: '5.5%', bottom: '5.5%', color: '#fff' }),
      x.fld('zona', { fontSize: '.6em', fontWeight: 600, letterSpacing: '.04em', display: 'flex', alignItems: 'center', gap: '.8em' }, sp({ width: '2.4em', height: '1px', background: '#fff', display: 'inline-block' }), f.zona),
      x.fld('titulo', HD(x, 1.9, { margin: '.25em 0 .6em', maxWidth: '88%', fontStyle: x.ty.it }), f.titulo),
      d({ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '.8em' },
        d({ display: 'flex', gap: '.35em', flexWrap: 'wrap' }, ...x.specs.map(s => x.fld(s.k, { fontSize: '.58em', padding: '.5em .95em', border: '1px solid rgba(255,255,255,.5)', borderRadius: '99px', background: 'rgba(255,255,255,.1)', backdropFilter: 'blur(6px)' }, s.v + ' ' + s.u))),
        x.fld('precio', { fontSize: '1.85em', fontWeight: 700, letterSpacing: '-.03em', whiteSpace: 'nowrap' }, f.precio)),
      x.foot('rgba(255,255,255,.72)'))
  ]; },

  bajada: x => { const { f, c } = x; return [
    d(ab({ left: 0, top: 0, width: '100%', height: '63%', clipPath: 'polygon(0 0,100% 0,100% 100%,0 80%)' }), x.pic(0, { position: 'absolute', inset: 0 })),
    x.fld('badge', ab({ left: '5%', top: '5%', display: 'flex', alignItems: 'center', gap: '.6em', background: '#fff', color: '#141414', padding: '.65em 1.1em', borderRadius: '99px', fontSize: '.42em', fontWeight: 600 }), sp({ width: '.7em', height: '.7em', borderRadius: '50%', background: '#E5484D', display: 'inline-block' }), f.badge),
    x.fld('logo', ab({ right: '5%', top: '5.5%', textShadow: '0 1px 8px rgba(0,0,0,.5)' }), logo('#fff', .48, 'right')),
    x.fld('precio', ab({ left: '4.5%', right: '5%', top: x.tall ? '54%' : '51%', display: 'flex', alignItems: 'flex-start', gap: '.5em' }),
      d({ fontFamily: BEBAS, fontSize: '6.6em', lineHeight: .8, color: c.fg }, f.dto),
      d({ paddingTop: '.35em' },
        d({ fontSize: '.42em', color: c.mut }, 'Antes'),
        d({ position: 'relative', display: 'inline-block', fontSize: '.86em', color: c.mut, marginTop: '.15em' }, f.antes, sp(ab({ left: '-5%', right: '-5%', top: '48%', height: '.13em', background: '#E5484D', transform: 'rotate(-7deg)' }))),
        d({ fontSize: '.42em', color: c.mut, marginTop: '.7em' }, 'Ahora'),
        d({ fontSize: '1.45em', fontWeight: 700, letterSpacing: '-.025em', whiteSpace: 'nowrap', marginTop: '.05em' }, f.precio))),
    d(ab({ left: '5%', right: '5%', bottom: '5%' }),
      x.fld('titulo', HD(x, 1.05, { fontStyle: x.ty.it }), f.titulo),
      d({ display: 'flex', gap: '.9em', flexWrap: 'wrap', fontSize: '.56em', color: c.mut, marginTop: '.6em' }, x.fld('zona', { color: c.fg, fontWeight: 600 }, f.zona), ...x.specs.map(s => x.fld(s.k, { whiteSpace: 'nowrap' }, s.v + ' ' + s.u))))
  ]; },

  arco: x => { const { f, c } = x;
    const Ar = x.wide ? { left: '6%', top: '10%', width: '34%', height: '80%' } : (x.tall ? { left: '17%', top: '12%', width: '66%', height: '42%' } : { left: '27%', top: '10.5%', width: '46%', height: '43%' });
    const T: CSSProperties = x.wide ? { left: '47%', right: '7%', top: '26%', textAlign: 'left' } : { left: '9%', right: '9%', top: x.tall ? '58%' : '58%', textAlign: 'center' };
    return [
      d(ab({ inset: '3.2%', border: '1px solid ' + c.line })),
      x.fld('badge', ab(x.wide ? { left: '47%', top: '14%' } : { left: 0, right: 0, top: '5.2%', textAlign: 'center' }, { fontFamily: SERIF, fontStyle: 'italic', fontSize: '.62em', color: c.acc }), f.badge),
      d(ab(Ar, { borderRadius: '999px 999px 0 0', border: '1px solid ' + c.acc, transform: 'translate(.6em,-.6em)' })),
      d(ab(Ar, { borderRadius: '999px 999px 0 0', overflow: 'hidden' }), x.pic(0, { position: 'absolute', inset: 0 })),
      d(ab(T),
        x.fld('titulo', HD(x, 1.12, { fontStyle: x.ty.it }), f.titulo),
        x.fld('zona', { fontSize: '.48em', fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase', color: c.mut, marginTop: '.8em' }, f.zona),
        d({ width: '2.4em', height: '1px', background: c.acc, margin: x.wide ? '.9em 0' : '.9em auto' }),
        d({ display: 'flex', justifyContent: x.wide ? 'flex-start' : 'center', alignItems: 'baseline', gap: '.8em', flexWrap: 'wrap' },
          x.fld('precio', { fontSize: '1.35em', fontWeight: 600 }, f.precio),
          ...x.specs.map(s => x.fld(s.k, { fontSize: '.56em', color: c.mut, whiteSpace: 'nowrap' }, s.v + ' ' + s.u)))),
      x.fld('logo', ab(x.wide ? { right: '7%', bottom: '10%' } : { left: 0, right: 0, bottom: '6%' }, { display: 'flex', justifyContent: x.wide ? 'flex-end' : 'center' }), logo(c.fg, .38, x.wide ? 'right' : 'center'))
    ]; },

  xxl: x => { const { f, c } = x; const showP = x.sh.precio; const num = showP ? x.bigNum : String(x.m2); const unit = showP ? x.bigUnit : 'metros cuadrados';
    const bigFs = Math.min(x.W * .9 / (num.length * .42 + .04), x.H * (x.tall ? .3 : x.wide ? .5 : .58));
    return [
      d(ab({ left: '5.5%', right: '5.5%', top: '5%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }),
        x.fld('logo', {}, logo(c.fg, .45)),
        x.fld('badge', { fontSize: '.42em', fontWeight: 600, border: '1px solid ' + c.fg, borderRadius: '99px', padding: '.6em 1.1em' }, f.badge)),
      d(ab({ left: '4.5%', right: '4.5%', top: x.tall ? '17%' : '15%' }),
        x.fld(showP ? 'precio' : 'm2', {},
          d({ fontFamily: BEBAS, fontSize: bigFs + 'px', lineHeight: .8, display: 'inline-block', paddingTop: '.08em', backgroundImage: x.ph[0], backgroundSize: 'cover', backgroundPosition: 'center 40%', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent', filter: x.pf[0] }, num),
          d({ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '.14em solid ' + c.fg, paddingTop: '.4em', marginTop: '.1em' }, sp(HD(x, 1.15, { fontStyle: x.ty.it }), unit), sp({ fontSize: '.42em', color: c.mut }, 'Ref. ' + f.ref)))),
      d(ab({ left: '5.5%', right: '5.5%', bottom: '5.5%' }),
        x.fld('titulo', HD(x, 1.05), f.titulo),
        d({ display: 'flex', gap: '.35em', flexWrap: 'wrap', marginTop: '.7em', alignItems: 'center' },
          x.fld('zona', { fontSize: '.56em', fontWeight: 600, marginRight: '.8em' }, f.zona),
          ...x.specs.map(s => x.fld(s.k, { fontSize: '.56em', padding: '.45em .95em', border: '1px solid ' + c.line, borderRadius: '99px', whiteSpace: 'nowrap' }, s.v + ' ' + s.u))))
    ]; },

  collage: x => { const { f, c } = x;
    const L: Box[] = x.tall ? [['6%', '5%', '70%', '27%', -4], ['28%', '24%', '66%', '23%', 5], ['8%', '43%', '60%', '21%', -2]]
      : x.wide ? [['4%', '9%', '30%', '62%', -5], ['28%', '14%', '28%', '54%', 4], ['52%', '7%', '26%', '48%', -3]]
      : [['5%', '5%', '55%', '44%', -5], ['50%', '8%', '44%', '34%', 6], ['27%', '33%', '44%', '32%', -2]];
    const pol = (i: number) => { const [l, t, w, hh, r] = L[i]; return d(ab({ left: l, top: t, width: w, height: hh, background: '#FBFAF6', padding: '.42em .42em 1.5em', transform: `rotate(${r}deg)`, boxShadow: '0 .6em 1.6em rgba(0,0,0,.4)' }),
      x.pic(i, { width: '100%', height: '100%' }),
      pieFoto(x.phName[i]) ? d(ab({ left: 0, right: 0, bottom: '.5em', textAlign: 'center', fontFamily: SERIF, fontStyle: 'italic', fontSize: '.5em', color: '#3A3128' }), pieFoto(x.phName[i]).toLowerCase()) : null,
      i < 2 ? d(ab({ left: '40%', top: '-.55em', width: '22%', height: '1.2em', background: 'rgba(255,244,214,.75)', transform: `rotate(${i ? -4 : 3}deg)`, boxShadow: '0 1px 2px rgba(0,0,0,.15)' })) : null); };
    return [ pol(0), pol(1), pol(2),
      x.fld('precio', ab(x.wide ? { right: '5%', top: '58%' } : { right: '6%', top: x.tall ? '68%' : '62%' }, { width: '5.3em', height: '5.3em', borderRadius: '50%', background: c.acc, color: c.accFg, transform: 'rotate(9deg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', boxShadow: '0 .5em 1.2em rgba(0,0,0,.3)' }),
        d({ fontFamily: SERIF, fontStyle: 'italic', fontSize: '.5em', opacity: .85 }, 'por'), d({ fontSize: '.84em', fontWeight: 700, letterSpacing: '-.02em', whiteSpace: 'nowrap' }, f.precio)),
      d(ab(x.wide ? { left: '5%', right: '30%', bottom: '7%' } : { left: '6%', right: '36%', bottom: '6%' }),
        x.fld('badge', { fontFamily: SERIF, fontStyle: 'italic', fontSize: '.7em', color: c.acc }, f.badge),
        x.fld('titulo', HD(x, 1.08, { marginTop: '.2em' }), f.titulo),
        x.fld('zona', { fontSize: '.52em', fontWeight: 600, marginTop: '.45em' }, f.zona), d({ marginTop: '.45em' }, x.stats({ size: .95 }))),
      x.fld('logo', ab({ right: '6%', bottom: '6%' }), logo(c.fg, .36, 'right'))
    ]; },

  plano: x => { const { f, c } = x;
    const PH = x.wide ? { left: '4%', top: '15%', width: '46%', height: '72%' } : { left: '5%', top: '12.5%', width: '90%', height: x.tall ? '36%' : '43%' };
    const cells = x.specs.map(s => ({ k: s.k, l: s.l, v: s.v, u: s.u }));
    const nC = cells.length + (x.sh.energia ? 1 : 0);
    const corner = (a: number, b: number, r: number) => d(ab({ [a ? 'right' : 'left']: '-.75em', [b ? 'bottom' : 'top']: '-.75em', width: '1em', height: '1em', borderLeft: '1px solid ' + c.fg, borderTop: '1px solid ' + c.fg, transform: `rotate(${r}deg)` }));
    return [
      d(ab({ inset: 0, backgroundImage: `linear-gradient(${c.grid} 1px, transparent 1px),linear-gradient(90deg, ${c.grid} 1px, transparent 1px)`, backgroundSize: '1.5em 1.5em' })),
      d(ab({ left: '5%', right: '5%', top: '4.4%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }),
        x.fld('ref', { fontFamily: MONO, fontSize: '.38em', color: c.mut }, 'Ficha ' + f.ref),
        x.fld('logo', {}, logo(c.fg, .42, 'right'))),
      d(ab(PH), x.pic(0, { position: 'absolute', inset: 0 }), corner(0, 0, 0), corner(1, 0, 90), corner(1, 1, 180), corner(0, 1, 270),
        pieFoto(x.phName[0]) ? d(ab({ left: '.7em', bottom: '.7em', fontFamily: MONO, fontSize: '.34em', background: 'rgba(0,0,0,.62)', color: '#fff', padding: '.45em .8em' }), pieFoto(x.phName[0])) : null),
      d(ab(x.wide ? { left: '55%', right: '5%', top: '42%' } : { left: '5%', right: '5%', top: x.tall ? '53%' : '60.5%' }),
        d({ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, nC)}, minmax(0,1fr))`, borderTop: '1px solid ' + c.line, borderBottom: '1px solid ' + c.line },
          ...cells.map((s, i) => x.fld(s.k, { padding: '.6em .2em .6em ' + (i ? '.7em' : '0'), borderLeft: i ? '1px solid ' + c.line : '0' },
            d({ fontSize: '.36em', color: c.mut }, s.l),
            d({ display: 'flex', alignItems: 'baseline', gap: '.25em', marginTop: '.3em' }, sp(HD(x, 1.45, { lineHeight: 1 }), s.v), sp({ fontSize: '.46em', color: c.mut }, s.u)))),
          x.fld('energia', { padding: '.6em .2em .6em .7em', borderLeft: cells.length ? '1px solid ' + c.line : '0' },
            d({ fontSize: '.36em', color: c.mut }, 'Certificado'),
            d({ display: 'flex', gap: '.1em', alignItems: 'flex-end', marginTop: '.45em' }, ...'ABCDEFG'.split('').map(L => d({ width: '.6em', height: L === f.energia ? '1.35em' : '.5em', background: EN_COLOR[L], display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }, L === f.energia ? sp({ fontSize: '.6em' }, L) : null)))))),
      d(ab(x.wide ? { left: '55%', right: '5%', bottom: '9%' } : { left: '5%', right: '5%', bottom: '5%' }, { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1em' }),
        d({ minWidth: 0 }, x.fld('badge', { fontSize: '.42em', color: c.mut }, f.badge), x.fld('titulo', HD(x, .98, { marginTop: '.3em' }), f.titulo), x.fld('zona', { fontSize: '.52em', color: c.mut, marginTop: '.45em' }, f.zona)),
        x.fld('precio', { border: '1px solid ' + c.fg, padding: '.35em .6em', fontSize: '1.3em', fontWeight: 700, whiteSpace: 'nowrap' }, f.precio))
    ]; },

  openhouse: x => { const { f, c } = x; const ev = parseEv(f.evento);
    const Pp = x.tall ? { left: '8%', top: '8%', width: '74%', height: '43%' } : x.wide ? { left: '5%', top: '10%', width: '38%', height: '78%' } : { left: '7%', top: '7.5%', width: '57%', height: '57%' };
    const CAL = x.tall ? { right: '8%', top: '41%' } : x.wide ? { left: '37%', top: '14%' } : { right: '8%', top: '12%' };
    return [
      d(ab({ inset: 0, backgroundImage: `radial-gradient(${c.line} 1px, transparent 1.4px)`, backgroundSize: '1.1em 1.1em', opacity: .55 })),
      d(ab(Pp, { background: '#FBFAF6', padding: '.5em .5em 2.1em', transform: 'rotate(-4deg)', boxShadow: '0 .7em 1.8em rgba(0,0,0,.4)' }),
        x.pic(0, { width: '100%', height: '100%' }),
        d(ab({ left: 0, right: 0, bottom: '.6em', textAlign: 'center', fontFamily: SERIF, fontStyle: 'italic', fontSize: '.68em', color: '#3A3128' }), 'ven a conocerlo'),
        d(ab({ left: '39%', top: '-.6em', width: '24%', height: '1.3em', background: 'rgba(255,244,214,.78)', transform: 'rotate(3deg)', boxShadow: '0 1px 2px rgba(0,0,0,.15)' }))),
      x.fld('evento', ab(CAL, { width: '6.6em', background: '#fff', color: '#141414', borderRadius: '.45em', overflow: 'hidden', transform: 'rotate(5deg)', textAlign: 'center', boxShadow: '0 .7em 1.8em rgba(0,0,0,.4)' }),
        d({ background: '#D8423A', color: '#fff', fontSize: '.5em', fontWeight: 700, letterSpacing: '.3em', padding: '.6em 0 .55em .3em' }, ev.mes),
        d({ fontFamily: BEBAS, fontSize: '3.7em', lineHeight: .95, paddingTop: '.1em' }, ev.dia),
        d({ fontSize: '.46em', fontWeight: 600 }, ev.wd),
        d({ fontSize: '.4em', color: '#555', padding: '.35em .4em 1em' }, f.evHora)),
      d(ab(x.wide ? { left: '56%', right: '5%', bottom: '11%' } : { left: '7%', right: '7%', bottom: '6%' }),
        x.fld('badge', HD(x, 1.75, { fontStyle: x.ty.it }), f.badge),
        d({ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1em', marginTop: '.55em' },
          d({ minWidth: 0 }, x.fld('titulo', { fontSize: '.64em', fontWeight: 600 }, f.titulo), x.fld('zona', { fontSize: '.55em', color: c.mut, marginTop: '.3em' }, f.zona)),
          x.fld('precio', { fontSize: '1.45em', fontWeight: 700, letterSpacing: '-.02em', whiteSpace: 'nowrap' }, f.precio)))
    ]; },

  vendido: x => { const { f, c } = x; const rep = (t: string, n: number) => Array(n).fill(t).join('   ✦   ');
    return [
      d(bg(x.ph[0], (x.pf[0] === 'none' ? '' : x.pf[0] + ' ') + 'grayscale(.45)', { position: 'absolute', inset: 0 })),
      d(ab({ inset: 0, background: 'linear-gradient(180deg,rgba(0,0,0,.4),rgba(0,0,0,.22) 42%,rgba(0,0,0,.85))' })),
      d(ab({ left: '-25%', width: '150%', top: x.tall ? '40%' : '49%', transform: 'rotate(6deg)', background: c.bg, color: c.fg, fontSize: '.6em', letterSpacing: '.36em', padding: '.75em 0', whiteSpace: 'nowrap', overflow: 'hidden', textAlign: 'center' }), rep('REHABINCO', 10)),
      x.fld('badge', ab({ left: '-25%', width: '150%', top: x.tall ? '32%' : '35%', transform: 'rotate(-8deg)', background: c.acc, color: c.accFg, fontFamily: BEBAS, fontSize: '2.7em', letterSpacing: '.05em', lineHeight: 1, padding: '.18em 0 .08em', whiteSpace: 'nowrap', overflow: 'hidden', textAlign: 'center', boxShadow: '0 .25em .8em rgba(0,0,0,.4)' }), rep(f.badge.toUpperCase(), 6)),
      x.fld('logo', ab({ left: '5.5%', top: '5.5%' }), logo('#fff', .5)),
      d(ab({ left: '5.5%', right: '5.5%', bottom: '5.5%', color: '#fff' }),
        d({ fontSize: '.5em', opacity: .8 }, 'Otra llave entregada en'),
        x.fld('zona', HD(x, 1.55, { marginTop: '.2em', fontStyle: x.ty.it }), x.barrio),
        x.fld('cta', { display: 'inline-block', marginTop: '.9em', fontSize: '.46em', fontWeight: 600, background: '#fff', color: '#141414', padding: '.8em 1.35em', borderRadius: '99px' }, f.cta))
    ]; },

  reforma: x => { const { f, c } = x; const ang = Math.atan2(.16 * x.W, .78 * x.H) * 180 / Math.PI; const len = Math.hypot(.16 * x.W, .78 * x.H);
    return [
      d(bg(x.ph[0], 'grayscale(1) contrast(.9) brightness(.75) sepia(.2)', { position: 'absolute', left: 0, top: 0, width: '100%', height: '78%' })),
      x.pic(0, { position: 'absolute', left: 0, top: 0, width: '100%', height: '78%', clipPath: 'polygon(58% 0,100% 0,100% 100%,42% 100%)' }),
      d(ab({ left: (x.W * .5 - 1.5) + 'px', top: (x.H * .39 - len / 2) + 'px', width: '3px', height: len + 'px', background: '#fff', transform: `rotate(${ang}deg)` })),
      d(ab({ left: '50%', top: '39%', width: '2.3em', height: '2.3em', transform: 'translate(-50%,-50%)', borderRadius: '50%', background: '#fff', color: '#141414', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 .2em .8em rgba(0,0,0,.35)' }), sp({ fontSize: '.9em', fontWeight: 700 }, '⇆')),
      d(ab({ left: '5%', top: '5%', fontSize: '.44em', fontWeight: 600, background: 'rgba(0,0,0,.6)', color: '#fff', padding: '.55em 1em', borderRadius: '99px' }), 'Antes'),
      d(ab({ right: '5%', top: '5%', fontSize: '.44em', fontWeight: 600, background: '#fff', color: '#141414', padding: '.55em 1em', borderRadius: '99px' }), 'Después'),
      d(ab({ left: 0, right: 0, bottom: 0, height: '22%', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1em', padding: '0 5.5%' }),
        d({ minWidth: 0 }, x.fld('badge', { fontSize: '.44em', color: c.mut }, f.badge), x.fld('titulo', HD(x, .95, { marginTop: '.2em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontStyle: x.ty.it }), f.titulo), x.fld('zona', { fontSize: '.52em', color: c.mut, marginTop: '.35em' }, f.zona)),
        d({ textAlign: 'right', flex: '0 0 auto' }, x.fld('precio', { fontSize: '1.45em', fontWeight: 700, letterSpacing: '-.02em', whiteSpace: 'nowrap' }, f.precio), x.fld('logo', { marginTop: '.55em', display: 'flex', justifyContent: 'flex-end' }, logo(c.fg, .34, 'right'))))
    ]; },

  contacto: (x) => { const { f, c } = x; const cs = Math.round(Math.min(x.W, x.H) * (x.wide ? .3 : .34));
    return [
      d(ab({ inset: '3.2%', border: '1px solid ' + c.line })),
      d(ab({ inset: '8%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', textAlign: 'center' }),
        x.fld('logo', {}, logo(c.fg, .5, 'center')),
        d({ display: 'flex', flexDirection: 'column', alignItems: 'center' },
          d({ position: 'relative', width: cs + 'px', height: cs + 'px', borderRadius: '50%', overflow: 'hidden', flex: '0 0 auto' }, x.pic(0, { position: 'absolute', inset: 0 })),
          x.fld('cta', HD(x, 1.75, { fontStyle: x.ty.it, marginTop: '.65em', maxWidth: '11em' }), f.cta),
          d({ display: 'flex', gap: '.7em', justifyContent: 'center', flexWrap: 'wrap', fontSize: '.56em', color: c.mut, marginTop: '.9em' }, x.fld('titulo', {}, f.titulo), x.fld('zona', { fontWeight: 600, color: c.fg }, f.zona))),
        d({},
          x.fld('tel', { display: 'inline-block', background: c.acc, color: c.accFg, fontSize: '1.3em', fontWeight: 700, letterSpacing: '-.01em', padding: '.45em 1.2em', borderRadius: '99px', whiteSpace: 'nowrap' }, f.tel),
          x.fld('agente', { fontSize: '.56em', color: c.mut, marginTop: '.8em' }, 'Pregunta por ' + f.agente))),
    ]; },
};

export type CreativeProps = {
  template: TemplateId; data: CreativeData;
  /** Tamaño en pantalla en px. Para exportar, renderiza a 540 de ancho y usa pixelRatio 2 (ver exportCreative.ts). */
  width: number; height: number;
  /** Modo editor: textos y fotos se pueden seleccionar con clic. */
  editable?: boolean;
  /** Clave seleccionada: una FieldKey o `foto0`, `foto1`… */
  selected?: string;
  /** Recibe la clave pulsada; cadena vacía al pulsar en el fondo. */
  onSelect?: (key: string) => void;
  onMove?: (key: FieldKey, pos: { x: number; y: number }) => void;
  onEncuadre?: (slot: number, enc: EncuadreFoto) => void;
};

/** Pinta una creatividad. Componente puro: no lee estado global ni hace peticiones. */
export function Creative({ template, data, width: W, height: H, editable = false, selected = '', onSelect, onMove, onEncuadre }: CreativeProps) {
  const edit = editable;
  const x = { ...data, escala: data.escala ?? {}, pos: data.pos ?? {}, fuentes: data.fuentes ?? {}, encuadre: data.encuadre ?? {}, sel: selected, onSel: onSelect, onMove, onEncuadre, W, H, edit, tall: H > W * 1.1, wide: W > H * 1.3, fs: +(Math.min(W, H * .8) / 22).toFixed(3) } as Ctx;
  x.fld = (key, style, ...kids) => {
    if (!x.sh[key]) return null;
    const stl = ajustar(x, key, style);
    if (!edit) return h('div', { style: stl }, ...kids);
    const on = x.sel === key;
    return h('div', {
      className: 'estudio-fld',
      title: on ? 'Arrastra para moverlo' : undefined,
      style: { ...stl, cursor: on ? 'grab' : 'pointer', outline: on ? '2px solid #4C8DFF' : 'none', outlineOffset: '.25em', touchAction: 'none' },
      onClick: (e: React.MouseEvent) => { e.stopPropagation(); onSelect?.(key); },
      onPointerDown: (e: React.PointerEvent) => {
        if (e.button !== 0 || !x.onMove) return;
        const orig = x.pos?.[key] ?? { x: 0, y: 0 };
        const sx = e.clientX, sy = e.clientY;
        let moved = false;
        const move = (ev: PointerEvent) => {
          const dx = ((ev.clientX - sx) / x.W) * 100;
          const dy = ((ev.clientY - sy) / x.H) * 100;
          if (!moved && Math.hypot(dx, dy) < 0.7) return;
          moved = true;
          x.onMove?.(key, { x: Math.round((orig.x + dx) * 10) / 10, y: Math.round((orig.y + dy) * 10) / 10 });
        };
        const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      },
    }, ...kids);
  };
  x.pic = (i, style) => {
    const enc = encuadreDe(x.encuadre?.[i]);
    const marco: CSSProperties = { ...style, overflow: 'hidden', position: style.position ?? 'relative' };
    const imagen = h('div', {
      'aria-hidden': true,
      style: {
        position: 'absolute', inset: 0, backgroundImage: x.ph[i] || 'none', backgroundSize: 'cover', backgroundPosition: 'center',
        filter: x.pf[i] && x.pf[i] !== 'none' ? x.pf[i] : undefined,
        transformOrigin: 'center center', transform: transformEncuadre(enc), pointerEvents: 'none',
      },
    });
    if (!edit) return h('div', { style: marco }, imagen);
    const on = x.sel === 'foto' + i;
    return h('div', {
      className: 'estudio-pic',
      title: on ? 'Arrastra para mover la foto' : 'Elegir esta foto',
      style: { ...marco, cursor: on ? 'grab' : 'pointer', outline: on ? '3px solid #4C8DFF' : 'none', outlineOffset: '-3px', touchAction: on ? 'none' : undefined },
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        if ((e.currentTarget as HTMLElement).dataset.moved === '1') return;
        onSelect?.('foto' + i);
      },
      onPointerDown: (e: React.PointerEvent) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        const frame = e.currentTarget as HTMLElement;
        const rect = frame.getBoundingClientRect();
        const sx = e.clientX;
        const sy = e.clientY;
        const orig = enc;
        let moved = false;
        frame.setPointerCapture(e.pointerId);
        const move = (ev: PointerEvent) => {
          if (rect.width < 1 || rect.height < 1) return;
          const dx = ((ev.clientX - sx) / rect.width) * 100;
          const dy = ((ev.clientY - sy) / rect.height) * 100;
          if (!moved && Math.hypot(dx, dy) < 1.2) return;
          moved = true;
          frame.dataset.moved = '1';
          onSelect?.('foto' + i);
          x.onEncuadre?.(i, encuadreDe({ ...orig, x: orig.x + dx, y: orig.y + dy }));
        };
        const up = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          if (moved) setTimeout(() => { delete frame.dataset.moved; }, 0);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      },
    }, imagen);
  };
  x.stats = (o) => d({ display: 'flex', alignItems: 'baseline', flexWrap: 'nowrap', justifyContent: o.center ? 'center' : 'flex-start' }, ...x.specs.map((sx, i) => x.fld(sx.k, { whiteSpace: 'nowrap', display: 'flex', alignItems: 'baseline', gap: '.25em', paddingLeft: i ? (o.short ? '.55em' : '.8em') : '0', marginLeft: i ? (o.short ? '.55em' : '.8em') : '0', borderLeft: i ? '1px solid ' + (o.line || x.c.line) : '0' },
    sp({ fontSize: (o.size || 1.1) + 'em', fontWeight: 600, letterSpacing: '-.02em' }, sx.v), sp({ fontSize: o.short ? '.52em' : '.6em', color: o.mut || x.c.mut }, o.short && sx.k === 'hab' ? 'dorm.' : sx.u))));
  x.foot = (color) => d({ display: 'flex', gap: '1.2em', marginTop: '.9em', fontSize: '.4em', color }, x.fld('agente', {}, x.f.agente), x.fld('tel', {}, x.f.tel), x.fld('ref', { marginLeft: 'auto' }, x.f.ref));
  return h('div', {
    'data-estudio-creative': template,
    style: { position: 'relative', width: W, height: H, overflow: 'hidden', fontSize: x.fs, background: x.c.bg, color: x.c.fg, fontFamily: FONT.sans, lineHeight: 1.15, textAlign: 'left' },
    onClick: edit ? () => onSelect?.('') : undefined,
  }, ...R[template](x));
}

function ajustar(x: Ctx, key: FieldKey, style: CSSProperties): CSSProperties {
  const scale = x.escala?.[key] ?? 1;
  const p = x.pos?.[key];
  const next: CSSProperties = { ...style };
  const estilo = x.fuentes?.[key];
  const familia = FUENTES.find((f) => f.id === estilo?.fuente);
  if (familia) next.fontFamily = familia.ff;
  if (estilo?.negrita === true) next.fontWeight = 700;
  if (estilo?.negrita === false) next.fontWeight = 400;
  if (estilo?.cursiva === true) next.fontStyle = "italic";
  if (estilo?.cursiva === false) next.fontStyle = "normal";
  if (scale !== 1) {
    if (typeof next.fontSize === 'string') {
      const n = parseFloat(next.fontSize);
      if (next.fontSize.endsWith('px')) next.fontSize = (n * scale).toFixed(2) + 'px';
      else if (next.fontSize.endsWith('em')) next.fontSize = (n * scale).toFixed(3) + 'em';
    } else if (typeof next.fontSize === 'number') next.fontSize = next.fontSize * scale;
    else next.fontSize = scale + 'em';
  }
  if (p && (p.x || p.y)) {
    const nudge = `translate(${(p.x / 100) * x.W}px, ${(p.y / 100) * x.H}px)`;
    next.transform = [style.transform, nudge].filter(Boolean).join(' ');
  }
  return next;
}
