"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import {
  COPILOTO_MAX_BYTES,
  COPILOTO_MAX_FILES,
  type CopilotoOutput,
  type EstadoCopiloto,
  type HistorialCopiloto,
  type LineaCopiloto,
} from "@/lib/ai/presupuesto-copiloto";
import { diffPresupuesto, euro, importeLineas } from "@/lib/ai/presupuesto-diff";
import { totalesAmpliacion } from "@/lib/presupuesto-totales";
import { avisosDePartida, chipsDePartida, tonoChip } from "@/lib/presupuesto-propuesta";
import { ArrowLeft, ArrowUp, Plus, Sparkles, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Msg = HistorialCopiloto & { files?: string[] };

const LOGO_REHABINCO = "/images/logo-web.png";
const LOGO_GARAL = "/images/presupuestos/garal-negro.png";

function LogoRehabinco({ className, alt = "Rehabinco" }: { className?: string; alt?: string }) {
  return <img src={LOGO_REHABINCO} alt={alt} className={cn("object-contain", className)} />;
}

function ChipVista({ etiqueta, tono }: { etiqueta: string; tono?: ReturnType<typeof tonoChip> }) {
  const t = tono ?? tonoChip(etiqueta);
  const cls =
    t === "oscuro"
      ? "bg-neutral-900 text-white"
      : t === "aviso"
        ? "bg-red-700 text-white"
        : t === "azul"
          ? "bg-[#E7EEF2] text-[#3A6A82]"
          : "bg-neutral-100 text-neutral-600";
  return (
    <span className={cn("inline-block px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]", cls)}>
      {etiqueta}
    </span>
  );
}

function claveArchivos(list: File[]) {
  return list.map((f) => `${f.name}:${f.size}:${f.lastModified}`).join("|");
}

async function leerRespuestaCopiloto(res: Response): Promise<{ output?: CopilotoOutput; error?: string }> {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("text/event-stream") && res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let last: { output?: CopilotoOutput; error?: string } | null = null;
    const consume = (chunk: string) => {
      const line = chunk.split("\n").find((l) => l.startsWith("data:"));
      if (!line) return;
      const json = line.replace(/^data:\s?/, "").trim();
      if (!json) return;
      try {
        last = JSON.parse(json) as { output?: CopilotoOutput; error?: string };
      } catch {
        /* keep-alive */
      }
    };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const chunks = buf.split("\n\n");
      buf = chunks.pop() ?? "";
      for (const chunk of chunks) consume(chunk);
    }
    buf += decoder.decode();
    if (buf.trim()) consume(buf);
    return last ?? { error: "El copiloto se cortó antes de terminar. Inténtalo de nuevo." };
  }
  try {
    return (await res.json()) as { output?: CopilotoOutput; error?: string };
  } catch {
    if (res.status === 502 || res.status === 504) {
      return {
        error: "El servidor cortó la petición. Prueba con menos adjuntos o un archivo más pequeño.",
      };
    }
    return { error: "No se pudo leer la respuesta del copiloto." };
  }
}

function mergeFiles(current: File[], incoming: FileList | File[]): { next: File[]; error?: string } {
  const next = [...current];
  for (const file of Array.from(incoming)) {
    const name = file.name.toLowerCase();
    if (name.endsWith(".doc") && !name.endsWith(".docx")) {
      return { next: current, error: `${file.name} es .doc antiguo. Guárdalo como .docx.` };
    }
    if (next.some((f) => f.name === file.name && f.size === file.size)) continue;
    if (next.length >= COPILOTO_MAX_FILES) {
      return { next, error: `Máximo ${COPILOTO_MAX_FILES} archivos en la mesa.` };
    }
    next.push(file);
  }
  const bytes = next.reduce((acc, f) => acc + f.size, 0);
  if (bytes > COPILOTO_MAX_BYTES) {
    return { next: current, error: "Los adjuntos superan 4 MB. Comprime el PDF o quita algún archivo." };
  }
  return { next };
}

function canvasDesdeEstado(estado: EstadoCopiloto): CopilotoOutput {
  return {
    resumen: "",
    sugerencias: [],
    concepto: estado.concepto,
    porcentaje_descuento: estado.porcentaje_descuento,
    lineas: estado.lineas,
    propuesta: estado.propuesta,
  };
}

export function PresupuestoCopiloto({
  estado,
  onAccept,
  liveApply = false,
}: {
  estado: EstadoCopiloto;
  onAccept: (output: CopilotoOutput) => void;
  /** En el wizard, cada respuesta actualiza el formulario (como el lienzo de Design). */
  liveApply?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sentFileKey, setSentFileKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState<CopilotoOutput | null>(null);
  const [undoStack, setUndoStack] = useState<CopilotoOutput[]>([]);
  const [mobilePane, setMobilePane] = useState<"chat" | "canvas">("chat");
  const inputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const fileKey = useMemo(() => claveArchivos(files), [files]);
  const hayArchivosNuevos = files.length > 0 && fileKey !== sentFileKey;
  const canSend = !!text.trim() || hayArchivosNuevos;
  const canvas = draft ?? canvasDesdeEstado(estado);
  const dirty = draft !== null;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => composerRef.current?.focus(), 80);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  const applyCanvas = (output: CopilotoOutput) => {
    setUndoStack((s) => [...s.slice(-11), draft ?? canvasDesdeEstado(estado)]);
    setDraft(output);
    if (liveApply) onAccept(output);
  };

  const send = async (opts?: { files: File[]; instrucciones: string; nuevos: boolean }) => {
    const mesa = opts?.files ?? files;
    const instrucciones = (opts?.instrucciones ?? text).trim();
    const nuevos = opts?.nuevos ?? hayArchivosNuevos;
    if ((!instrucciones && !nuevos) || busy) return;
    setBusy(true);
    const form = new FormData();
    form.append(
      "payload",
      JSON.stringify({
        instrucciones,
        historial: messages.map(({ role, text: t }) => ({ role, text: t })),
        estado,
        borrador: draft,
      })
    );
    for (const file of mesa) form.append("files", file);
    const ac = new AbortController();
    const timeout = window.setTimeout(() => ac.abort(), 58_000);
    try {
      const res = await fetch("/api/presupuestos/copiloto", { method: "POST", body: form, signal: ac.signal });
      const data = await leerRespuestaCopiloto(res);
      if (!data.output) {
        toast.error(data.error || "No se pudo generar la propuesta.");
        return;
      }
      const output = data.output;
      setMessages((m) => [
        ...m,
        {
          role: "user",
          text: instrucciones || "Leer lo que hay en la mesa y actualizar el documento",
          files: nuevos ? mesa.map((f) => f.name) : [],
        },
        { role: "assistant", text: output.resumen },
      ]);
      applyCanvas(output);
      setMobilePane("canvas");
      setText("");
      setSentFileKey(claveArchivos(mesa));
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === "AbortError";
      toast.error(aborted ? "Tardó demasiado. Vuelve a intentarlo; si se repite, envía un Word cada vez." : "No se pudo contactar con el copiloto.");
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
    }
  };

  const addIncoming = (list: FileList | File[] | null, autoLeer: boolean) => {
    if (!list || (list as FileList).length === 0) return;
    const { next, error } = mergeFiles(files, list);
    if (error) {
      toast.error(error);
      if (next === files) return;
    }
    setFiles(next);
    if (inputRef.current) inputRef.current.value = "";
    const nuevos = claveArchivos(next) !== sentFileKey;
    if (autoLeer && next.length > 0 && nuevos && !busy) {
      void send({ files: next, instrucciones: "", nuevos: true });
    }
  };

  const undo = () => {
    setUndoStack((s) => {
      if (s.length === 0) return s;
      const prev = s[s.length - 1];
      setDraft(prev);
      if (liveApply) onAccept(prev);
      return s.slice(0, -1);
    });
  };

  const commit = () => {
    if (!draft) return;
    onAccept(draft);
    toast.success(liveApply ? "El formulario ya está al día." : "Guardado en el presupuesto.");
  };

  return (
    <>
      <Button type="button" variant="secondary" size="sm" className="shrink-0 gap-1.5" onClick={() => setOpen(true)}>
        <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
        Copiloto
      </Button>
      <Sheet open={open} onOpenChange={setOpen} variant="studio">
        <div
          className="relative flex h-full min-h-0 flex-col"
          onDragEnter={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addIncoming(e.dataTransfer.files, messages.length === 0 && !draft);
          }}
        >
          {dragging && (
            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-[#1c1917]/30 backdrop-blur-[2px]">
              <p className="rounded-3xl bg-white px-8 py-5 text-[15px] font-medium shadow-xl">
                Suelta el archivo para añadirlo al chat
              </p>
            </div>
          )}
          <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(20rem,24.5rem)_minmax(0,1fr)]">
            <section
              className={cn(
                "flex h-full min-h-0 flex-col bg-[#f3f1ed]",
                mobilePane === "canvas" ? "hidden md:flex" : "flex"
              )}
            >
              <header className="flex h-12 shrink-0 items-center gap-1 px-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 hover:bg-black/5"
                  aria-label="Cerrar"
                >
                  <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
                </button>
                <LogoRehabinco className="h-7 w-auto max-w-[140px] sm:h-8" />
                <span className="min-w-0 flex-1" />
                <button
                  type="button"
                  className="rounded-full px-3 py-1.5 text-[13px] font-medium text-neutral-600 hover:bg-black/5 md:hidden"
                  onClick={() => setMobilePane("canvas")}
                >
                  Documento
                </button>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                {messages.length === 0 && (
                  <div className="px-1 pt-8">
                    <LogoRehabinco className="mb-6 h-9 w-auto max-w-[180px]" />
                    <p className="text-[22px] font-medium leading-snug tracking-tight text-neutral-900">
                      ¿Qué presupuesto montamos?
                    </p>
                    <p className="mt-3 text-[15px] leading-relaxed text-neutral-500">
                      Suelta el Word o PDF. Luego ve pidiendo cambios, como en Design: un total, quitar una partida,
                      turnos, otra ampliación encima.
                    </p>
                  </div>
                )}
                <div className="space-y-5">
                  {messages.map((m, i) =>
                    m.role === "user" ? (
                      <div key={`u-${i}`} className="flex justify-end">
                        <div className="max-w-[92%] rounded-3xl bg-white px-4 py-2.5 text-[15px] leading-relaxed text-neutral-900 shadow-[0_1px_2px_rgba(28,25,23,0.06)]">
                          <p className="whitespace-pre-wrap">{m.text}</p>
                          {m.files && m.files.length > 0 && (
                            <p className="mt-1.5 text-[13px] text-neutral-400">{m.files.join(" · ")}</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div key={`a-${i}`} className="px-1 text-[15px] leading-relaxed text-neutral-800">
                        <p className="whitespace-pre-wrap">{m.text}</p>
                      </div>
                    )
                  )}
                </div>
                {busy && (
                  <p className="mt-5 px-1 text-[15px] text-neutral-400">
                    {draft ? "Corrigiendo el documento…" : "Leyendo y montando…"}
                  </p>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="shrink-0 px-3 pb-3 pt-1">
                {files.length > 0 && (
                  <ul className="mb-2 flex flex-wrap gap-1.5 px-1">
                    {files.map((f, i) => (
                      <li
                        key={`${f.name}-${i}`}
                        className="inline-flex max-w-[220px] items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[12px] text-neutral-600 shadow-[0_1px_2px_rgba(28,25,23,0.06)]"
                      >
                        <span className="truncate">{f.name}</span>
                        <button type="button" aria-label={`Quitar ${f.name}`} onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}>
                          <X className="h-3 w-3" strokeWidth={2} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="rounded-[1.65rem] border border-black/[0.06] bg-white p-2 shadow-[0_8px_28px_rgba(28,25,23,0.06)]">
                  <textarea
                    ref={composerRef}
                    className="min-h-[52px] w-full resize-none bg-transparent px-3 py-2 text-[15px] leading-relaxed text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none"
                    rows={2}
                    placeholder="Pide un cambio o suelta un archivo…"
                    value={text}
                    disabled={busy}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                  />
                  <div className="flex items-center justify-between px-1 pb-0.5">
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
                      aria-label="Adjuntar"
                      disabled={busy}
                      onClick={() => inputRef.current?.click()}
                    >
                      <Plus className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                    <input
                      ref={inputRef}
                      type="file"
                      multiple
                      accept="application/pdf,.pdf,.docx,.txt,.md,.csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/csv"
                      className="hidden"
                      onChange={(e) => addIncoming(e.target.files, messages.length === 0 && !draft)}
                    />
                    <button
                      type="button"
                      disabled={busy || !canSend}
                      onClick={() => void send()}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-white disabled:opacity-30"
                      aria-label="Enviar"
                    >
                      <ArrowUp className="h-4 w-4" strokeWidth={2.2} />
                    </button>
                  </div>
                </div>
              </div>
            </section>
            <DocumentoVivo
              estado={estado}
              canvas={canvas}
              dirty={dirty}
              liveApply={liveApply}
              empty={!dirty && estado.lineas.filter((l) => l.descripcion.trim()).length === 0}
              version={undoStack.length + 1}
              canUndo={undoStack.length > 0}
              onUndo={undo}
              onCommit={!liveApply && dirty ? commit : undefined}
              onShowChat={() => setMobilePane("chat")}
              hiddenOnMobile={mobilePane === "chat"}
            />
          </div>
        </div>
      </Sheet>
    </>
  );
}

function DocumentoVivo({
  estado,
  canvas,
  dirty,
  liveApply,
  empty,
  version,
  canUndo,
  onUndo,
  onCommit,
  onShowChat,
  hiddenOnMobile,
}: {
  estado: EstadoCopiloto;
  canvas: CopilotoOutput;
  dirty: boolean;
  liveApply: boolean;
  empty: boolean;
  version: number;
  canUndo: boolean;
  onUndo: () => void;
  onCommit?: () => void;
  onShowChat: () => void;
  hiddenOnMobile: boolean;
}) {
  const p = canvas.propuesta;
  const ampliacion = p.tipo === "ampliacion";
  const tot = ampliacion
    ? totalesAmpliacion({
        lineas: canvas.lineas,
        bajas: p.bajas ?? [],
        ajusteComercial: p.ajuste_comercial ?? 0,
        origenTotal: p.origen_total ?? 0,
        porcentajeImpuesto: estado.porcentaje_impuesto,
      })
    : null;
  const base = tot ? tot.incrementoNeto : importeLineas(canvas.lineas);
  const diff = dirty
    ? diffPresupuesto({
        conceptoActual: estado.concepto,
        descuentoActual: estado.porcentaje_descuento,
        lineasActuales: estado.lineas,
        propuesta: canvas,
      })
    : null;
  const grupos = new Map<string, LineaCopiloto[]>();
  for (const l of canvas.lineas.filter((x) => x.descripcion.trim())) {
    const key = l.capitulo.trim() || "Partidas";
    const arr = grupos.get(key) ?? [];
    arr.push(l);
    grupos.set(key, arr);
  }
  const titulo = canvas.concepto?.trim() || "Documento";

  return (
    <section
      className={cn(
        "flex h-full min-h-0 flex-col bg-[#e8e5df]",
        hiddenOnMobile ? "hidden md:flex" : "flex"
      )}
    >
      <header className="flex h-12 shrink-0 items-center gap-2 px-3">
        <button
          type="button"
          className="rounded-full px-3 py-1.5 text-[13px] font-medium text-neutral-600 hover:bg-black/5 md:hidden"
          onClick={onShowChat}
        >
          Chat
        </button>
        <p className="min-w-0 flex-1 truncate text-[13px] text-neutral-500">
          {titulo}
          <span className="ml-2 text-neutral-400">v{version}</span>
          {ampliacion ? <span className="ml-2 text-neutral-400">Ampliación</span> : null}
        </p>
        {diff && (
          <span className="hidden truncate text-[12px] text-neutral-400 lg:inline">
            {euro(diff.baseAntes)} → {euro(diff.baseDespues)}
          </span>
        )}
        <button
          type="button"
          disabled={!canUndo}
          onClick={onUndo}
          className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-600 hover:bg-black/5 disabled:opacity-30"
          aria-label="Deshacer"
        >
          <Undo2 className="h-4 w-4" strokeWidth={1.75} />
        </button>
        {onCommit && (
          <button
            type="button"
            onClick={onCommit}
            className="rounded-full bg-neutral-900 px-3 py-1.5 text-[13px] font-medium text-white"
          >
            Guardar
          </button>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-1 md:px-8 md:pb-8 md:pt-2">
        {empty ? (
          <div className="flex h-full min-h-[280px] items-center justify-center">
            <div className="max-w-sm rounded-[1.75rem] bg-white/80 px-8 py-12 text-center shadow-[0_12px_40px_rgba(28,25,23,0.06)]">
              <LogoRehabinco className="mx-auto mb-6 h-10 w-auto max-w-[200px]" />
              <p className="text-[17px] font-medium tracking-tight">El documento sale aquí</p>
              <p className="mt-2 text-[14px] leading-relaxed text-neutral-500">
                Como el lienzo de Design: suelta un Word a la izquierda y este panel se va actualizando.
              </p>
            </div>
          </div>
        ) : (
          <article className="mx-auto min-h-full max-w-[52rem] rounded-[1.5rem] bg-white px-6 py-8 shadow-[0_16px_50px_rgba(28,25,23,0.08)] md:px-12 md:py-12">
            <div className="mb-8 flex items-start justify-between gap-4">
              <img
                src={estado.emisor === "garal" ? LOGO_GARAL : LOGO_REHABINCO}
                alt={estado.emisor === "garal" ? "Garal" : "Rehabinco"}
                className="h-9 w-auto max-w-[200px] object-contain md:h-11"
              />
              <p className="pt-1 text-right text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">
                {ampliacion ? "Ampliación técnica y económica" : "Propuesta técnica y económica"}
              </p>
            </div>
            <h3 className="text-[28px] font-medium leading-tight tracking-tight">{canvas.concepto || "Sin título"}</h3>
            {p.chips_portada?.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.chips_portada.map((c) => (
                  <ChipVista key={c} etiqueta={c} />
                ))}
              </div>
            ) : null}
            {p.subtitulo_portada ? <p className="mt-2 text-[16px] text-neutral-500">{p.subtitulo_portada}</p> : null}
            {p.descripcion_portada ? (
              <p className="mt-4 text-[15px] leading-relaxed text-neutral-700">{p.descripcion_portada}</p>
            ) : null}
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-[#f7f5f2] px-4 py-3">
                <p className="text-[12px] text-neutral-500">{ampliacion ? "Incremento neto" : "Base"}</p>
                <p className="mt-0.5 text-[20px] font-medium tracking-tight">{euro(base)}</p>
              </div>
              {tot && p.origen_total > 0 && (
                <div className="rounded-2xl bg-[#f7f5f2] px-4 py-3">
                  <p className="text-[12px] text-neutral-500">Resultante</p>
                  <p className="mt-0.5 text-[20px] font-medium tracking-tight">{euro(tot.resultante)}</p>
                </div>
              )}
            </div>
            {p.objeto_alcance ? (
              <div className="mt-8">
                <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-neutral-400">Objeto</p>
                <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-800">{p.objeto_alcance}</p>
              </div>
            ) : null}
            {(p.regimen_destacado || p.regimen_importe || (p.regimen_metricas ?? []).length > 0) && (
              <div className="mt-8 rounded-2xl bg-[#0B1D2E] px-5 py-4 text-white">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#9BB4C4]">
                  {p.regimen_titulo || "Régimen de ejecución extraordinario"}
                </p>
                <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                  <p className="max-w-md text-[15px] font-medium leading-snug">{p.regimen_destacado}</p>
                  {p.regimen_importe ? <p className="text-[22px] font-medium tracking-tight">{p.regimen_importe}</p> : null}
                </div>
                {p.regimen_pie ? (
                  <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[#9BB4C4]">{p.regimen_pie}</p>
                ) : null}
                {(p.regimen_metricas ?? []).length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/15 pt-3 sm:grid-cols-4">
                    {p.regimen_metricas.map((m, i) => (
                      <div key={`${m.valor}-${i}`}>
                        <p className="text-[20px] font-medium tracking-tight">{m.valor}</p>
                        <p className="mt-1 text-[10px] uppercase leading-snug tracking-[0.12em] text-[#9BB4C4]">
                          {m.etiqueta}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {(p.regimenes ?? []).length > 0 && (
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {p.regimenes.map((r, i) => (
                  <div key={`${r.chip}-${i}`} className="rounded-2xl border border-neutral-100 px-4 py-3">
                    {r.chip ? <ChipVista etiqueta={r.chip} /> : null}
                    <p className="mt-2 text-[15px] font-medium">{r.titulo}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-neutral-600">{r.texto}</p>
                  </div>
                ))}
              </div>
            )}
            {(p.factores_valoracion ?? []).length > 0 && (
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {p.factores_valoracion.map((f, i) => (
                  <div key={`${f.titulo}-${i}`} className="border-l-2 border-[#6A9BB0] pl-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6A9BB0]">{f.titulo}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-neutral-700">{f.texto}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-8 space-y-6">
              {[...grupos.entries()].map(([cap, rows]) => (
                <div key={cap}>
                  <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-neutral-400">{cap}</p>
                  <ul className="mt-2 divide-y divide-neutral-100">
                    {rows.map((l, i) => {
                      const chips = (l.etiquetas ?? []).filter(Boolean).length
                        ? (l.etiquetas ?? [])
                        : chipsDePartida(p, l.descripcion);
                      const avisos = [
                        ...(l.aviso?.trim() ? [{ tipo: "aviso" as const, texto: l.aviso.trim() }] : []),
                        ...(l.nota?.trim() ? [{ tipo: "nota" as const, texto: l.nota.trim() }] : []),
                      ];
                      const extra = avisos.length ? avisos : avisosDePartida(p, l.descripcion);
                      return (
                      <li key={`${l.descripcion}-${i}`} className="flex items-start justify-between gap-4 py-2.5 text-[14px]">
                        <span className="min-w-0 text-neutral-800">
                          {l.descripcion}
                          {chips.length > 0 && (
                            <span className="mt-1.5 flex flex-wrap gap-1">
                              {chips.map((c) => (
                                <ChipVista key={c} etiqueta={c} />
                              ))}
                            </span>
                          )}
                          {extra.map((a, idx) =>
                            a.tipo === "aviso" ? (
                              <span
                                key={`av-${idx}`}
                                className="mt-1.5 block rounded-md border-l-[3px] border-red-700 bg-red-50 px-2 py-1 text-[12px] text-red-900"
                              >
                                {a.texto}
                              </span>
                            ) : (
                              <span
                                key={`nt-${idx}`}
                                className="mt-1.5 block rounded-md border-l-[3px] border-[#6A9BB0] bg-[#F5F8FA] px-2 py-1 text-[12px] text-neutral-700"
                              >
                                {a.texto}
                              </span>
                            )
                          )}
                        </span>
                        <span className="shrink-0 tabular-nums text-neutral-500">
                          {l.cantidad} {l.unidad} · {euro(Number(l.cantidad) * Number(l.precioUnitario))}
                        </span>
                      </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
            {ampliacion && (p.bajas?.length ?? 0) > 0 && (
              <div className="mt-8">
                <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-neutral-400">Bajas</p>
                <ul className="mt-2 text-[14px]">
                  {p.bajas.map((b, i) => (
                    <li key={`${b.descripcion}-${i}`} className="flex justify-between gap-3 py-1.5">
                      <span>{b.descripcion}</span>
                      <span className="tabular-nums text-neutral-500">− {euro(b.importe)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {ampliacion && Number(p.ajuste_comercial) !== 0 && (
              <p className="mt-4 text-[14px] text-neutral-600">Ajuste comercial: {euro(Number(p.ajuste_comercial))}</p>
            )}
            {p.condicionantes_ejecucion ? (
              <div className="mt-8">
                <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-neutral-400">Condicionantes</p>
                <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-800">
                  {p.condicionantes_ejecucion}
                </p>
              </div>
            ) : null}
            {canvas.sugerencias.length > 0 && (
              <ul className="mt-8 list-disc space-y-1 pl-4 text-[14px] text-amber-800">
                {canvas.sugerencias.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            )}
            {liveApply && dirty && (
              <p className="mt-10 text-[12px] text-neutral-400">El formulario del wizard se actualiza con este documento.</p>
            )}
          </article>
        )}
      </div>
    </section>
  );
}
