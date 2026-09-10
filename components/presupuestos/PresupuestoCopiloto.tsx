"use client";

import { useRef, useState } from "react";
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
import { diffPresupuesto, euro, type DiffPresupuesto } from "@/lib/ai/presupuesto-diff";
import { Paperclip, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";

type Msg = HistorialCopiloto & { files?: string[] };

export function PresupuestoCopiloto({
  estado,
  onAccept,
}: {
  estado: EstadoCopiloto;
  onAccept: (output: CopilotoOutput) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [pending, setPending] = useState<CopilotoOutput | null>(null);
  const [diff, setDiff] = useState<DiffPresupuesto | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const next = [...files];
    for (const file of Array.from(list)) {
      if (next.length >= COPILOTO_MAX_FILES) {
        toast.error(`Máximo ${COPILOTO_MAX_FILES} archivos.`);
        break;
      }
      next.push(file);
    }
    const bytes = next.reduce((acc, f) => acc + f.size, 0);
    if (bytes > COPILOTO_MAX_BYTES) {
      toast.error("Los adjuntos superan 3,5 MB. Comprime el PDF.");
      return;
    }
    setFiles(next);
    if (inputRef.current) inputRef.current.value = "";
  };

  const send = async () => {
    const instrucciones = text.trim();
    if (!instrucciones || busy || pending) return;
    setBusy(true);
    const form = new FormData();
    form.append(
      "payload",
      JSON.stringify({
        instrucciones,
        historial: messages.map(({ role, text: t }) => ({ role, text: t })),
        estado,
      })
    );
    for (const file of files) form.append("files", file);
    try {
      const res = await fetch("/api/presupuestos/copiloto", { method: "POST", body: form });
      const data = (await res.json()) as { output?: CopilotoOutput; error?: string };
      if (!res.ok || !data.output) {
        toast.error(data.error || "No se pudo generar la propuesta.");
        return;
      }
      const output = data.output;
      setMessages((m) => [
        ...m,
        { role: "user", text: instrucciones, files: files.map((f) => f.name) },
        { role: "assistant", text: output.resumen },
      ]);
      setPending(output);
      setDiff(
        diffPresupuesto({
          conceptoActual: estado.concepto,
          descuentoActual: estado.porcentaje_descuento,
          lineasActuales: estado.lineas,
          propuesta: output,
        })
      );
      setText("");
      setFiles([]);
    } catch {
      toast.error("No se pudo contactar con el copiloto.");
    } finally {
      setBusy(false);
    }
  };

  const accept = () => {
    if (!pending) return;
    onAccept(pending);
    setPending(null);
    setDiff(null);
    toast.success("Propuesta aplicada. Revisa partidas y precios antes de guardar.");
  };

  return (
    <>
      <Button type="button" variant="secondary" size="sm" className="shrink-0 gap-1.5" onClick={() => setOpen(true)}>
        <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
        Copiloto
      </Button>
      <Sheet open={open} onOpenChange={setOpen} fullScreenOnMobile showCloseButton className="md:w-[min(720px,92vw)]">
        <div className="flex h-full min-h-0 flex-col">
          <div className="border-b border-border px-5 pb-3">
            <h2 className="text-lg font-semibold">Copiloto de presupuesto</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Pide correcciones o una ampliación. Adjunta PDF o .txt. Tú aceptas; el PDF sale de la plantilla del CRM.
            </p>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
            {messages.length === 0 && !pending && (
              <p className="text-sm text-neutral-500">
                Ejemplos: «deja el incremento en 45.000», «quita la base aislante», «turnos diurnos y nocturnos»,
                «ampliación sobre ESC-2026-09 de 228.000», «oculta observaciones y repercusión».
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className={
                  m.role === "user"
                    ? "ml-8 rounded-xl bg-neutral-900 px-3 py-2 text-sm text-white"
                    : "mr-8 rounded-xl border border-border bg-neutral-50 px-3 py-2 text-sm text-neutral-800"
                }
              >
                <p className="whitespace-pre-wrap">{m.text}</p>
                {m.files && m.files.length > 0 && (
                  <p className="mt-1 text-xs opacity-70">{m.files.join(" · ")}</p>
                )}
              </div>
            ))}
            {busy && <p className="text-sm text-neutral-500">Leyendo y proponiendo…</p>}
            {pending && diff && (
              <PropuestaPendiente
                output={pending}
                diff={diff}
                onAccept={accept}
                onDiscard={() => {
                  setPending(null);
                  setDiff(null);
                }}
              />
            )}
          </div>
          <div className="border-t border-border px-5 py-3">
            {files.length > 0 && (
              <ul className="mb-2 flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="inline-flex max-w-full items-center gap-1 rounded-md bg-neutral-100 px-2 py-1 text-xs text-neutral-700"
                  >
                    <span className="truncate">{f.name}</span>
                    <button
                      type="button"
                      aria-label={`Quitar ${f.name}`}
                      onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {pending && (
              <p className="mb-2 text-xs text-amber-700">Acepta o descarta la propuesta antes de pedir otra.</p>
            )}
            <div className="flex items-end gap-2">
              <button
                type="button"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-neutral-600 hover:bg-neutral-50"
                aria-label="Adjuntar PDF o texto"
                disabled={busy || !!pending}
                onClick={() => inputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4" strokeWidth={1.5} />
              </button>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept="application/pdf,.pdf,.txt,.md,.csv,text/plain,text/markdown,text/csv"
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
              <textarea
                className="min-h-[44px] flex-1 resize-none rounded-lg border border-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                rows={2}
                placeholder="Qué hay que hacer con este presupuesto…"
                value={text}
                disabled={busy || !!pending}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <Button type="button" size="sm" disabled={busy || !!pending || !text.trim()} onClick={() => void send()}>
                {busy ? "…" : "Enviar"}
              </Button>
            </div>
          </div>
        </div>
      </Sheet>
    </>
  );
}

function PropuestaPendiente({
  output,
  diff,
  onAccept,
  onDiscard,
}: {
  output: CopilotoOutput;
  diff: DiffPresupuesto;
  onAccept: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="rounded-xl border border-neutral-900 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Propuesta · no aplicada</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <div>
          <dt className="text-neutral-500">Partidas</dt>
          <dd>
            {diff.partidasAntes} → {diff.partidasDespues}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Base</dt>
          <dd>
            {euro(diff.baseAntes)} → {euro(diff.baseDespues)}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Altas / bajas</dt>
          <dd>
            +{diff.partidasNuevas} / −{diff.partidasQuitadas}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Baja ofertada</dt>
          <dd>
            {diff.descuentoAntes} % → {diff.descuentoDespues} %
          </dd>
        </div>
      </dl>
      {diff.conceptoCambia && output.concepto && (
        <p className="mt-2 text-sm">
          <span className="text-neutral-500">Título:</span> {output.concepto}
        </p>
      )}
      {output.sugerencias.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-4 text-sm text-amber-800">
          {output.sugerencias.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      )}
      <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-xs text-neutral-600">
        {output.lineas.slice(0, 8).map((l: LineaCopiloto, i) => (
          <li key={`${l.descripcion}-${i}`} className="truncate">
            {l.capitulo ? `${l.capitulo} · ` : ""}
            {l.descripcion}
          </li>
        ))}
        {output.lineas.length > 8 && <li>… y {output.lineas.length - 8} más</li>}
      </ul>
      <div className="mt-4 flex gap-2">
        <Button type="button" onClick={onAccept}>
          Aceptar y volcar al formulario
        </Button>
        <Button type="button" variant="secondary" className="gap-1" onClick={onDiscard}>
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
          Descartar
        </Button>
      </div>
    </div>
  );
}
