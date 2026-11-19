'use client';
/**
 * Estudio · publicación de un inmueble: una imagen o un carrusel de pantallas.
 * Pasos: Inmueble → Diseño → Editar → Publicar. La vista previa es un botón.
 */
import { useMemo, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from 'react';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Database, Download, Eye, EyeOff, Image as ImageIcon, Instagram, LayoutTemplate, Palette, Plus, Redo2, Search, Trash2, Undo2, X } from 'lucide-react';
import { FIELD_LABELS, FORMATS, GOALS, MAX_SLIDES, READONLY_FIELDS, TEMPLATES, THEMES, TIPOS_PUBLICACION, TYPOS, fitBox, templatesForGoal, type FieldKey, type FormatId, type TemplateId, type ThemeId, type TypoId } from "@/lib/estudio/config";
import { AGENCIA, anidarEscala, anidarPos, assignPhoto, resolveSlots, type InmuebleEstudio } from "@/lib/estudio/data";
import { buildSlideData, defaultHidden, initialPublication, makeSlide, slideLabel, usedPhotoIndexes, type Publication } from "@/lib/estudio/publicacion";
import { Creative } from "@/components/estudio/templates";
import { usePublication } from "@/lib/estudio/usePublication";
import { downloadBlob, exportSlides, slideFilename } from "@/lib/estudio/exportCreative";
import { textoInstagram } from "@/lib/estudio/instagram";
import "@/components/estudio/estudio.css";

const k = {
  bg: "var(--background)", glass: "var(--surface)", panel: "var(--surface)", hover: "var(--surface-soft)", line: "var(--border)", line2: "var(--input)",
  fg: "var(--foreground)", mut: "var(--text-2)", prim: "var(--accent)", primFg: "var(--accent-foreground)", stage: "var(--pdf-desk)", chip: "var(--accent-soft)",
  blue: "#4C8DFF", link: "var(--blue)", danger: "var(--red)", dangerBg: "var(--red-bg)", dotOff: "var(--text-3)", warn: "var(--amber)",
};
const eur = (n: number) => n.toLocaleString('es-ES') + ' €';
const STEPS = [['inmueble', 'Inmueble'], ['diseno', 'Diseño'], ['editar', 'Editar'], ['publicar', 'Publicar']] as const;
type Step = (typeof STEPS)[number][0];
type Tab = 'diseno' | 'datos' | 'fotos' | 'estilo';
const btn: CSSProperties = { font: 'inherit', color: 'inherit', border: 0, background: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' };
const stage: CSSProperties = { background: k.stage, backgroundImage: 'radial-gradient(rgba(0,0,0,.06) 1px, transparent 1px)', backgroundSize: '18px 18px' };
const tplName = (t: TemplateId) => TEMPLATES.find((x) => x.id === t)?.nombre ?? t;
const pantallas = (n: number) => (n === 1 ? '1 pantalla' : `${n} pantallas`);
const nombreFoto = (nombre: string, i: number) => (/^foto\s*\d+$/i.test(nombre.trim()) ? String(i + 1) : nombre);

export type EstudioSavePayload = { inmuebleId: string; state: Publication & { template: TemplateId }; files: Partial<Record<FormatId, Blob>>; piezas: Blob[]; caption: string };
export type EstudioReviewPayload = { inmuebleId: string; state: Publication & { template: TemplateId }; nota: string };
export type EstudioWizardProps = {
  inmuebles: InmuebleEstudio[];
  initialInmuebleId?: string;
  agencia?: { telefono: string; web: string; cta: string };
  puedeRevisar?: boolean;
  veRevisiones?: boolean;
  inicial?: Publication;
  onSave?: (payload: EstudioSavePayload) => Promise<void> | void;
  onReview?: (payload: EstudioReviewPayload) => Promise<void> | void;
};

export function EstudioWizard({ inmuebles, initialInmuebleId, onSave, onReview, agencia, puedeRevisar, veRevisiones, inicial }: EstudioWizardProps) {
  if (agencia?.telefono) AGENCIA.telefono = agencia.telefono;
  if (agencia?.web) AGENCIA.web = agencia.web;
  if (agencia?.cta) AGENCIA.cta = agencia.cta;
  const [pid, setPid] = useState(initialInmuebleId ?? inmuebles[0]?.id ?? '');
  const [busqueda, setBusqueda] = useState("");
  const [step, setStep] = useState<Step>(inicial ? 'editar' : initialInmuebleId ? 'diseno' : 'inmueble');
  const P = usePublication(inicial);
  const { pub } = P;
  const [cur, setCur] = useState(0);
  const [sel, setSel] = useState('');
  const [tab, setTab] = useState<Tab>('datos');
  const [addOpen, setAddOpen] = useState<false | 'top' | 'bottom'>(false);
  const [pvOpen, setPvOpen] = useState(false);
  const [pv, setPv] = useState(0);
  const [extra, setExtra] = useState<Partial<Record<FormatId, boolean>>>({});
  const [busy, setBusy] = useState<'' | 'export' | 'publish' | 'review'>('');
  const [notaRevision, setNotaRevision] = useState('');
  const [toast, setToast] = useState<{ msg: string; undo?: boolean } | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout>>(undefined);
  const dragFrom = useRef(-1);
  const exportRefs = useRef<Partial<Record<FormatId, (HTMLDivElement | null)[]>>>({});

  const inm = inmuebles.find((i) => i.id === pid);
  const slideData = useMemo(() => (inm ? pub.slides.map((s) => buildSlideData(inm, pub, s)) : []), [inm, pub]);
  if (!inm) return <p style={{ padding: 32, color: k.mut }}>No hay inmuebles con fotos para crear una publicación.</p>;

  const n = pub.slides.length;
  const c = Math.min(cur, n - 1);
  const slide = pub.slides[c];
  const tpl = TEMPLATES.find((t) => t.id === slide.template)!;
  const data = slideData[c];
  const nF = inm.fotos.length;
  const label = (i: number) => slideLabel(inm, pub.slides[i], tplName);
  const full = n >= MAX_SLIDES;
  const goal = GOALS.find((g) => g.id === pub.goal)!;
  const fmt = FORMATS[pub.format];
  const fmtName = `${fmt.label} ${fmt.ratio}`;
  const si = STEPS.findIndex((s) => s[0] === step);

  const showToast = (msg: string, undo?: boolean) => { clearTimeout(toastT.current); setToast({ msg, undo }); toastT.current = setTimeout(() => setToast(null), undo ? 6000 : 2400); };
  const go = (s: Step) => { setStep(s); setSel(''); setAddOpen(false); };
  const goTo = (i: number) => { setCur(Math.max(0, Math.min(n - 1, i))); setSel(''); setAddOpen(false); };
  const onSelect = (key: string) => { setSel(key); setAddOpen(false); if (key) setTab(key.startsWith('foto') ? 'fotos' : 'datos'); };

  // ---- pantallas ----
  const insertAfterCurrent = (t: TemplateId, photo: number | null) => { const at = P.insertAfter(c, makeSlide(t, photo)); setCur(at); setSel(''); setAddOpen(false); };
  const removeCurrent = () => { if (n === 1) return; const lbl = label(c), num = c + 1; P.remove(c); setCur(Math.max(0, c - 1)); setSel(''); showToast(`Pantalla ${num} eliminada (${lbl})`, true); };
  const onDrop = (to: number) => (e: DragEvent) => { e.preventDefault(); if (dragFrom.current >= 0) { P.move(dragFrom.current, to); setCur(to); } dragFrom.current = -1; };

  // ---- datos de la pantalla actual ----
  const toggleField = (f: FieldKey) => { P.editSlide(c, (s) => ({ hidden: { ...s.hidden, [f]: !s.hidden[f] } })); if (sel === f) setSel(''); };
  const setField = (f: FieldKey, v: string) => P.editSlide(c, (s) => ({ overrides: { ...s.overrides, [f]: v } }), `type:${f}:${slide.id}`);
  const resetField = (f: FieldKey) => P.editSlide(c, (s) => { const o = { ...s.overrides }; delete o[f]; return { overrides: o }; });
  const selFoto = sel.startsWith('foto');
  const slotSel = selFoto ? Math.min(Number(sel.slice(4)) || 0, tpl.fotos - 1) : 0;
  const selKey = !selFoto && sel && !slide.hidden[sel as FieldKey] ? (sel as FieldKey) : null;
  const nHid = tpl.uses.filter((f) => slide.hidden[f]).length;
  const slotName = (i: number) => (tpl.fotos === 1 ? 'Foto' : i === 0 ? 'Foto principal' : `Foto ${i + 1}`);

  // ---- objetivo y diseño de la imagen principal (paso 2) ----
  const pickGoal = (id: typeof pub.goal) => P.edit((p) => {
    const own = TEMPLATES.find((t) => t.only === id)?.id;
    const first = p.slides[0], stale = !!TEMPLATES.find((t) => t.id === first.template)?.only && TEMPLATES.find((t) => t.id === first.template)?.only !== id;
    const t = own ?? (stale ? 'galeria' : first.template);
    return { goal: id, slides: p.slides.map((s, i) => (i === 0 ? { ...s, template: t, hidden: defaultHidden(t) } : s)) };
  });
  const pickCoverTemplate = (t: TemplateId) => { P.editSlide(0, (s) => ({ template: t, hidden: s.template === t ? s.hidden : defaultHidden(t) })); setCur(0); setTab('datos'); go('editar'); };
  const pickInmueble = (id: string) => { if (id !== pid) { setPid(id); P.reset({ ...initialPublication(pub.slides[0].template), format: pub.format, theme: pub.theme, typo: pub.typo, goal: pub.goal }); setCur(0); } go('diseno'); };

  const textoPieza = textoInstagram({
    titulo: slideData[0]?.f.titulo ?? "", zona: slideData[0]?.f.zona ?? "", precio: slideData[0]?.f.precio ?? "", tel: slideData[0]?.f.tel ?? "",
    tituloVisible: !!slideData[0]?.sh.titulo, zonaVisible: !!slideData[0]?.sh.zona, precioVisible: !!slideData[0]?.sh.precio, telVisible: !!slideData[0]?.sh.tel,
  });
  const formatoIg: FormatId = pub.format === 'post' || pub.format === 'feed' ? pub.format : 'feed';
  const extras = (['story', 'fb', 'post', 'feed'] as FormatId[]).filter((f) => f !== pub.format).slice(0, 3);
  const formatsOut = [pub.format, ...extras.filter((f) => extra[f])];
  const mounted = Array.from(new Set<FormatId>([formatoIg, ...formatsOut]));
  const nodosDe = (f: FormatId) => (exportRefs.current[f] ?? []).map((el) => el?.firstElementChild as HTMLElement).filter(Boolean);
  const renderImages = async () => {
    const images: Partial<Record<FormatId, Blob[]>> = {};
    for (const f of mounted) images[f] = await exportSlides(nodosDe(f), f);
    return images;
  };
  const payloadDe = (images: Partial<Record<FormatId, Blob[]>>): EstudioSavePayload => {
    const files: Partial<Record<FormatId, Blob>> = {};
    for (const f of formatsOut) if (images[f]?.[0]) files[f] = images[f]![0];
    return { inmuebleId: inm.id, state: { ...pub, template: pub.slides[0].template }, files, piezas: images[formatoIg] ?? [], caption: "" };
  };
  const download = async () => {
    setBusy('export');
    try {
      const images = await renderImages();
      (images[pub.format] ?? []).forEach((b, i) => downloadBlob(b, slideFilename(inm.ref, pub.format, i)));
    } catch { showToast('No se han podido generar las imágenes'); }
    finally { setBusy(''); }
  };
  const save = async () => {
    setBusy('export');
    try { await onSave?.(payloadDe(await renderImages())); }
    catch { /* El guardado avisa si falla. */ }
    finally { setBusy(''); }
  };
  const pedir = async () => {
    setBusy('review');
    try {
      await onReview?.({ inmuebleId: inm.id, state: { ...pub, template: pub.slides[0].template }, nota: notaRevision.trim() });
    } catch { /* La petición avisa si falla. */ }
    finally { setBusy(''); }
  };
  const publish = async () => {
    setBusy('publish');
    try {
      const images = await renderImages();
      const files = images[formatoIg] ?? [];
      if (!files.length) { showToast('No hay ninguna imagen para publicar'); return; }
      const cuerpo = new FormData();
      cuerpo.set("composicion", "1");
      cuerpo.set("propiedadId", inm.id);
      cuerpo.set("estado", JSON.stringify({ ...pub, template: pub.slides[0].template }));
      cuerpo.set("texto", textoPieza);
      files.forEach((blob, i) => cuerpo.set(`png_pieza_${i}`, blob, `pieza-${i}.png`));
      const respuesta = await fetch("/api/estudio/instagram", { method: "POST", body: cuerpo });
      const json = await respuesta.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!respuesta.ok || !json?.ok) showToast(json?.error || "No se ha publicado en Instagram");
      else showToast(files.length > 1 ? `Carrusel de ${files.length} publicado en Instagram` : "Publicado en Instagram");
    } catch { showToast("No se ha publicado en Instagram"); }
    finally { setBusy(''); }
  };

  // ---- medidas ----
  const [gw, gh] = fitBox(pub.format, 220, 268);
  const [cw, ch] = fitBox(pub.format, 440, 420);
  const peekW = Math.round(cw * .82), peekH = Math.round(ch * .82);
  const [mw, mh] = fitBox(pub.format, 36, 44);
  const [tw, th] = fitBox(pub.format, 76, 76);
  const [aw, ah] = fitBox(pub.format, 64, 64);
  const phoneW = 320, phoneH = Math.min(Math.round(phoneW * fmt.h / fmt.w), 520);
  const coverTemplates = templatesForGoal(pub.goal);
  const slideTemplates = templatesForGoal(pub.goal, { includeSlideOnly: true });
  const used = usedPhotoIndexes(pub, nF);
  const stepVal: Record<Step, string> = { inmueble: inm.ref, diseno: `${fmt.label} · ${tplName(pub.slides[0].template)}`, editar: n === 1 ? '1 imagen' : `Carrusel de ${n}`, publicar: 'Texto y salida' };
  const stepHint: Record<Step, string> = { inmueble: 'Elige el inmueble', diseno: 'Qué anuncias y diseño', editar: stepVal.editar, publicar: 'Texto y salida' };

  const pill = (on: boolean): CSSProperties => ({ ...btn, height: 34, padding: '0 12px', borderRadius: 9, border: `1px solid ${on ? k.fg : k.line2}`, background: on ? k.chip : 'transparent', color: on ? k.fg : k.mut, fontSize: 13, fontWeight: 600 });
  const sideBtn = (o: CSSProperties = {}): CSSProperties => ({ ...btn, width: 86, borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0 6px', fontSize: 12.5, fontWeight: 600, lineHeight: 1.3, textAlign: 'center', ...o });
  const iconBtn = (o: CSSProperties = {}): CSSProperties => ({ ...btn, width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center', ...o });
  const deleteBtn = (small = false) => n > 1 && (
    <button onClick={removeCurrent} aria-label={`Eliminar la pantalla ${c + 1}: ${label(c)}`} style={{ ...btn, display: 'flex', alignItems: 'center', gap: 6, height: small ? 32 : 34, padding: '0 11px 0 8px', borderRadius: 9, border: `1px solid ${k.line2}`, background: k.panel, fontSize: small ? 12.5 : 13, fontWeight: 600, color: k.danger }}><Trash2 size={15} />Eliminar pantalla {c + 1}</button>
  );
  const addPanel = (pos: 'top' | 'bottom') => addOpen === pos && (
    <div role="dialog" aria-label="Añadir pantalla" style={{ position: 'absolute', zIndex: 40, width: 'min(760px, calc(100% - 24px))', padding: '14px 16px 16px', borderRadius: 16, border: `1px solid ${k.line2}`, background: k.panel, boxShadow: '0 20px 60px rgba(0,0,0,.28)', ...(pos === 'top' ? { left: '50%', transform: 'translateX(-50%)', top: 58 } : { left: 12, bottom: 'calc(100% + 8px)' }) }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}><b style={{ fontSize: 14 }}>Añadir después de la pantalla {c + 1}</b><button onClick={() => setAddOpen(false)} aria-label="Cerrar" style={iconBtn({ width: 28, height: 28, color: k.mut })}><X size={16} /></button></div>
      <div style={{ fontSize: 12, color: k.mut, marginBottom: 6 }}>Una foto del inmueble</div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 10 }}>
        {inm.fotos.map((p, i) => (
          <button key={p.id} onClick={() => insertAfterCurrent('foto', i)} title={nombreFoto(p.nombre, i)} style={{ ...btn, flex: '0 0 auto', width: 84 }}>
            <span style={{ position: 'relative', display: 'block', width: 84, height: 64, borderRadius: 9, backgroundImage: `url("${p.url}")`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: used.includes(i) ? .55 : 1 }}>{used.includes(i) && <span style={{ position: 'absolute', right: 4, top: 4, fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: 'rgba(0,0,0,.7)', color: '#fff' }}>Ya está</span>}</span>
            <span style={{ display: 'block', fontSize: 11.5, marginTop: 4, textAlign: 'center', color: k.mut }}>{nombreFoto(p.nombre, i)}</span>
          </button>
        ))}
      </div>
      <div style={{ fontSize: 12, color: k.mut, marginBottom: 6 }}>Un diseño con datos</div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
        {slideTemplates.filter((t) => t.id !== 'foto').map((t) => (
          <button key={t.id} onClick={() => insertAfterCurrent(t.id, t.id === 'contacto' ? 0 : null)} title={t.nombre} style={{ ...btn, flex: '0 0 auto', width: 84, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'grid', placeItems: 'center', width: 84, height: 76, borderRadius: 9, background: k.stage, lineHeight: 0 }}><Creative template={t.id} data={buildSlideData(inm, pub, makeSlide(t.id, t.id === 'contacto' ? 0 : null))} width={aw} height={ah} /></span>
            <span style={{ fontSize: 11.5, color: k.mut, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 84 }}>{t.nombre}</span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="estudio-shell" style={{ background: k.bg, color: k.fg }}>
      {/* Pasos: cada uno enseña lo ya elegido */}
      <ol aria-label="Pasos" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap', listStyle: 'none', margin: 0, padding: '12px 24px', borderBottom: `1px solid ${k.line}` }}>
        {STEPS.map(([id, lbl], i) => { const on = i === si, done = i < si; return (
          <li key={id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => go(id)} aria-current={on ? 'step' : undefined} style={{ ...btn, display: 'flex', alignItems: 'center', gap: 9, height: 44, padding: '0 14px 0 8px', borderRadius: 999, background: on ? k.chip : 'transparent', color: on || done ? k.fg : k.mut }}>
              <span style={{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12.5, fontWeight: 700, background: on ? k.prim : done ? k.blue : 'transparent', color: on ? k.primFg : done ? '#fff' : k.mut, border: `1px solid ${on || done ? 'transparent' : k.line2}` }}>{done ? <Check size={15} /> : i + 1}</span>
              <span style={{ lineHeight: 1.2 }}><span style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>{lbl}</span><span style={{ display: 'block', fontSize: 11.5, opacity: .8, maxWidth: 170, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{done ? stepVal[id] : stepHint[id]}</span></span>
            </button>
            {i < STEPS.length - 1 && <span aria-hidden style={{ width: 22, height: 2, borderRadius: 2, background: done ? k.blue : k.line2 }} />}
          </li>); })}
      </ol>

      {/* 1 · Inmueble: elegir avanza solo */}
      {step === 'inmueble' && (
        <main className="estudio-scroll" style={{ padding: '32px 28px 40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
            <div><h1 style={{ fontSize: 26, margin: 0, fontWeight: 600 }}>¿De qué inmueble es la publicación?</h1><p style={{ margin: '6px 0 0', color: k.mut, fontSize: 14 }}>Al elegirlo pasas al siguiente paso.</p></div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, width: 320, maxWidth: '100%', height: 42, padding: '0 12px', border: `1px solid ${k.line2}`, borderRadius: 11, color: k.mut }}><Search size={16} /><input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Referencia, dirección o zona" aria-label="Buscar inmueble" style={{ border: 0, outline: 0, background: 'none', flex: 1, minWidth: 0, fontSize: 14, color: k.fg }} /></label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(270px,1fr))', gap: 18 }}>
            {inmuebles.filter((p) => {
              const q = busqueda.trim().toLowerCase();
              if (!q) return true;
              return [p.ref, p.titulo, p.direccion, p.zona, p.barrio].join(" ").toLowerCase().includes(q);
            }).map((p) => (
              <button key={p.id} onClick={() => pickInmueble(p.id)} aria-pressed={p.id === pid} className="estudio-card" style={{ ...btn, display: 'block', borderRadius: 16, overflow: 'hidden', background: k.panel, border: `1.5px solid ${p.id === pid ? k.blue : k.line}` }}>
                <span style={{ display: 'block', aspectRatio: '16/10', backgroundImage: p.fotos[0] ? `url("${p.fotos[0].url}")` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }} />
                <span style={{ display: 'block', padding: '14px 16px 16px' }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 12.5, color: k.mut }}>{p.ref}</span><b style={{ fontSize: 17 }}>{eur(p.precio)}</b></span>
                  <span style={{ display: 'block', fontSize: 15.5, fontWeight: 600, marginTop: 6 }}>{p.titulo}</span>
                  <span style={{ display: 'block', fontSize: 13, color: k.mut, marginTop: 3 }}>{p.zona} · {p.m2} m² · {p.fotos.length} fotos</span>
                </span>
              </button>
            ))}
          </div>
        </main>
      )}

      {/* 2 · Diseño de la imagen principal. Se empieza con UNA imagen. */}
      {step === 'diseno' && (
        <main className="estudio-scroll" style={{ padding: '28px 28px 40px' }}>
          <h1 style={{ fontSize: 26, margin: '0 0 14px', fontWeight: 600 }}>¿Qué vas a publicar?</h1>
          <div role="radiogroup" aria-label="Tipo de publicación" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(148px,1fr))', gap: 10, marginBottom: 28 }}>
            {TIPOS_PUBLICACION.map((f) => { const on = pub.format === f; const { w, h } = FORMATS[f]; const alto = Math.round(72 * h / w); return (
              <button key={f} role="radio" aria-checked={on} onClick={() => P.edit({ format: f })} style={{ ...btn, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, border: `1.5px solid ${on ? k.blue : k.line2}`, background: on ? 'rgba(76,141,255,.08)' : k.panel }}>
                <span aria-hidden style={{ width: 36, height: alto, maxHeight: 64, borderRadius: 4, border: `1.5px solid ${on ? k.blue : k.line2}`, background: k.stage, flex: '0 0 auto' }} />
                <span style={{ minWidth: 0 }}><span style={{ display: 'block', fontSize: 15, fontWeight: 650 }}>{FORMATS[f].label}</span><span style={{ display: 'block', fontSize: 12.5, color: k.mut, marginTop: 2 }}>{FORMATS[f].ratio}</span></span>
              </button>); })}
          </div>
          <h2 style={{ fontSize: 20, margin: '0 0 14px', fontWeight: 600 }}>¿Qué quieres anunciar?</h2>
          <div role="radiogroup" aria-label="Objetivo" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 }}>
            {GOALS.filter((g) => g.id !== 'bajada' || (inm.precioAnterior ?? 0) > inm.precio).map((g) => { const on = g.id === pub.goal; return (
              <button key={g.id} role="radio" aria-checked={on} onClick={() => pickGoal(g.id)} style={{ ...btn, height: 42, padding: '0 18px', borderRadius: 999, border: `1px solid ${on ? k.prim : k.line2}`, background: on ? k.prim : 'transparent', color: on ? k.primFg : k.fg, fontSize: 14.5, fontWeight: 600 }}>{g.label}</button>); })}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '14px 24px', flexWrap: 'wrap', marginBottom: 18, paddingTop: 22, borderTop: `1px solid ${k.line}` }}>
            <div><h2 style={{ fontSize: 20, margin: 0, fontWeight: 600 }}>Elige el diseño de la imagen principal</h2><p style={{ margin: '5px 0 0', color: k.mut, fontSize: 14 }}>Empiezas con una sola imagen. Después, si quieres, le añades fotos y un cierre para convertirla en carrusel.</p></div>
            <div style={{ display: 'flex', gap: '10px 16px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div role="radiogroup" aria-label="Formato" style={{ display: 'flex', gap: 4 }}>
                {TIPOS_PUBLICACION.map((f) => <button key={f} role="radio" aria-checked={pub.format === f} onClick={() => P.edit({ format: f })} style={pill(pub.format === f)}>{FORMATS[f].label} <span style={{ opacity: .7, fontWeight: 400 }}>{FORMATS[f].ratio}</span></button>)}
              </div>
              <ThemeDots value={pub.theme} onPick={(t) => P.edit({ theme: t })} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 20 }}>
            {coverTemplates.map((t) => { const on = pub.slides[0].template === t.id; return (
              <button key={t.id} onClick={() => pickCoverTemplate(t.id)} aria-pressed={on} className="estudio-card" style={{ ...btn, display: 'block', borderRadius: 16, overflow: 'hidden', background: k.panel, border: `1.5px solid ${on ? k.blue : k.line}` }}>
                <span style={{ ...stage, position: 'relative', display: 'grid', placeItems: 'center', height: 300, padding: 16 }}>
                  <span style={{ display: 'block', lineHeight: 0, boxShadow: '0 14px 34px rgba(0,0,0,.3)' }}><Creative template={t.id} data={buildSlideData(inm, pub, { ...pub.slides[0], template: t.id, hidden: on ? pub.slides[0].hidden : defaultHidden(t.id) })} width={gw} height={gh} /></span>
                  {t.rank < 2 && <span style={{ position: 'absolute', left: 12, top: 12, fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: k.blue, color: '#fff' }}>{t.rank === 0 ? 'Hecha para esto' : 'Recomendada'}</span>}
                </span>
                <span style={{ display: 'block', padding: '12px 15px 14px' }}><span style={{ display: 'flex', justifyContent: 'space-between' }}><b style={{ fontSize: 15 }}>{t.nombre}</b><span style={{ fontSize: 12, color: k.mut }}>{t.fotos === 1 ? '1 foto' : `${t.fotos} fotos`}</span></span><span style={{ display: 'block', fontSize: 12.5, color: k.mut, marginTop: 4 }}>{t.desc}</span></span>
              </button>); })}
          </div>
        </main>
      )}

      {/* 3 · Editar */}
      {step === 'editar' && (
        <div className="estudio-edit">
          {/* Panel izquierdo: la pantalla actual */}
          <aside className="estudio-side">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '14px 16px 0' }}><span style={{ fontSize: 13, fontWeight: 650 }}>Estudio</span><span style={{ fontSize: 12, color: k.mut }}>Estás editando</span></div>
            <div style={{ padding: '2px 16px 0', fontSize: 16, fontWeight: 600 }}>Pantalla {c + 1}: {label(c)}</div>
            <div role="tablist" style={{ display: 'flex', gap: 2, padding: '8px 12px 0', borderBottom: `1px solid ${k.line}` }}>
              {([['diseno', 'Diseño', LayoutTemplate], ['datos', 'Datos', Database], ['fotos', 'Fotos', ImageIcon], ['estilo', 'Estilo', Palette]] as const).map(([id, l, Icon]) => (
                <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} style={{ ...btn, display: 'flex', alignItems: 'center', gap: 6, height: 42, padding: '0 10px', fontSize: 13.5, fontWeight: 600, color: tab === id ? k.fg : k.mut, borderBottom: `2px solid ${tab === id ? k.fg : 'transparent'}`, marginBottom: -1 }}><Icon size={15} />{l}</button>
              ))}
            </div>
            <div className="estudio-side-body">
              {tab === 'diseno' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10 }}>
                  {slideTemplates.map((t) => { const on = slide.template === t.id; return (
                    <button key={t.id} onClick={() => P.setTemplate(c, t.id)} aria-pressed={on} title={t.nombre} style={{ ...btn, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                      <span style={{ display: 'grid', placeItems: 'center', width: '100%', height: 88, borderRadius: 9, border: `2px solid ${on ? k.blue : 'transparent'}`, background: k.stage, lineHeight: 0 }}><Creative template={t.id} data={buildSlideData(inm, pub, { ...slide, template: t.id })} width={tw} height={th} /></span>
                      <span style={{ fontSize: 11.5, color: on ? k.fg : k.mut, fontWeight: on ? 600 : 400 }}>{t.nombre}</span>
                    </button>); })}
                </div>
              )}
              {tab === 'datos' && (<>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 12.5 }}><span style={{ color: k.mut }}>Datos de la ficha {inm.ref}</span>{nHid > 0 && <button onClick={() => P.editSlide(c, { hidden: {} })} style={{ ...btn, fontWeight: 600, color: k.link }}>Mostrar {nHid === 1 ? 'el dato oculto' : `los ${nHid} ocultos`}</button>}</div>
                {tpl.uses.map((f) => { const hidden = !!slide.hidden[f], on = sel === f; return (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px 6px 6px', marginBottom: 5, borderRadius: 10, border: `1px solid ${on ? k.blue : k.line}`, background: on ? 'rgba(76,141,255,.08)' : 'transparent' }}>
                    <button onClick={() => toggleField(f)} aria-pressed={hidden} aria-label={`${hidden ? 'Mostrar' : 'Ocultar'} ${FIELD_LABELS[f].toLowerCase()}`} style={iconBtn({ width: 30, height: 30, color: hidden ? k.mut : k.fg })}>{hidden ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                    <button onClick={() => setSel(hidden ? '' : f)} style={{ ...btn, flex: 1, minWidth: 0, opacity: hidden ? .45 : 1 }}><span style={{ display: 'block', fontSize: 11.5, color: k.mut }}>{FIELD_LABELS[f]}</span><span style={{ display: 'block', fontSize: 13.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: hidden ? 'line-through' : 'none' }}>{f === 'logo' ? 'Automático, claro u oscuro' : data.f[f]}</span></button>
                    {slide.overrides[f] != null && <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 999, background: 'rgba(224,168,46,.18)', color: k.warn }}>Editado</span>}
                  </div>); })}
                <label style={{ display: 'flex', gap: 10, padding: '11px 12px', border: `1px solid ${k.line2}`, borderRadius: 12, marginTop: 12, fontSize: 12.5 }}>
                  <input type="checkbox" checked={pub.soloZona} onChange={() => P.edit((p) => ({ soloZona: !p.soloZona }))} style={{ accentColor: k.blue }} />
                  <span><b style={{ display: 'block' }}>Mostrar solo la zona en toda la publicación</b><span style={{ color: k.mut }}>«{inm.zona}» en vez de «{inm.direccion}».</span></span>
                </label>
              </>)}
              {tab === 'fotos' && (<>
                {tpl.fotos > 1 && (<div role="radiogroup" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>{Array.from({ length: tpl.fotos }, (_, i) => <button key={i} role="radio" aria-checked={i === slotSel} onClick={() => onSelect('foto' + i)} style={pill(i === slotSel)}>{slotName(i)}</button>)}</div>)}
                <div style={{ fontSize: 12.5, color: k.mut, marginBottom: 8 }}>¿Qué foto va en «{slotName(slotSel)}»?</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
                  {inm.fotos.map((p, i) => { const inSlot = resolveSlots(slide.slots, nF).slice(0, tpl.fotos).indexOf(i), on = inSlot === slotSel; return (
                    <button key={p.id} onClick={() => P.editSlide(c, (s) => ({ slots: assignPhoto(s.slots, nF, slotSel, i, tpl.fotos) }))} aria-pressed={on} aria-label={`Poner ${nombreFoto(p.nombre, i)} en esta pantalla`} style={{ ...btn, position: 'relative', aspectRatio: '4/3', borderRadius: 10, border: `2px solid ${on ? k.blue : 'transparent'}`, backgroundImage: `url("${p.url}")`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                      <span style={{ position: 'absolute', left: 6, bottom: 6, fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: 'rgba(0,0,0,.65)', color: '#fff' }}>{nombreFoto(p.nombre, i)}</span>
                    </button>); })}
                </div>
              </>)}
              {tab === 'estilo' && (<>
                <p style={{ fontSize: 12.5, color: k.mut, marginTop: 0 }}>Color y tipografía son iguales en todas las pantallas.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8, marginBottom: 20 }}>{(Object.keys(THEMES) as ThemeId[]).map((t) => <button key={t} onClick={() => P.edit({ theme: t })} aria-pressed={pub.theme === t} style={{ ...btn, display: 'flex', alignItems: 'center', gap: 9, padding: 8, borderRadius: 11, border: `1.5px solid ${pub.theme === t ? k.blue : k.line2}`, fontSize: 13, fontWeight: 600 }}><span style={{ width: 36, height: 28, borderRadius: 7, background: `linear-gradient(90deg, ${THEMES[t].bg} 66%, ${THEMES[t].acc} 66%)`, border: `1px solid ${k.line2}` }} />{THEMES[t].label}</button>)}</div>
                {(Object.keys(TYPOS) as TypoId[]).map((t) => <button key={t} onClick={() => P.edit({ typo: t })} aria-pressed={pub.typo === t} style={{ ...btn, display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: 8, padding: '11px 12px', borderRadius: 11, border: `1.5px solid ${pub.typo === t ? k.blue : k.line2}` }}><span style={{ fontFamily: TYPOS[t].ff, fontWeight: TYPOS[t].fw, fontSize: 22, textTransform: TYPOS[t].tt }}>Ático con vistas</span><span style={{ fontSize: 12, color: k.mut }}>{TYPOS[t].label}</span></button>)}
              </>)}
            </div>
          </aside>

          {/* Centro: la pantalla, con sus vecinas, añadir y eliminar a mano */}
          <section className="estudio-stage" style={{ ...stage, position: 'relative' }}>
            {addPanel('top')}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexShrink: 0, flexWrap: 'wrap', padding: '10px 16px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => goTo(c - 1)} disabled={c === 0} aria-label="Pantalla anterior" style={iconBtn({ border: `1px solid ${k.line2}`, background: k.panel, opacity: c === 0 ? .35 : 1 })}><ChevronLeft size={17} /></button>
                <span style={{ fontSize: 13.5, fontWeight: 600, minWidth: 118, textAlign: 'center' }}>Pantalla {c + 1} de {n}</span>
                <button onClick={() => goTo(c + 1)} disabled={c === n - 1} aria-label="Pantalla siguiente" style={iconBtn({ border: `1px solid ${k.line2}`, background: k.panel, opacity: c === n - 1 ? .35 : 1 })}><ChevronRight size={17} /></button>
                <button onClick={() => setAddOpen(addOpen === 'top' ? false : 'top')} disabled={full} style={{ ...btn, display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px 0 9px', marginLeft: 6, borderRadius: 9, background: k.prim, color: k.primFg, fontSize: 13, fontWeight: 600, opacity: full ? .4 : 1 }}><Plus size={16} />{full ? 'Máximo 10' : 'Añadir pantalla'}</button>
                {deleteBtn()}
                {!selKey && !selFoto && <span style={{ marginLeft: 6, fontSize: 12.5, color: k.mut, whiteSpace: 'nowrap' }}>Haz clic en un texto o en una foto para cambiarlos.</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12.5, color: k.mut }}>{fmtName}</span>
                <button aria-label="Deshacer" onClick={P.undo} disabled={!P.canUndo} style={iconBtn({ opacity: P.canUndo ? 1 : .3 })}><Undo2 size={17} /></button>
                <button aria-label="Rehacer" onClick={P.redo} disabled={!P.canRedo} style={iconBtn({ opacity: P.canRedo ? 1 : .3 })}><Redo2 size={17} /></button>
              </div>
            </div>

            {/* Barra de edición: solo cuando hay un texto o una foto elegidos */}
            {(selKey || selFoto) && <div style={{ display: 'flex', justifyContent: 'center', flexShrink: 0, padding: '8px 16px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', width: '100%', maxWidth: 860, padding: '4px 8px 4px 12px', borderRadius: 10, border: `1px solid ${k.blue}`, background: k.panel }}>
                {selKey && (<>
                  <label htmlFor="estudio-sel" style={{ fontSize: 12.5, fontWeight: 600, color: k.link, whiteSpace: 'nowrap' }}>{FIELD_LABELS[selKey]}</label>
                  {READONLY_FIELDS.includes(selKey) ? <span style={{ flex: 1, fontSize: 13, color: k.mut }}>{selKey === 'precio' ? `${data.f.precio} (se cambia en la ficha)` : 'Automático'}</span>
                    : <input id="estudio-sel" value={data.f[selKey]} onChange={(e) => setField(selKey, e.target.value)} style={{ flex: 1, minWidth: 60, height: 34, padding: '0 10px', border: `1px solid ${k.line2}`, borderRadius: 8, background: k.bg, color: k.fg, fontSize: 14, outline: 0 }} />}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 180px', minWidth: 160, fontSize: 12, color: k.mut }}>
                    <span>Tamaño</span>
                    <input aria-label={`Tamaño de ${FIELD_LABELS[selKey].toLowerCase()} en ${FORMATS[pub.format].label}`} type="range" min={75} max={170} step={1} value={Math.round((anidarEscala(pub.escala)[pub.format]?.[selKey] ?? 1) * 100)} onChange={(e) => P.edit((pubNow) => { const escala = anidarEscala(pubNow.escala); return { escala: { ...escala, [pubNow.format]: { ...escala[pubNow.format], [selKey]: Number(e.target.value) / 100 } } }; }, 'size:' + pub.format + ':' + selKey)} style={{ flex: 1, minWidth: 80, accentColor: k.blue }} />
                    <span style={{ width: 36, color: k.fg, fontWeight: 600 }}>{Math.round((anidarEscala(pub.escala)[pub.format]?.[selKey] ?? 1) * 100)}%</span>
                  </div>
                  {slide.overrides[selKey] != null && <button onClick={() => resetField(selKey)} style={{ ...btn, fontSize: 12.5, fontWeight: 600, color: k.mut, padding: '0 8px' }}>Restaurar</button>}
                  {((anidarEscala(pub.escala)[pub.format]?.[selKey] ?? 1) !== 1 || anidarPos(pub.pos)[pub.format]?.[selKey]) && <button onClick={() => P.edit((pubNow) => { const escala = anidarEscala(pubNow.escala); const pos = anidarPos(pubNow.pos); const e = { ...escala[pubNow.format] }; const p = { ...pos[pubNow.format] }; delete e[selKey]; delete p[selKey]; return { escala: { ...escala, [pubNow.format]: e }, pos: { ...pos, [pubNow.format]: p } }; })} style={{ ...btn, fontSize: 12.5, fontWeight: 600, color: k.mut, padding: '0 8px' }}>Auto</button>}
                  <button onClick={() => toggleField(selKey)} style={{ ...btn, display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 10px', borderRadius: 8, border: `1px solid ${k.line2}`, fontSize: 12.5, fontWeight: 600 }}><EyeOff size={15} />Ocultar</button>
                </>)}
                {selFoto && <><b style={{ fontSize: 12.5, color: k.link }}>{slotName(slotSel)}</b><span style={{ flex: 1, fontSize: 13, color: k.mut }}>Elige la foto en el panel de la izquierda.</span></>}
                <button onClick={() => setSel('')} aria-label="Quitar selección" style={iconBtn({ width: 30, color: k.mut })}><X size={16} /></button>
              </div>
            </div>}

            <div className="estudio-canvas">
              <div style={{ width: 'fit-content', marginInline: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Pantalla anterior asomando */}
                  {c > 0 ? (
                    <button onClick={() => goTo(c - 1)} aria-label={`Ir a la pantalla ${c}: ${label(c - 1)}`} className="estudio-peek" style={{ ...btn, position: 'relative', width: 86, height: peekH, overflow: 'hidden', borderRadius: 8, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', opacity: .5 }}>
                      <span style={{ lineHeight: 0, pointerEvents: 'none' }}><Creative template={pub.slides[c - 1].template} data={slideData[c - 1]} width={peekW} height={peekH} /></span>
                      <NumBadge n={c} style={{ left: 6, top: 6 }} />
                    </button>
                  ) : <span aria-hidden style={{ width: 86 }} />}
                  <div role="img" aria-label={`Pantalla ${c + 1} de ${n} en edición`} style={{ lineHeight: 0, boxShadow: `0 24px 60px rgba(0,0,0,.35), 0 0 0 1px ${k.line}` }}>
                    <Creative template={slide.template} data={data} width={cw} height={ch} editable selected={sel} onSelect={onSelect} onMove={(key, p) => P.edit((pubNow) => { const pos = anidarPos(pubNow.pos); return { pos: { ...pos, [pubNow.format]: { ...pos[pubNow.format], [key]: p } } }; }, 'move:' + pub.format + ':' + key)} />
                  </div>
                  {/* Columna derecha: siguiente pantalla o «Añadir después», y debajo «Eliminar pantalla N» apuntando a la actual */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 86, height: ch }}>
                    {c < n - 1 ? (
                      <button onClick={() => goTo(c + 1)} aria-label={`Ir a la pantalla ${c + 2}: ${label(c + 1)}`} className="estudio-peek" style={{ ...btn, position: 'relative', flex: 1, minHeight: 0, width: 86, overflow: 'hidden', borderRadius: 8, display: 'flex', alignItems: 'center', opacity: .5 }}>
                        <span style={{ lineHeight: 0, pointerEvents: 'none' }}><Creative template={pub.slides[c + 1].template} data={slideData[c + 1]} width={peekW} height={peekH} /></span>
                        <NumBadge n={c + 2} style={{ right: 6, top: 6 }} />
                      </button>
                    ) : !full && (
                      <button onClick={() => setAddOpen(addOpen === 'top' ? false : 'top')} aria-label={`Añadir una pantalla después de la ${c + 1}`} style={sideBtn({ flex: 1, minHeight: 0, border: `1.5px dashed ${addOpen === 'top' ? k.blue : k.line2}`, background: k.glass })}>
                        <span style={{ width: 32, height: 32, borderRadius: '50%', background: k.prim, color: k.primFg, display: 'grid', placeItems: 'center' }}><Plus size={17} /></span>Añadir<br />después
                      </button>
                    )}
                    {n > 1 && (
                      <button onClick={removeCurrent} aria-label={`Eliminar la pantalla ${c + 1}: ${label(c)}`} style={sideBtn({ position: 'relative', flex: '0 0 auto', height: Math.min(160, Math.max(118, Math.round(ch * .36))), border: `1.5px solid ${k.danger}`, background: k.dangerBg, color: k.danger })}>
                        {/* Pico hacia la pantalla que se borra */}
                        <span aria-hidden style={{ position: 'absolute', left: -7, top: '50%', width: 12, height: 12, marginTop: -6, transform: 'rotate(45deg)', background: k.dangerBg, borderLeft: `1.5px solid ${k.danger}`, borderBottom: `1.5px solid ${k.danger}` }} />
                        <span style={{ display: 'flex', gap: 4 }}><ArrowLeft size={15} /><Trash2 size={15} /></span>
                        <span>Eliminar<br />pantalla {c + 1}</span>
                      </button>
                    )}
                  </div>
                </div>
                {/* Puntos para ver cuántas pantallas hay y saltar entre ellas */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div role="tablist" aria-label="Pantallas de la publicación" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {pub.slides.map((s, i) => <button key={s.id} role="tab" aria-selected={i === c} aria-label={`Pantalla ${i + 1}: ${label(i)}`} onClick={() => goTo(i)} style={{ ...btn, width: i === c ? 28 : 16, height: 22, display: 'grid', placeItems: 'center' }}><span style={{ width: i === c ? 22 : 8, height: 8, borderRadius: 999, background: i === c ? k.blue : k.dotOff, transition: 'width .15s' }} /></button>)}
                  </div>
                  <b style={{ fontSize: 13 }}>{n === 1 ? '1 pantalla' : `${c + 1} de ${n}`}</b>
                  {n > 1 && <span aria-hidden style={{ width: 1, height: 18, background: k.line2 }} />}
                  {deleteBtn(true)}
                </div>
              </div>
            </div>

            {/* Una sola barra: miniaturas de la publicación y el alta, sin la tira grande */}
            <div className="estudio-tira" style={{ borderTop: `1px solid ${k.line}`, background: k.bg, padding: '8px 12px' }}>
              {addPanel('bottom')}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 52 }}>
                <b style={{ flex: '0 0 auto', fontSize: 13.5 }}>Tu publicación</b>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 auto', minWidth: 0, overflowX: 'auto', padding: '4px 2px' }}>
                  {pub.slides.map((s, i) => (
                    <button key={s.id} onClick={() => goTo(i)} aria-pressed={i === c} aria-label={`Pantalla ${i + 1}: ${label(i)}`} draggable onDragStart={() => { dragFrom.current = i; }} onDragOver={(e) => e.preventDefault()} onDrop={onDrop(i)} title={`${label(i)}. Arrastra para cambiar el orden.`} style={{ ...btn, flex: '0 0 auto', position: 'relative', width: mw + 8, height: mh + 8, borderRadius: 8, border: `2px solid ${i === c ? k.blue : 'transparent'}`, background: k.stage, display: 'grid', placeItems: 'center', cursor: 'grab', lineHeight: 0 }}>
                      <span style={{ pointerEvents: 'none' }}><Creative template={s.template} data={slideData[i]} width={mw} height={mh} /></span>
                      <span style={{ position: 'absolute', left: -4, top: -4, width: 16, height: 16, borderRadius: '50%', background: i === c ? k.blue : k.panel, color: i === c ? '#fff' : k.fg, border: `1px solid ${k.line2}`, fontSize: 10, fontWeight: 700, display: 'grid', placeItems: 'center', lineHeight: 1 }}>{i + 1}</span>
                    </button>
                  ))}
                </div>
                {!full && <button onClick={() => setAddOpen(addOpen === 'bottom' ? false : 'bottom')} aria-expanded={addOpen === 'bottom'} style={{ ...btn, flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 12px', borderRadius: 9, border: `1.5px dashed ${addOpen === 'bottom' ? k.blue : k.line2}`, fontSize: 13, fontWeight: 600 }}><Plus size={16} />Añadir</button>}
                <span style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 11px', borderRadius: 9, background: k.chip, fontWeight: 600, fontSize: 13 }}><Check size={15} />Portada</span>
                  <span style={{ display: 'flex', alignItems: 'center', height: 34, borderRadius: 9, border: `1px solid ${k.line2}` }}>
                    <button onClick={P.removePhoto} disabled={!P.photoCount} aria-label="Quitar una foto" style={iconBtn({ opacity: P.photoCount ? 1 : .35 })}>−</button>
                    <span aria-live="polite" style={{ minWidth: 64, textAlign: 'center', fontWeight: 600, fontSize: 13 }}>{P.photoCount === 0 ? 'Sin fotos' : P.photoCount === 1 ? '1 foto' : `${P.photoCount} fotos`}</span>
                    <button onClick={() => P.addPhoto(nF)} disabled={full} aria-label="Añadir una foto" style={iconBtn({ opacity: full ? .35 : 1 })}>+</button>
                  </span>
                  <button role="switch" aria-checked={P.hasClosing} onClick={P.toggleClosing} style={{ ...btn, display: 'flex', alignItems: 'center', gap: 8, height: 34, padding: '0 11px 0 8px', borderRadius: 9, border: `1px solid ${P.hasClosing ? k.fg : k.line2}`, background: P.hasClosing ? k.chip : 'transparent', fontWeight: 600, fontSize: 13 }}>
                    <span aria-hidden style={{ position: 'relative', width: 30, height: 18, borderRadius: 999, background: P.hasClosing ? k.blue : k.line2 }}><span style={{ position: 'absolute', top: 2, left: P.hasClosing ? 14 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} /></span>{P.hasClosing ? 'Con cierre' : 'Sin cierre'}
                  </button>
                </span>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* 4 · Publicar o descargar */}
      {step === 'publicar' && (
        <main className="estudio-scroll" style={{ padding: '28px 28px 40px' }}>
          <h1 style={{ fontSize: 26, margin: 0, fontWeight: 600 }}>Publicar o descargar</h1>
          <p style={{ margin: '6px 0 18px', color: k.mut, fontSize: 14 }}>{n === 1 ? `Esta es la imagen que se descarga, en ${fmtName}.` : `Estas ${n} pantallas son las que se descargan, en ${fmtName}.`}</p>
          <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8 }}>
            {pub.slides.map((s, i) => {
              const [vw, vh] = fitBox(pub.format, 220, 280);
              return (
                <div key={s.id} style={{ flex: '0 0 auto', width: vw + 28 }}>
                  <div style={{ ...stage, display: 'grid', placeItems: 'center', borderRadius: 16, padding: 14, border: `1px solid ${k.line}` }}>
                    <span style={{ display: 'block', lineHeight: 0, boxShadow: '0 14px 34px rgba(0,0,0,.35)' }}><Creative template={s.template} data={slideData[i]} width={vw} height={vh} /></span>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600 }}>{i + 1}. {label(i)}</div>
                </div>
              );
            })}
          </div>
          {puedeRevisar && (
            <label style={{ display: 'block', marginTop: 22, maxWidth: 520 }}>
              <span style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>Nota para dirección</span>
              <textarea value={notaRevision} maxLength={500} rows={3} placeholder="Qué hay que mirar de este diseño" onChange={(e) => setNotaRevision(e.target.value)} style={{ width: '100%', resize: 'vertical', borderRadius: 12, border: `1px solid ${k.line2}`, background: k.panel, color: k.fg, padding: '10px 12px', fontSize: 14 }} />
            </label>
          )}
          <section style={{ marginTop: 28, maxWidth: 720 }}>
            <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>Ver en otro formato</h2>
            <p style={{ fontSize: 12.5, color: k.mut, margin: '0 0 10px' }}>No se suma a la descarga de arriba. Si lo marcas, ves cómo queda y lo bajas aparte.</p>
            {extras.map((f) => {
              const on = !!extra[f];
              const nombre = FORMATS[f].label;
              return (
                <div key={f} style={{ padding: '8px 0', borderTop: `1px solid ${k.line}` }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, cursor: 'pointer' }}>
                    <input type="checkbox" checked={on} onChange={() => setExtra((e) => ({ ...e, [f]: !e[f] }))} style={{ accentColor: k.blue }} />
                    <span style={{ flex: 1 }}>{nombre} <span style={{ color: k.mut }}>{FORMATS[f].ratio}</span></span>
                    <span style={{ fontSize: 12, color: k.mut }}>{FORMATS[f].w}×{FORMATS[f].h}</span>
                  </label>
                  {on && (
                    <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '12px 0 4px' }}>
                      {pub.slides.map((s, i) => {
                        const [vw, vh] = fitBox(f, 120, 180);
                        return (
                          <div key={s.id} style={{ flex: '0 0 auto', textAlign: 'center' }}>
                            <div style={{ ...stage, display: 'grid', placeItems: 'center', borderRadius: 10, padding: 8 }}><Creative template={s.template} data={buildSlideData(inm, { ...pub, format: f }, s)} width={vw} height={vh} /></div>
                            <div style={{ marginTop: 4, fontSize: 11, color: k.mut }}>{i + 1}</div>
                          </div>
                        );
                      })}
                      <button onClick={async () => {
                        setBusy('export');
                        try {
                          const images = await renderImages();
                          (images[f] ?? []).forEach((b, i) => downloadBlob(b, slideFilename(inm.ref, f, i)));
                        } catch { showToast('No se han podido generar las imágenes'); }
                        finally { setBusy(''); }
                      }} disabled={!!busy} style={{ ...btn, alignSelf: 'center', height: 36, padding: '0 12px', borderRadius: 9, border: `1px solid ${k.line2}`, fontSize: 13, fontWeight: 600, opacity: busy ? .5 : 1 }}>Descargar {n === 1 ? 'esta' : `estas ${n}`}</button>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        </main>
      )}

      {/* Barra inferior: «Vista previa» siempre a mano; el botón de la derecha avanza */}
      {step !== 'inmueble' && (
        <div style={{ position: 'sticky', bottom: 0, zIndex: 30, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 28px', borderTop: `1px solid ${k.line}`, background: k.glass, backdropFilter: 'blur(12px)' }}>
          <div style={{ flex: '1 1 200px', fontSize: 13, color: k.mut }}>{step === 'diseno' ? 'Al elegir un diseño pasas a editarlo.' : step === 'editar' ? (n === 1 ? 'Una imagen. Los cambios se guardan solos.' : `Carrusel de ${n}: estás en la ${c + 1}. Los cambios se guardan solos.`) : `${pantallas(n)} en ${fmtName}.`}</div>
          {step === 'diseno' && <FootBtn onClick={() => go('inmueble')}>Cambiar inmueble</FootBtn>}
          {step === 'editar' && <FootBtn onClick={() => go('diseno')}>Ver todos los diseños</FootBtn>}
          {step === 'publicar' && <FootBtn onClick={() => go('editar')}>Seguir editando</FootBtn>}
          {(step === 'editar' || step === 'publicar') && <FootBtn onClick={() => { setPv(step === 'editar' ? c : 0); setPvOpen(true); }}><Eye size={16} />Vista previa</FootBtn>}
          {step === 'diseno' && <FootBtn primary onClick={() => go('editar')}>Editar «{tplName(pub.slides[0].template)}»</FootBtn>}
          {step === 'editar' && <FootBtn primary onClick={() => go('publicar')}>Publicar o descargar</FootBtn>}
          {step === 'publicar' && <>
            {veRevisiones && <a href="/estudio/revisiones" style={{ ...btn, display: 'inline-flex', alignItems: 'center', height: 40, padding: '0 12px', borderRadius: 10, border: `1px solid ${k.line2}`, fontSize: 13, fontWeight: 600, color: k.fg, textDecoration: 'none' }}>Revisiones</a>}
            <FootBtn onClick={download} disabled={!!busy}><Download size={16} />{busy === 'export' ? 'Generando…' : `Descargar ${n === 1 ? '1 imagen' : `${n} imágenes`}`}</FootBtn>
            {puedeRevisar
              ? <FootBtn primary onClick={pedir} disabled={!!busy}>{busy === 'review' ? 'Enviando…' : 'Pedir revisión'}</FootBtn>
              : <>
                <FootBtn onClick={save} disabled={!!busy}>Guardar en la ficha</FootBtn>
                <FootBtn primary onClick={publish} disabled={!!busy}><Instagram size={16} />{busy === 'publish' ? 'Publicando…' : 'Publicar en Instagram'}</FootBtn>
              </>}
          </>}
        </div>
      )}

      {/* Vista previa en un móvil, deslizable como en Instagram */}
      {pvOpen && (
        <div role="dialog" aria-modal="true" aria-label="Vista previa" style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.6)' }} onClick={() => setPvOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#fff', fontWeight: 600 }}>{n === 1 ? 'Así se verá publicada' : `Así se verá el carrusel de ${n}`}<button onClick={() => setPvOpen(false)} style={{ ...btn, display: 'flex', gap: 6, alignItems: 'center', height: 34, padding: '0 12px', borderRadius: 9, background: 'rgba(255,255,255,.14)', color: '#fff', fontSize: 13 }}><X size={15} />Cerrar</button></div>
            <div style={{ width: phoneW, borderRadius: 34, background: k.panel, padding: '14px 0 16px', boxShadow: '0 30px 70px rgba(0,0,0,.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 14px 10px', fontSize: 13 }}><span style={{ width: 30, height: 30, borderRadius: '50%', background: '#0A0A0A', color: '#fff', fontSize: 7, display: 'grid', placeItems: 'center' }}>RHB</span><b>rehabinco</b><span style={{ color: k.mut }}>{inm.barrio}</span></div>
              <div style={{ position: 'relative', lineHeight: 0 }}>
                <Creative template={pub.slides[pv].template} data={slideData[pv]} width={phoneW} height={phoneH} />
                {n > 1 && <>
                  <span style={{ position: 'absolute', right: 10, top: 10, fontSize: 11.5, fontWeight: 600, lineHeight: 1, padding: '5px 9px', borderRadius: 999, background: 'rgba(0,0,0,.6)', color: '#fff' }}>{pv + 1}/{n}</span>
                  {pv > 0 && <button onClick={() => setPv(pv - 1)} aria-label="Anterior" style={iconBtn({ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', borderRadius: '50%', background: 'rgba(255,255,255,.92)', color: '#0A0A0A', width: 30, height: 30 })}><ChevronLeft size={16} /></button>}
                  {pv < n - 1 && <button onClick={() => setPv(pv + 1)} aria-label="Siguiente" style={iconBtn({ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', borderRadius: '50%', background: 'rgba(255,255,255,.92)', color: '#0A0A0A', width: 30, height: 30 })}><ChevronRight size={16} /></button>}
                </>}
              </div>
              {n > 1 && <div style={{ display: 'flex', justifyContent: 'center', gap: 5, padding: '10px 0 2px' }}>{pub.slides.map((s, i) => <button key={s.id} onClick={() => setPv(i)} aria-label={`Ver pantalla ${i + 1}`} style={{ ...btn, width: i === pv ? 16 : 6, height: 6, borderRadius: 999, background: i === pv ? k.blue : k.line2 }} />)}</div>}
              <div style={{ padding: '8px 14px 0', fontSize: 12.5, lineHeight: 1.45, maxHeight: 74, overflow: 'hidden' }}><b>rehabinco</b> <span style={{ color: k.fg, whiteSpace: 'pre-line' }}>{textoPieza || 'El texto sale de lo que se ve en la portada.'}</span></div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div role="status" style={{ position: 'fixed', left: '50%', bottom: 90, transform: 'translateX(-50%)', zIndex: 70, display: 'flex', alignItems: 'center', gap: 9, padding: '11px 16px', borderRadius: 12, background: k.prim, color: k.primFg, fontSize: 13, fontWeight: 600 }}>
          <Check size={16} />{toast.msg}
          {toast.undo && <button onClick={() => { P.undo(); setToast(null); }} style={{ ...btn, marginLeft: 6, height: 28, padding: '0 10px', borderRadius: 7, border: '1px solid currentColor', fontSize: 12.5, fontWeight: 700 }}>Deshacer</button>}
        </div>
      )}

      {/* Lienzos fuera de pantalla para exportar a tamaño real (ancho/2 × pixelRatio 2) */}
      {step === 'publicar' && (
        <div aria-hidden style={{ position: 'fixed', left: -99999, top: 0, pointerEvents: 'none' }}>
          {mounted.map((f) => pub.slides.map((pantalla, i) => (
            <div key={f + pantalla.id} ref={(el) => { (exportRefs.current[f] ??= [])[i] = el; }}>
              <Creative template={pantalla.template} data={buildSlideData(inm, { ...pub, format: f }, pantalla)} width={FORMATS[f].w / 2} height={FORMATS[f].h / 2} />
            </div>
          )))}
        </div>
      )}
    </div>
  );
}

function NumBadge({ n, on, style }: { n: number; on?: boolean; style: CSSProperties }) {
  return <span style={{ position: 'absolute', width: 22, height: 22, borderRadius: '50%', background: on ? k.blue : k.panel, color: on ? '#fff' : k.fg, border: `1px solid ${k.line2}`, fontSize: 11.5, fontWeight: 700, lineHeight: 1, display: 'grid', placeItems: 'center', ...style }}>{n}</span>;
}

function FootBtn({ children, onClick, primary, disabled }: { children: ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean }) {
  return <button onClick={onClick} disabled={disabled} style={{ ...btn, display: 'flex', alignItems: 'center', gap: 8, height: 42, padding: '0 18px', borderRadius: 11, fontSize: 14, fontWeight: 600, opacity: disabled ? .5 : 1, background: primary ? k.prim : k.panel, color: primary ? k.primFg : k.fg, border: `1px solid ${primary ? k.prim : k.line2}` }}>{children}</button>;
}

function ThemeDots({ value, onPick }: { value: ThemeId; onPick: (t: ThemeId) => void }) {
  return (
    <div role="radiogroup" aria-label="Color" style={{ display: 'flex', gap: 5 }}>
      {(Object.keys(THEMES) as ThemeId[]).map((t) => (
        <button key={t} role="radio" aria-checked={value === t} aria-label={`Color ${THEMES[t].label}`} title={THEMES[t].label} onClick={() => onPick(t)} style={{ ...btn, width: 32, height: 32, borderRadius: '50%', border: `2px solid ${value === t ? k.blue : 'transparent'}`, display: 'grid', placeItems: 'center' }}>
          <span style={{ width: 22, height: 22, borderRadius: '50%', background: THEMES[t].bg, border: `1px solid ${k.line2}`, display: 'grid', placeItems: 'center' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: THEMES[t].acc }} /></span>
        </button>
      ))}
    </div>
  );
}
