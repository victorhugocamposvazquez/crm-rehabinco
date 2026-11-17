'use client';
/**
 * Estudio de creatividades · asistente de 4 pasos (Inmueble → Diseño → Editar → Descargar).
 *
 * Referencia funcional del prototipo `Estudio.dc.html`. Los estilos van en línea con los valores exactos
 * del diseño para que sea fácil de comparar; al integrarlo, cambia `k` por los tokens del CRM y los
 * botones / inputs por los de `components/ui`. La lógica (estado, huecos de foto, deshacer, exportar) ya es la definitiva.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Database, Download, Eye, EyeOff, Image as ImageIcon, Instagram, Palette, Redo2, Search, Undo2, X } from 'lucide-react';
import { FIELD_LABELS, FORMATS, GOALS, READONLY_FIELDS, TEMPLATES, THEMES, TYPOS, fitBox, templatesForGoal, type FieldKey, type FormatId, type TemplateId, type ThemeId, type TypoId } from "@/lib/estudio/config";
import { datosDePieza, FORMATOS_COMPOSICION, MAX_COMPOSICION, type PiezaComposicion } from "@/lib/estudio/composicion";
import { AGENCIA, anidarEscala, anidarPos, assignPhoto, baseFields, buildCreativeData, initialCreativeState, resolveSlots, type CreativeState, type InmuebleEstudio } from "@/lib/estudio/data";
import { Creative } from "@/components/estudio/templates";
import { useCreative } from "@/lib/estudio/useCreative";
import { creativeFilename, downloadBlob, exportCreativePng } from "@/lib/estudio/exportCreative";
import { textoInstagram } from "@/lib/estudio/instagram";
import "@/components/estudio/estudio.css";

const k = {
  bg: "var(--background)", glass: "var(--surface)", panel: "var(--surface)", hover: "var(--surface-soft)", line: "var(--border)", line2: "var(--input)",
  fg: "var(--foreground)", mut: "var(--text-2)", prim: "var(--accent)", primFg: "var(--accent-foreground)", stage: "var(--pdf-desk)", chip: "var(--accent-soft)", blue: "#4C8DFF", blueInk: "var(--blue)", warn: "var(--amber)",
};
const eur = (n: number) => n.toLocaleString('es-ES') + ' €';
const STEPS = [['inmueble', 'Inmueble'], ['diseno', 'Diseño'], ['editar', 'Editar'], ['descargar', 'Descargar']] as const;
type Step = (typeof STEPS)[number][0];
type Tab = 'datos' | 'fotos' | 'estilo';
const btn: CSSProperties = { font: 'inherit', color: 'inherit', border: 0, background: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' };
const stage: CSSProperties = { background: k.stage };

export type EstudioSavePayload = { inmuebleId: string; state: CreativeState; files: Partial<Record<FormatId, Blob>>; caption: string };
export type EstudioWizardProps = {
  inmuebles: InmuebleEstudio[];
  /** Si se entra desde la ficha, el inmueble viene elegido y se abre en el paso 2. */
  initialInmuebleId?: string;
  agencia?: { telefono: string; web: string; cta: string };
  /** Sube los PNG a Storage y guarda la fila en `creatividades`. */
  onSave?: (payload: EstudioSavePayload) => Promise<void> | void;
};

export function EstudioWizard({ inmuebles, initialInmuebleId, onSave, agencia }: EstudioWizardProps) {
  if (agencia?.telefono) AGENCIA.telefono = agencia.telefono;
  if (agencia?.web) AGENCIA.web = agencia.web;
  if (agencia?.cta) AGENCIA.cta = agencia.cta;
  const [pid, setPid] = useState(initialInmuebleId ?? inmuebles[0]?.id ?? '');
  const [busqueda, setBusqueda] = useState("");
  const [step, setStep] = useState<Step>(initialInmuebleId ? 'diseno' : 'inmueble');
  const { state: st, edit, undo, redo, reset, canUndo, canRedo } = useCreative();
  const [sel, setSel] = useState('');
  const [tab, setTab] = useState<Tab>('datos');
  const [lay, setLay] = useState<'todas' | 'collage' | 'una'>('todas');
  const [exp, setExp] = useState<Partial<Record<FormatId, boolean>>>({ post: true, story: true });
  type PiezaUi = PiezaComposicion & { id: string };
  const [piezas, setPiezas] = useState<PiezaUi[] | null>(null);
  const [formatoComp, setFormatoComp] = useState<Extract<FormatId, 'post' | 'feed'>>('feed');
  const compRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [busy, setBusy] = useState<'' | 'export' | 'instagram'>('');
  const exportRefs = useRef<Partial<Record<FormatId, HTMLDivElement | null>>>({});
  const lienzoRef = useRef<HTMLDivElement>(null);
  const [lienzo, setLienzo] = useState({ w: 760, h: 680 });
  const [previa, setPrevia] = useState(false);
  const previaRef = useRef<HTMLDivElement>(null);
  const [previaCaja, setPreviaCaja] = useState({ w: 960, h: 760 });

  useEffect(() => {
    const el = lienzoRef.current;
    if (!el) return;
    const medir = () => {
      const w = Math.floor(el.clientWidth - 56);
      const h = Math.floor(el.clientHeight - 32);
      if (w < 120 || h < 120) return;
      setLienzo((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [step]);

  useEffect(() => {
    if (!previa) return;
    const cerrar = (e: KeyboardEvent) => { if (e.key === 'Escape') setPrevia(false); };
    window.addEventListener('keydown', cerrar);
    return () => window.removeEventListener('keydown', cerrar);
  }, [previa]);

  useEffect(() => {
    const el = previaRef.current;
    if (!el || !previa) return;
    const medir = () => {
      const w = Math.floor(el.clientWidth - 32);
      const h = Math.floor(el.clientHeight - 24);
      if (w < 160 || h < 160) return;
      setPreviaCaja((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [previa, st.format]);

  const inm = inmuebles.find((i) => i.id === pid);
  const data = useMemo(() => (inm ? buildCreativeData(inm, st) : null), [inm, st]);
  if (!inm || !data) return <p style={{ padding: 32, color: k.mut }}>No hay inmuebles con fotos para crear una creatividad.</p>;

  const tpl = TEMPLATES.find((t) => t.id === st.template)!;
  const goal = GOALS.find((g) => g.id === st.goal)!;
  const forGoal = templatesForGoal(st.goal);
  const nF = inm.fotos.length;
  const slots = resolveSlots(st.slots, nF);
  const selFoto = sel.startsWith('foto');
  const slotSel = selFoto ? Math.min(Number(sel.slice(4)) || 0, tpl.fotos - 1) : 0;
  const selKey = !selFoto && sel && !st.hidden[sel as FieldKey] ? (sel as FieldKey) : null;
  const base = baseFields(inm, st);
  const nHid = tpl.uses.filter((f) => st.hidden[f]).length;
  const expSel = (Object.keys(FORMATS) as FormatId[]).filter((f) => exp[f]);
  const si = STEPS.findIndex((s) => s[0] === step);
  const slotName = (i: number) => (i === 0 ? 'Foto principal' : `Foto ${i + 1}`);
  const go = (s: Step) => { setStep(s); setSel(''); };
  const onSelect = (key: string) => { setSel(key); if (key) setTab(key.startsWith('foto') ? 'fotos' : 'datos'); };

  const toggleField = (f: FieldKey) => { edit((s) => ({ hidden: { ...s.hidden, [f]: !s.hidden[f] } })); if (sel === f) setSel(''); };
  const setField = (f: FieldKey, v: string) => edit((s) => ({ overrides: { ...s.overrides, [f]: v } }), 'type:' + f);
  const resetField = (f: FieldKey) => edit((s) => { const o = { ...s.overrides }; delete o[f]; return { overrides: o }; });
  const pickGoal = (id: typeof st.goal) => edit((s) => {
    const own = TEMPLATES.find((t) => t.only === id)?.id;
    const cur = TEMPLATES.find((t) => t.id === s.template)!;
    const o = { ...s.overrides }; delete o.badge;
    return { goal: id, overrides: o, template: own ?? (cur.only && cur.only !== id ? 'galeria' : s.template) };
  });
  const pickInmueble = (id: string) => { if (id !== pid) { setPid(id); reset({ ...initialCreativeState, format: st.format, theme: st.theme, typo: st.typo }); setPiezas(null); } go('diseno'); };

  const exportAll = async (download: boolean) => {
    setBusy('export');
    try {
      const files: Partial<Record<FormatId, Blob>> = {};
      for (const f of expSel) {
        const node = exportRefs.current[f]?.firstElementChild as HTMLElement | null;
        if (!node) continue;
        files[f] = await exportCreativePng(node, f);
        if (download) downloadBlob(files[f]!, creativeFilename(inm.ref, st.template, f));
      }
      await onSave?.({ inmuebleId: inm.id, state: st, files, caption: '' });
    } finally { setBusy(''); }
  };
  const publicarInstagram = async () => {
    setBusy('instagram');
    try {
      const files: Partial<Record<FormatId, Blob>> = {};
      for (const f of expSel) {
        const node = exportRefs.current[f]?.firstElementChild as HTMLElement | null;
        if (!node) continue;
        files[f] = await exportCreativePng(node, f);
      }
      if (!Object.keys(files).length) { toast.error("No hay ninguna imagen para publicar."); return; }
      const cuerpo = new FormData();
      cuerpo.set("propiedadId", inm.id);
      cuerpo.set("estado", JSON.stringify(st));
      cuerpo.set("texto", textoInstagram({
        titulo: data.f.titulo, zona: data.f.zona, precio: data.f.precio, tel: data.f.tel,
        tituloVisible: data.sh.titulo, zonaVisible: data.sh.zona, precioVisible: data.sh.precio, telVisible: data.sh.tel,
      }));
      for (const [formato, blob] of Object.entries(files)) if (blob) cuerpo.set(`png_${formato}`, blob, `${formato}.png`);
      const respuesta = await fetch("/api/estudio/instagram", { method: "POST", body: cuerpo });
      const json = await respuesta.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!respuesta.ok || !json?.ok) toast.error(json?.error || "No se ha publicado en Instagram.");
      else toast.success("Publicado en Instagram.");
    } catch { toast.error("No se ha publicado en Instagram."); }
    finally { setBusy(''); }
  };
  const secuencia: PiezaUi[] = piezas ?? [{ id: 'actual', tipo: 'diseno', template: st.template }];
  const alTope = secuencia.length >= MAX_COMPOSICION;
  const moverPieza = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= secuencia.length) return;
    const next = [...secuencia];
    const [item] = next.splice(i, 1);
    next.splice(j, 0, item!);
    setPiezas(next);
  };
  const anadirPieza = (pieza: PiezaComposicion) => {
    if (alTope) return;
    setPiezas([...secuencia, { ...pieza, id: crypto.randomUUID() }]);
  };
  const blobsComposicion = async () => {
    const files: Blob[] = [];
    for (let i = 0; i < secuencia.length; i += 1) {
      const node = compRefs.current[i]?.firstElementChild as HTMLElement | null;
      if (!node) continue;
      files.push(await exportCreativePng(node, formatoComp));
    }
    return files;
  };
  const descargarComposicion = async () => {
    setBusy('export');
    try {
      const files = await blobsComposicion();
      files.forEach((blob, i) => downloadBlob(blob, `${inm.ref}_composicion_${String(i + 1).padStart(2, '0')}.png`));
    } catch { toast.error("No se ha podido generar la composición."); }
    finally { setBusy(''); }
  };
  const publicarComposicion = async () => {
    setBusy('instagram');
    try {
      const files = await blobsComposicion();
      if (!files.length) { toast.error("No hay ninguna pieza para publicar."); return; }
      const cuerpo = new FormData();
      cuerpo.set("composicion", "1");
      cuerpo.set("propiedadId", inm.id);
      cuerpo.set("estado", JSON.stringify(st));
      cuerpo.set("texto", textoInstagram({
        titulo: data.f.titulo, zona: data.f.zona, precio: data.f.precio, tel: data.f.tel,
        tituloVisible: data.sh.titulo, zonaVisible: data.sh.zona, precioVisible: data.sh.precio, telVisible: data.sh.tel,
      }));
      files.forEach((blob, i) => cuerpo.set(`png_pieza_${i}`, blob, `pieza-${i}.png`));
      const respuesta = await fetch("/api/estudio/instagram", { method: "POST", body: cuerpo });
      const json = await respuesta.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!respuesta.ok || !json?.ok) toast.error(json?.error || "No se ha publicado en Instagram.");
      else toast.success(files.length > 1 ? "Carrusel publicado en Instagram." : "Publicado en Instagram.");
    } catch { toast.error("No se ha publicado en Instagram."); }
    finally { setBusy(''); }
  };

  const NEXT: Record<Step, { to: Step | null; label: string }> = {
    inmueble: { to: 'diseno', label: 'Elegir diseño' }, diseno: { to: 'editar', label: `Editar «${tpl.nombre}»` }, editar: { to: 'descargar', label: 'Revisar y descargar' },
    descargar: { to: null, label: busy === 'export' ? 'Generando…' : expSel.length ? `Descargar ${expSel.length} ${expSel.length === 1 ? 'imagen' : 'imágenes'}` : 'Elige un formato' },
  };
  const BACK: Partial<Record<Step, { to: Step; label: string }>> = { diseno: { to: 'inmueble', label: 'Cambiar inmueble' }, editar: { to: 'diseno', label: 'Ver todos los diseños' }, descargar: { to: 'editar', label: 'Seguir editando' } };
  const stepVal: Record<Step, string> = { inmueble: inm.ref, diseno: `${goal.label} · ${tpl.nombre}`, editar: nHid ? `${nHid} ${nHid === 1 ? 'dato oculto' : 'datos ocultos'}` : 'Datos, fotos y estilo', descargar: `${expSel.length} ${expSel.length === 1 ? 'formato' : 'formatos'}` };
  const stepHint: Record<Step, string> = { inmueble: 'Elige el inmueble', diseno: 'Objetivo y diseño', editar: 'Datos, fotos y estilo', descargar: 'Formatos' };

  const pill = (on: boolean): CSSProperties => ({ ...btn, height: 34, padding: '0 12px', borderRadius: 9, border: `1px solid ${on ? k.fg : k.line2}`, background: on ? k.chip : 'transparent', color: on ? k.fg : k.mut, fontSize: 13, fontWeight: 600 });
  const formatPills = () => (
    <div role="radiogroup" aria-label="Formato" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {(Object.keys(FORMATS) as FormatId[]).map((f) => (
        <button key={f} role="radio" aria-checked={st.format === f} title={FORMATS[f].ratio} onClick={() => edit({ format: f })} style={pill(st.format === f)}>{FORMATS[f].label}</button>
      ))}
    </div>
  );
  const [gw, gh] = fitBox(st.format, 236, 268);
  const [cw, ch] = fitBox(st.format, lienzo.w, lienzo.h);
  const [mw, mh] = fitBox(st.format, 72, 60);

  return (
    <div className="estudio-shell" style={{ background: k.bg, color: k.fg }}>
      {/* Pasos: cada uno enseña lo ya elegido */}
      <ol aria-label="Pasos" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap', listStyle: 'none', margin: 0, padding: '12px 24px', borderBottom: `1px solid ${k.line}` }}>
        {STEPS.map(([id, label], i) => {
          const cur = i === si, done = i < si;
          return (
            <li key={id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button onClick={() => go(id)} aria-current={cur ? 'step' : undefined} style={{ ...btn, display: 'flex', alignItems: 'center', gap: 9, height: 44, padding: '0 14px 0 8px', borderRadius: 999, background: cur ? k.chip : 'transparent', color: cur || done ? k.fg : k.mut }}>
                <span style={{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12.5, fontWeight: 700, background: cur ? k.prim : done ? k.blue : 'transparent', color: cur ? k.primFg : done ? '#fff' : k.mut, border: `1px solid ${cur || done ? 'transparent' : k.line2}` }}>{done ? <Check size={15} /> : i + 1}</span>
                <span style={{ lineHeight: 1.2 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>{label}</span>
                  <span style={{ display: 'block', fontSize: 11.5, opacity: 0.8, color: done ? k.fg : k.mut, maxWidth: 170, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{done ? stepVal[id] : stepHint[id]}</span>
                </span>
              </button>
              {i < STEPS.length - 1 && <span aria-hidden style={{ width: 22, height: 2, borderRadius: 2, background: done ? k.blue : k.line2 }} />}
            </li>
          );
        })}
      </ol>

      {/* 1 · Inmueble: elegir avanza solo */}
      {step === 'inmueble' && (
        <main className="estudio-scroll" style={{ padding: '32px 28px 40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
            <div><h1 style={{ fontSize: 26, margin: 0, fontWeight: 600, letterSpacing: '-.02em' }}>¿De qué inmueble es la creatividad?</h1><p style={{ margin: '6px 0 0', color: k.mut, fontSize: 14 }}>Al elegirlo pasas al siguiente paso.</p></div>
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
                  <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}><span style={{ fontSize: 12.5, color: k.mut }}>{p.ref}</span><span style={{ fontSize: 17, fontWeight: 700 }}>{eur(p.precio)}</span></span>
                  <span style={{ display: 'block', fontSize: 15.5, fontWeight: 600, marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.titulo}</span>
                  <span style={{ display: 'block', fontSize: 13, color: k.mut, marginTop: 3 }}>{p.zona} · {p.m2} m² · {p.habitaciones} hab.</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13 }}><span style={{ width: 24, height: 24, borderRadius: '50%', background: p.agente.color, color: '#fff', fontSize: 10, fontWeight: 700, display: 'grid', placeItems: 'center' }}>{p.agente.iniciales}</span>{p.agente.nombre}<span style={{ marginLeft: 'auto', color: k.mut, fontSize: 12 }}>{p.fotos.length} fotos</span></span>
                </span>
              </button>
            ))}
          </div>
        </main>
      )}

      {/* 2 · Diseño: primero el objetivo, después la plantilla */}
      {step === 'diseno' && (
        <main className="estudio-scroll" style={{ padding: '28px 28px 40px' }}>
          <h1 style={{ fontSize: 26, margin: '0 0 14px', fontWeight: 600, letterSpacing: '-.02em' }}>¿Qué quieres anunciar?</h1>
          <div role="radiogroup" aria-label="Objetivo de la creatividad" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 26 }}>
            {GOALS.filter((g) => g.id !== 'bajada' || (inm.precioAnterior ?? 0) > inm.precio).map((g) => {
              const on = g.id === st.goal;
              return <button key={g.id} role="radio" aria-checked={on} onClick={() => pickGoal(g.id)} style={{ ...btn, height: 42, padding: '0 18px', borderRadius: 999, border: `1px solid ${on ? k.prim : k.line2}`, background: on ? k.prim : 'transparent', color: on ? k.primFg : k.fg, fontSize: 14.5, fontWeight: 600 }}>{g.label}</button>;
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px 24px', flexWrap: 'wrap', marginBottom: 18, paddingTop: 20, borderTop: `1px solid ${k.line}` }}>
            <div><h2 style={{ fontSize: 18, margin: 0, fontWeight: 600 }}>Elige un diseño</h2><p style={{ margin: '4px 0 0', color: k.mut, fontSize: 13.5 }}>Con las fotos y los datos de «{inm.titulo}». Todo se puede cambiar después.</p></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px 18px', flexWrap: 'wrap' }}>
              <div role="radiogroup" aria-label="Tipo de diseño" style={{ display: 'flex', gap: 4 }}>
                {([['todas', 'Todos'], ['collage', 'Collage'], ['una', 'Una foto']] as const).map(([id, l]) => <button key={id} role="radio" aria-checked={lay === id} onClick={() => setLay(id)} style={pill(lay === id)}>{l}</button>)}
              </div>
              {formatPills()}
              <ThemeDots value={st.theme} onPick={(t) => edit({ theme: t })} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 22 }}>
            {forGoal.filter((t) => lay === 'todas' || (lay === 'collage') === t.fotos > 1).map((t) => (
              <button key={t.id} onClick={() => { edit((s) => ({ template: t.id, hidden: t.id === 'hogar' ? { ...s.hidden, tel: false } : s.hidden })); go('editar'); }} aria-pressed={t.id === st.template} className="estudio-card" style={{ ...btn, display: 'block', borderRadius: 16, overflow: 'hidden', background: k.panel, border: `1.5px solid ${t.id === st.template ? k.blue : k.line}` }}>
                <span style={{ ...stage, position: 'relative', display: 'grid', placeItems: 'center', height: 300, padding: 16 }}>
                  <span style={{ display: 'block', lineHeight: 0, boxShadow: '0 14px 34px rgba(0,0,0,.4)' }}><Creative template={t.id} data={data} width={gw} height={gh} /></span>
                  {t.rank < 2 && <span style={{ position: 'absolute', left: 12, top: 12, fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: k.blue, color: '#fff' }}>{t.rank === 0 ? 'Hecha para esto' : 'Recomendada'}</span>}
                  <span className="estudio-use" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '26px 14px 14px', background: 'linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.82))', display: 'flex', justifyContent: 'center' }}><span style={{ height: 36, padding: '0 16px', borderRadius: 10, background: '#fff', color: '#0A0A0A', fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center' }}>Usar este diseño</span></span>
                </span>
                <span style={{ display: 'block', padding: '13px 15px 15px' }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span style={{ fontSize: 15, fontWeight: 600 }}>{t.nombre}</span><span style={{ fontSize: 12, color: k.mut, whiteSpace: 'nowrap' }}>{t.fotos === 1 ? '1 foto' : `${t.fotos} fotos`}</span></span>
                  <span style={{ display: 'block', fontSize: 12.5, color: k.mut, marginTop: 4, lineHeight: 1.4 }}>{t.desc}</span>
                  {t.fotos > nF && <span style={{ display: 'block', fontSize: 12, color: k.warn, marginTop: 6, lineHeight: 1.4 }}>Usa {t.fotos} fotos y este inmueble tiene {nF}: se repetirá alguna.</span>}
                </span>
              </button>
            ))}
          </div>
        </main>
      )}

      {/* 3 · Editar */}
      {step === 'editar' && (
        <div className="estudio-edit">
          <div className="estudio-side" style={{ borderRight: `1px solid ${k.line}` }}>
            <div role="tablist" aria-label="Panel de edición" style={{ display: 'flex', gap: 2, padding: '8px 16px 0', borderBottom: `1px solid ${k.line}` }}>
              {([['datos', 'Datos', Database], ['fotos', 'Fotos', ImageIcon], ['estilo', 'Estilo', Palette]] as const).map(([id, l, Icon]) => (
                <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} style={{ ...btn, display: 'flex', alignItems: 'center', gap: 7, height: 42, padding: '0 12px', fontSize: 13.5, fontWeight: 600, color: tab === id ? k.fg : k.mut, borderBottom: `2px solid ${tab === id ? k.fg : 'transparent'}`, marginBottom: -1 }}><Icon size={15} />{l}</button>
              ))}
            </div>
            <div className="estudio-side-body">
              {tab === 'datos' && (<>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10, minHeight: 28 }}>
                  <span style={{ fontSize: 12.5, color: k.mut }}>Datos de la ficha {inm.ref}</span>
                  {nHid > 0 && <button onClick={() => edit({ hidden: {} })} style={{ ...btn, fontSize: 12.5, fontWeight: 600, color: k.blueInk }}>Mostrar {nHid === 1 ? 'el dato oculto' : `los ${nHid} ocultos`}</button>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {tpl.uses.map((f) => {
                    const hidden = !!st.hidden[f], on = sel === f, edited = st.overrides[f] != null;
                    return (
                      <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px 6px 6px', borderRadius: 10, border: `1px solid ${on ? k.blue : k.line}`, background: on ? 'rgba(76,141,255,.08)' : 'transparent' }}>
                        <button onClick={() => toggleField(f)} aria-pressed={hidden} aria-label={`${hidden ? 'Mostrar' : 'Ocultar'} ${FIELD_LABELS[f].toLowerCase()}`} style={{ ...btn, width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', color: hidden ? k.mut : k.fg }}>{hidden ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                        <button onClick={() => setSel(hidden ? '' : f)} style={{ ...btn, flex: 1, minWidth: 0, opacity: hidden ? 0.45 : 1 }}>
                          <span style={{ display: 'block', fontSize: 11.5, color: k.mut }}>{FIELD_LABELS[f]}</span>
                          <span style={{ display: 'block', fontSize: 13.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: hidden ? 'line-through' : 'none' }}>{f === 'logo' ? 'Automático, claro u oscuro' : data.f[f]}</span>
                        </button>
                        {edited && <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 999, background: 'rgba(245,196,81,.15)', color: k.warn }}>Editado</span>}
                      </div>
                    );
                  })}
                </div>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 12px', border: `1px solid ${k.line2}`, borderRadius: 12, marginTop: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={st.soloZona} onChange={() => edit((s) => ({ soloZona: !s.soloZona }))} style={{ margin: '2px 0 0', width: 16, height: 16, accentColor: k.blue }} />
                  <span style={{ fontSize: 12.5, lineHeight: 1.4 }}><span style={{ display: 'block', fontWeight: 600 }}>Mostrar solo la zona</span><span style={{ color: k.mut }}>«{inm.zona}» en vez de «{inm.direccion}».</span></span>
                </label>
              </>)}

              {tab === 'fotos' && (<>
                <div style={{ fontSize: 12.5, color: k.mut, marginBottom: 8 }}>{tpl.fotos === 1 ? 'Este diseño usa una foto.' : `Este diseño usa ${tpl.fotos} fotos. Elige el hueco:`}</div>
                <div role="radiogroup" aria-label="Hueco de foto" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                  {Array.from({ length: tpl.fotos }, (_, i) => (
                    <button key={i} role="radio" aria-checked={i === slotSel} onClick={() => onSelect('foto' + i)} style={{ ...btn, display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px 4px 4px', borderRadius: 10, border: `1.5px solid ${i === slotSel ? k.blue : k.line2}`, background: i === slotSel ? 'rgba(76,141,255,.08)' : 'transparent', fontSize: 12.5, fontWeight: 600 }}>
                      <span style={{ width: 44, height: 34, borderRadius: 6, backgroundImage: data.ph[i], backgroundSize: 'cover', backgroundPosition: 'center' }} />{slotName(i)}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 12.5, color: k.mut, marginBottom: 8 }}>¿Qué foto va en «{slotName(slotSel)}»?</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
                  {inm.fotos.map((p, i) => {
                    const inSlot = slots.slice(0, tpl.fotos).indexOf(i), on = inSlot === slotSel;
                    return (
                      <button key={p.id} onClick={() => edit((s) => ({ slots: assignPhoto(s.slots, nF, slotSel, i, tpl.fotos) }))} aria-pressed={on} aria-label={`Poner ${p.nombre} como ${slotName(slotSel).toLowerCase()}`} style={{ ...btn, position: 'relative', display: 'block', aspectRatio: '4/3', borderRadius: 10, overflow: 'hidden', border: `2px solid ${on ? k.blue : k.line2}`, backgroundImage: `url("${p.url}")`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                        <span style={{ position: 'absolute', left: 6, bottom: 6, fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 6, background: 'rgba(0,0,0,.65)', color: '#fff' }}>{p.nombre}</span>
                        {inSlot >= 0 && <span style={{ position: 'absolute', left: 6, top: 6, width: 20, height: 20, borderRadius: '50%', background: k.blue, color: '#fff', fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center' }}>{inSlot + 1}</span>}
                      </button>
                    );
                  })}
                </div>
              </>)}

              {tab === 'estilo' && (<>
                <h2 style={{ fontSize: 13, margin: '0 0 8px', fontWeight: 600 }}>Color</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8, marginBottom: 20 }}>
                  {(Object.keys(THEMES) as ThemeId[]).map((t) => (
                    <button key={t} onClick={() => edit({ theme: t })} aria-pressed={st.theme === t} style={{ ...btn, display: 'flex', alignItems: 'center', gap: 9, padding: 8, borderRadius: 11, border: `1.5px solid ${st.theme === t ? k.blue : k.line2}`, fontSize: 13, fontWeight: 600 }}>
                      <span aria-hidden style={{ display: 'flex', width: 36, height: 28, borderRadius: 7, overflow: 'hidden', border: `1px solid ${k.line2}` }}><span style={{ flex: 1, background: THEMES[t].bg }} /><span style={{ width: 12, background: THEMES[t].acc }} /></span>{THEMES[t].label}
                    </button>
                  ))}
                </div>
                <h2 style={{ fontSize: 13, margin: '0 0 8px', fontWeight: 600 }}>Tipografía de los titulares</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(Object.keys(TYPOS) as TypoId[]).map((t) => (
                    <button key={t} onClick={() => edit({ typo: t })} aria-pressed={st.typo === t} style={{ ...btn, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 12px', borderRadius: 11, border: `1.5px solid ${st.typo === t ? k.blue : k.line2}` }}>
                      <span style={{ fontFamily: TYPOS[t].ff, fontWeight: TYPOS[t].fw, fontSize: 22, textTransform: TYPOS[t].tt, letterSpacing: TYPOS[t].ls }}>Ático con vistas</span><span style={{ fontSize: 12, color: k.mut }}>{TYPOS[t].label}</span>
                    </button>
                  ))}
                </div>
              </>)}
            </div>
          </div>

          <div className="estudio-stage">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', padding: '10px 16px 0' }}>
              {formatPills()}
              <div style={{ display: 'flex', gap: 2 }}>
                <button aria-label="Deshacer" title="Deshacer" onClick={undo} disabled={!canUndo} style={{ ...btn, width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center', opacity: canUndo ? 1 : 0.3 }}><Undo2 size={17} /></button>
                <button aria-label="Rehacer" title="Rehacer" onClick={redo} disabled={!canRedo} style={{ ...btn, width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center', opacity: canRedo ? 1 : 0.3 }}><Redo2 size={17} /></button>
              </div>
            </div>

            {/* Barra de edición pegada a la pieza */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 16px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', width: '100%', maxWidth: 760, minHeight: 48, padding: '6px 8px 6px 14px', borderRadius: 13, border: `1px solid ${selKey || selFoto ? k.blue : k.line}`, background: k.panel, boxShadow: '0 1px 2px rgba(0,0,0,.04)' }}>
                {!selKey && !selFoto && <span style={{ fontSize: 13, color: k.mut }}>Haz clic en un texto para cambiarlo, moverlo o ajustar el tamaño. En una foto, para cambiarla.</span>}
                {selKey && (<>
                  <label htmlFor="estudio-sel" style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', color: k.blueInk }}>{FIELD_LABELS[selKey]}</label>
                  {READONLY_FIELDS.includes(selKey)
                    ? <span style={{ flex: '1 1 140px', minWidth: 0, fontSize: 13, color: k.mut }}>{selKey === 'precio' ? `${base.precio} (se cambia en la ficha)` : 'Automático, claro u oscuro'}</span>
                    : <input id="estudio-sel" value={data.f[selKey]} onChange={(e) => setField(selKey, e.target.value)} style={{ flex: '1 1 140px', minWidth: 60, height: 34, padding: '0 10px', border: `1px solid ${k.line2}`, borderRadius: 8, background: k.bg, color: k.fg, fontSize: 14, outline: 0 }} />}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 220px', minWidth: 180, fontSize: 12, color: k.mut }}>
                    <span style={{ whiteSpace: 'nowrap' }}>Tamaño</span>
                    <input aria-label={`Tamaño de ${FIELD_LABELS[selKey].toLowerCase()} en ${FORMATS[st.format].label}`} type="range" min={75} max={170} step={1} value={Math.round((anidarEscala(st.escala)[st.format]?.[selKey] ?? 1) * 100)} onChange={(e) => edit((s) => { const escala = anidarEscala(s.escala); return { escala: { ...escala, [s.format]: { ...escala[s.format], [selKey]: Number(e.target.value) / 100 } } }; }, 'size:' + st.format + ':' + selKey)} style={{ flex: 1, minWidth: 120, accentColor: k.blue }} />
                    <span style={{ width: 36, color: k.fg, fontWeight: 600 }}>{Math.round((anidarEscala(st.escala)[st.format]?.[selKey] ?? 1) * 100)}%</span>
                  </div>
                  {st.overrides[selKey] != null && <button onClick={() => resetField(selKey)} title="Volver al dato de la ficha" style={{ ...btn, height: 34, padding: '0 10px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: k.mut }}>Restaurar</button>}
                  {((anidarEscala(st.escala)[st.format]?.[selKey] ?? 1) !== 1 || anidarPos(st.pos)[st.format]?.[selKey]) && <button onClick={() => edit((s) => { const escala = anidarEscala(s.escala); const pos = anidarPos(s.pos); const e = { ...escala[s.format] }; const p = { ...pos[s.format] }; delete e[selKey]; delete p[selKey]; return { escala: { ...escala, [s.format]: e }, pos: { ...pos, [s.format]: p } }; })} title={`Volver al tamaño y al sitio de ${FORMATS[st.format].label}`} style={{ ...btn, height: 34, padding: '0 10px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: k.mut }}>Auto</button>}
                  <button onClick={() => toggleField(selKey)} style={{ ...btn, display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 10px', borderRadius: 8, border: `1px solid ${k.line2}`, fontSize: 12.5, fontWeight: 600 }}><EyeOff size={15} />Ocultar</button>
                </>)}
                {selFoto && (<><span style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', color: k.blueInk }}>{slotName(slotSel)}</span><span style={{ flex: 1, fontSize: 13, color: k.mut }}>Elige la foto para este hueco en el panel de la izquierda.</span></>)}
                {(selKey || selFoto) && <button onClick={() => setSel('')} aria-label="Quitar selección" style={{ ...btn, width: 30, height: 34, display: 'grid', placeItems: 'center', color: k.mut }}><X size={16} /></button>}
              </div>
            </div>

            <div ref={lienzoRef} className="estudio-canvas">
              <div role="img" aria-label="Creatividad en edición" style={{ lineHeight: 0, boxShadow: '0 18px 50px rgba(20,16,12,.16)' }}>
                <Creative template={st.template} data={data} width={cw} height={ch} editable selected={sel} onSelect={onSelect} onMove={(key, p) => edit((s) => { const pos = anidarPos(s.pos); return { pos: { ...pos, [s.format]: { ...pos[s.format], [key]: p } } }; }, 'move:' + st.format + ':' + key)} />
              </div>
            </div>

            {/* Tira para probar otro diseño sin perder los cambios */}
            <div style={{ borderTop: `1px solid ${k.line}`, background: k.panel, padding: '10px 16px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12.5 }}><span style={{ fontWeight: 600 }}>Probar otro diseño <span style={{ fontWeight: 400, color: k.mut }}>(se conservan tus cambios)</span></span><button onClick={() => go('diseno')} style={{ ...btn, fontWeight: 600, color: k.blueInk }}>Ver galería</button></div>
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
                {forGoal.map((t) => (
                  <button key={t.id} onClick={() => { edit((s) => ({ template: t.id, hidden: t.id === 'hogar' ? { ...s.hidden, tel: false } : s.hidden })); setSel(''); }} aria-pressed={t.id === st.template} title={t.nombre} style={{ ...btn, flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, width: 84 }}>
                    <span style={{ display: 'grid', placeItems: 'center', width: 84, height: 72, borderRadius: 9, border: `2px solid ${t.id === st.template ? k.blue : 'transparent'}`, background: k.stage, lineHeight: 0 }}><Creative template={t.id} data={data} width={mw} height={mh} /></span>
                    <span style={{ fontSize: 11, color: t.id === st.template ? k.fg : k.mut, fontWeight: t.id === st.template ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 84 }}>{t.nombre}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4 · Descargar */}
      {step === 'descargar' && (
        <main className="estudio-scroll" style={{ padding: '32px 28px 40px' }}>
          <h1 style={{ fontSize: 26, margin: 0, fontWeight: 600, letterSpacing: '-.02em' }}>Revisa y descarga</h1>
          <p style={{ margin: '6px 0 18px', color: k.mut, fontSize: 14 }}>Monta la publicación con fotos y diseños, en el orden que quieras. Hasta {MAX_COMPOSICION} piezas, todas en el mismo formato.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {FORMATOS_COMPOSICION.map((f) => <button key={f} type="button" aria-pressed={formatoComp === f} onClick={() => setFormatoComp(f)} style={pill(formatoComp === f)}>{FORMATS[f].label} {FORMATS[f].ratio}</button>)}
          </div>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
            {secuencia.map((pieza, i) => {
              const [pw, ph] = fitBox(formatoComp, 148, 190);
              const plantilla = pieza.tipo === 'foto' ? 'foto' as const : pieza.template;
              const fotoPieza = pieza.tipo === 'foto' ? inm.fotos[pieza.foto] : null;
              const nombre = pieza.tipo === 'diseno'
                ? (TEMPLATES.find((t) => t.id === pieza.template)?.nombre || 'Diseño')
                : (fotoPieza && !/^foto\s*\d+$/i.test(fotoPieza.nombre.trim()) ? fotoPieza.nombre : 'Foto');
              return (
                <div key={pieza.id} style={{ flex: '0 0 168px', border: `1px solid ${k.line}`, borderRadius: 14, background: k.panel, overflow: 'hidden' }}>
                  <div style={{ ...stage, display: 'grid', placeItems: 'center', height: 210 }}><Creative template={plantilla} data={datosDePieza(inm, st, pieza, formatoComp)} width={pw} height={ph} /></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 8px 10px' }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i + 1}. {nombre}</span>
                    <button type="button" aria-label="Mover atrás" disabled={i === 0} onClick={() => moverPieza(i, -1)} style={{ ...btn, width: 26, height: 26, display: 'grid', placeItems: 'center', opacity: i === 0 ? 0.3 : 1 }}><ChevronLeft size={16} /></button>
                    <button type="button" aria-label="Mover adelante" disabled={i === secuencia.length - 1} onClick={() => moverPieza(i, 1)} style={{ ...btn, width: 26, height: 26, display: 'grid', placeItems: 'center', opacity: i === secuencia.length - 1 ? 0.3 : 1 }}><ChevronRight size={16} /></button>
                    <button type="button" aria-label="Quitar pieza" onClick={() => setPiezas(secuencia.filter((_, j) => j !== i))} style={{ ...btn, width: 26, height: 26, display: 'grid', placeItems: 'center', color: k.mut }}><X size={15} /></button>
                  </div>
                </div>
              );
            })}
          </div>
          {!secuencia.length && <p style={{ margin: '8px 0 0', color: k.mut, fontSize: 13.5 }}>Añade fotos o diseños para armar la publicación.</p>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <FootBtn onClick={descargarComposicion} disabled={!secuencia.length || busy !== ''}>Descargar composición</FootBtn>
            <FootBtn onClick={publicarComposicion} disabled={!secuencia.length || busy !== ''}><Instagram size={16} />{busy === 'instagram' ? 'Publicando…' : 'Publicar composición'}</FootBtn>
          </div>
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Añadir una foto</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {inm.fotos.map((foto, i) => {
                const generica = /^foto\s*\d+$/i.test(foto.nombre.trim());
                return (
                <button key={foto.id} type="button" disabled={alTope} onClick={() => anadirPieza({ tipo: 'foto', foto: i })} title={generica ? `Foto ${i + 1}` : foto.nombre} style={{ ...btn, width: 72, overflow: 'hidden', opacity: alTope ? 0.4 : 1 }}>
                  <span style={{ display: 'block', height: 54, borderRadius: 8, backgroundImage: `url("${foto.url}")`, backgroundSize: 'cover', backgroundPosition: 'center', border: `1px solid ${k.line}` }} />
                  <span style={{ display: 'block', marginTop: 4, fontSize: 11, color: k.mut, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{generica ? i + 1 : foto.nombre}</span>
                </button>
                );
              })}
            </div>
          </div>
          <div style={{ marginTop: 16, marginBottom: 28 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Añadir un diseño</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {forGoal.map((t) => <button key={t.id} type="button" disabled={alTope} onClick={() => anadirPieza({ tipo: 'diseno', template: t.id })} style={{ ...pill(false), opacity: alTope ? 0.4 : 1 }}>{t.nombre}</button>)}
            </div>
          </div>
          <h2 style={{ fontSize: 18, margin: '0 0 6px', fontWeight: 600 }}>Un solo formato</h2>
          <p style={{ margin: '0 0 16px', color: k.mut, fontSize: 13.5 }}>La pieza que estás editando, adaptada a cada formato.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 16, maxWidth: 1100 }}>
              {(Object.keys(FORMATS) as FormatId[]).map((f) => {
                const [vw, vh] = fitBox(f, 190, 248), on = !!exp[f];
                return (
                  <label key={f} style={{ display: 'block', borderRadius: 16, overflow: 'hidden', background: k.panel, border: `1.5px solid ${on ? k.blue : k.line}`, cursor: 'pointer' }}>
                    <span style={{ ...stage, display: 'grid', placeItems: 'center', height: 280, padding: 16 }}><span style={{ display: 'block', lineHeight: 0, boxShadow: '0 14px 34px rgba(0,0,0,.4)' }}><Creative template={st.template} data={buildCreativeData(inm, { ...st, format: f })} width={vw} height={vh} /></span></span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
                      <input type="checkbox" checked={on} onChange={() => setExp((e) => ({ ...e, [f]: !e[f] }))} style={{ width: 17, height: 17, margin: 0, accentColor: k.blue }} />
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{FORMATS[f].label} <span style={{ fontWeight: 400, color: k.mut }}>{FORMATS[f].ratio}</span></span>
                      <span style={{ fontSize: 12, color: k.mut }}>{FORMATS[f].w}×{FORMATS[f].h}</span>
                    </span>
                  </label>
                );
              })}
          </div>
        </main>
      )}

      {/* Barra inferior */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 28px', borderTop: `1px solid ${k.line}`, background: k.glass }}>
        <div style={{ flex: '1 1 200px', minWidth: 0, fontSize: 13, color: k.mut }}>{step === 'editar' ? `El tamaño y la posición valen solo para ${FORMATS[st.format].label}.` : step === 'diseno' ? 'Al elegir un diseño pasas a editarlo. Podrás cambiarlo sin perder nada.' : step === 'descargar' ? 'La composición se publica con su botón. Aquí, los formatos marcados.' : ''}</div>
        {BACK[step] && <FootBtn onClick={() => go(BACK[step]!.to)}>{BACK[step]!.label}</FootBtn>}
        {(step === 'editar' || step === 'descargar') && <FootBtn onClick={() => setPrevia(true)}><Eye size={16} />Vista previa</FootBtn>}
        {step === 'descargar' && <FootBtn onClick={() => exportAll(false)} disabled={!expSel.length || busy !== ''}>Guardar en la ficha</FootBtn>}
        {step === 'descargar' && <FootBtn onClick={publicarInstagram} disabled={!expSel.length || busy !== ''}><Instagram size={16} />{busy === 'instagram' ? 'Publicando…' : 'Publicar en Instagram'}</FootBtn>}
        <FootBtn primary disabled={busy !== '' || (step === 'descargar' && !expSel.length)} onClick={() => (NEXT[step].to ? go(NEXT[step].to!) : exportAll(true))}>{step === 'descargar' && <Download size={16} />}{NEXT[step].label}</FootBtn>
      </div>

      {/* Lienzos fuera de pantalla para exportar a tamaño real: 540 px de ancho × pixelRatio 2 = 1080 */}
      {step === 'descargar' && (
        <div aria-hidden style={{ position: 'fixed', left: -99999, top: 0, pointerEvents: 'none' }}>
          {expSel.map((f) => { const w = FORMATS[f].w / 2, hh = FORMATS[f].h / 2; return <div key={f} ref={(el) => { exportRefs.current[f] = el; }}><Creative template={st.template} data={buildCreativeData(inm, { ...st, format: f })} width={w} height={hh} /></div>; })}
          {secuencia.map((pieza, i) => {
            const w = FORMATS[formatoComp].w / 2, hh = FORMATS[formatoComp].h / 2;
            const plantilla: TemplateId = pieza.tipo === 'foto' ? 'foto' : pieza.template;
            return <div key={pieza.id} ref={(el) => { compRefs.current[i] = el; }}><Creative template={plantilla} data={datosDePieza(inm, st, pieza, formatoComp)} width={w} height={hh} /></div>;
          })}
        </div>
      )}

      {previa && (() => {
        const [pw, ph] = fitBox(st.format, previaCaja.w, previaCaja.h);
        const fmt = FORMATS[st.format];
        return (
          <div role="dialog" aria-modal="true" aria-label="Vista previa de la creatividad" onClick={() => setPrevia(false)} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,.78)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px', color: '#fff' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 650 }}>{tpl.nombre}</div>
                <div style={{ fontSize: 12.5, opacity: 0.75, marginTop: 2 }}>{fmt.label} · {fmt.w}×{fmt.h}</div>
              </div>
              <button type="button" aria-label="Cerrar vista previa" onClick={() => setPrevia(false)} style={{ ...btn, display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 14px', borderRadius: 10, color: '#fff', border: '1px solid rgba(255,255,255,.28)', background: 'rgba(255,255,255,.08)', fontSize: 13.5, fontWeight: 600 }}><X size={16} />Cerrar</button>
            </div>
            <div ref={previaRef} style={{ flex: 1, minHeight: 0, display: 'grid', placeItems: 'center', padding: '0 16px 20px' }}>
              <div onClick={(e) => e.stopPropagation()} style={{ boxShadow: '0 24px 70px rgba(0,0,0,.45)', lineHeight: 0 }}>
                <Creative template={st.template} data={data} width={pw} height={ph} />
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function FootBtn({ children, onClick, primary, disabled }: { children: ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean }) {
  return <button onClick={onClick} disabled={disabled} style={{ ...btn, display: 'flex', alignItems: 'center', gap: 8, height: 42, padding: '0 18px', borderRadius: 11, fontSize: 14, fontWeight: 600, opacity: disabled ? 0.5 : 1, background: primary ? k.prim : 'transparent', color: primary ? k.primFg : k.fg, border: `1px solid ${primary ? k.prim : k.line2}` }}>{children}</button>;
}

function ThemeDots({ value, onPick }: { value: ThemeId; onPick: (t: ThemeId) => void }) {
  return (
    <div role="radiogroup" aria-label="Color de las plantillas" style={{ display: 'flex', gap: 5 }}>
      {(Object.keys(THEMES) as ThemeId[]).map((t) => (
        <button key={t} role="radio" aria-checked={value === t} aria-label={`Color ${THEMES[t].label}`} title={THEMES[t].label} onClick={() => onPick(t)} style={{ ...btn, width: 32, height: 32, borderRadius: '50%', border: `2px solid ${value === t ? k.blue : 'transparent'}`, display: 'grid', placeItems: 'center' }}>
          <span aria-hidden style={{ width: 22, height: 22, borderRadius: '50%', background: THEMES[t].bg, border: `1px solid ${k.line2}`, display: 'grid', placeItems: 'center' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: THEMES[t].acc }} /></span>
        </button>
      ))}
    </div>
  );
}
