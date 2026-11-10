"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { mensajeGuardado } from "@/lib/ui/mensaje-guardado";
import { nombreYApellido } from "@/lib/ui/tokens";
import { syncTareaDesdeCita, type CitaParaTarea } from "@/lib/tareas/sync-cita";

type Nota = {
  id: string;
  texto: string;
  created_at: string | null;
  autor: string | null;
  legacy?: boolean;
};

function fechaNota(iso: string | null) {
  if (!iso) return "Sin fecha";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Sin fecha";
  return d.toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotasTareaFecha({
  tareaId,
  notaLegacy,
  cita,
  onTareaId,
}: {
  tareaId?: string | null;
  /** Texto antiguo de citas.notas, sin fecha propia. */
  notaLegacy?: string | null;
  /** Si la entrada aún no tiene tarea, se crea al abrir las notas. */
  cita?: CitaParaTarea | null;
  onTareaId?: (tareaId: string) => void;
}) {
  const { user } = useAuth();
  const [tareaResuelta, setTareaResuelta] = useState<string | null>(tareaId ?? null);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [texto, setTexto] = useState("");
  const [saving, setSaving] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const legacy = notaLegacy?.trim() || "";
  const citaRef = useRef(cita);
  citaRef.current = cita;
  const onTareaIdRef = useRef(onTareaId);
  onTareaIdRef.current = onTareaId;

  useEffect(() => {
    setTareaResuelta(tareaId ?? null);
  }, [tareaId]);

  useEffect(() => {
    if (tareaId || !cita?.id) return;
    let vivo = true;
    void (async () => {
      const actual = citaRef.current;
      if (!actual) return;
      try {
        const id = await syncTareaDesdeCita(
          createClient(),
          { ...actual, tarea_id: null },
          { creadoPor: user?.id ?? actual.comercial_id }
        );
        if (!vivo || !id) return;
        setTareaResuelta(id);
        onTareaIdRef.current?.(id);
      } catch (err) {
        if (vivo) toast.error(err instanceof Error ? err.message : "No se han podido preparar las notas.");
      }
    })();
    return () => {
      vivo = false;
    };
  }, [cita?.id, tareaId, user?.id]);

  const cargar = useCallback(async () => {
    if (!tareaResuelta) return;
    const { data, error } = await createClient()
      .from("tareas_actividad")
      .select("id, texto, created_at, profiles:actor_id(nombre_completo)")
      .eq("tarea_id", tareaResuelta)
      .eq("tipo", "nota")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      return;
    }
    const filas = (data ?? []) as Array<{
      id: string;
      texto: string;
      created_at: string;
      profiles?: { nombre_completo: string | null } | { nombre_completo: string | null }[] | null;
    }>;
    const mapped: Nota[] = filas.map((row) => {
      const perfil = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return {
        id: row.id,
        texto: row.texto,
        created_at: row.created_at,
        autor: nombreYApellido(perfil?.nombre_completo) || null,
      };
    });
    const yaEsta = legacy && mapped.some((n) => n.texto.trim() === legacy);
    if (legacy && !yaEsta) {
      mapped.push({ id: "legacy", texto: legacy, created_at: null, autor: null, legacy: true });
    }
    setNotas(mapped);
  }, [tareaResuelta, legacy]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const guardar = async () => {
    const body = texto.trim();
    if (!body || saving || !tareaResuelta) return;
    if (!user?.id) {
      toast.error("Sesión no válida.");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const yaCopiada = notas.some((n) => !n.legacy && n.texto.trim() === legacy);
      if (legacy && !yaCopiada) {
        await supabase.from("tareas_actividad").insert({
          tarea_id: tareaResuelta,
          actor_id: null,
          tipo: "nota",
          texto: legacy,
        });
      }
      const { data, error } = await supabase
        .from("tareas_actividad")
        .insert({
          tarea_id: tareaResuelta,
          actor_id: user.id,
          tipo: "nota",
          texto: body,
        })
        .select("id")
        .single();
      const aviso = mensajeGuardado(error, "No se ha podido guardar la nota.", data);
      if (aviso || !data) {
        toast.error(aviso ?? "No se ha podido guardar la nota.");
        return;
      }
      setTexto("");
      toast.success("Nota guardada.");
      await cargar();
    } finally {
      setSaving(false);
    }
  };

  const iniciarEdicion = (n: Nota) => {
    setEditandoId(n.id);
    setEditDraft(n.texto);
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setEditDraft("");
  };

  const guardarEdicion = async (n: Nota) => {
    const body = editDraft.trim();
    if (!body || saving || !tareaResuelta) return;
    if (!user?.id) {
      toast.error("Sesión no válida.");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      if (n.legacy) {
        const copiada = notas.find((row) => !row.legacy && row.texto.trim() === legacy);
        if (copiada) {
          const { error } = await supabase.from("tareas_actividad").update({ texto: body }).eq("id", copiada.id);
          if (error) {
            toast.error(error.message);
            return;
          }
        } else {
          const { error } = await supabase.from("tareas_actividad").insert({
            tarea_id: tareaResuelta,
            actor_id: user.id,
            tipo: "nota",
            texto: body,
          });
          if (error) {
            toast.error(error.message);
            return;
          }
        }
        if (cita?.id) {
          await supabase.from("citas").update({ notas: body }).eq("id", cita.id);
        }
      } else {
        const { error } = await supabase
          .from("tareas_actividad")
          .update({ texto: body })
          .eq("id", n.id)
          .eq("tipo", "nota");
        if (error) {
          toast.error(error.message);
          return;
        }
      }
      cancelarEdicion();
      toast.success("Nota actualizada.");
      await cargar();
    } finally {
      setSaving(false);
    }
  };

  const visibles =
    notas.length > 0
      ? notas
      : legacy
        ? [{ id: "legacy", texto: legacy, created_at: null, autor: null, legacy: true as const }]
        : [];

  return (
    <div className="space-y-3">
      <div className="rounded-[10px] border border-[var(--input)] bg-[var(--field)] p-3 focus-within:border-foreground">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              void guardar();
            }
          }}
          rows={2}
          placeholder="Añadir una nota… Se guarda con la fecha y hora de ahora."
          className="min-h-[3.5rem] w-full resize-y bg-transparent text-[14px] leading-relaxed text-foreground outline-none placeholder:text-[var(--text-3)] max-[819px]:text-base"
        />
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-[var(--border-soft)] pt-2">
          <span className="text-[11.5px] text-[var(--text-3)]">⌘ + Intro para añadir</span>
          <Button
            type="button"
            size="sm"
            disabled={!texto.trim() || saving || !tareaResuelta}
            onClick={() => void guardar()}
          >
            {saving ? "Guardando…" : "Añadir nota"}
          </Button>
        </div>
      </div>
      {visibles.length === 0 ? null : (
        <ul className="space-y-2">
          {visibles.map((n) => (
            <li
              key={n.id}
              className="rounded-[10px] border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3.5 py-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-medium text-[var(--text-3)]">
                  {n.legacy ? "Nota anterior" : fechaNota(n.created_at)}
                  {n.autor ? ` · ${n.autor}` : ""}
                </p>
                {editandoId === n.id ? null : (
                  <button
                    type="button"
                    onClick={() => iniciarEdicion(n)}
                    className="shrink-0 text-[12px] font-semibold text-accent hover:underline"
                  >
                    Editar
                  </button>
                )}
              </div>
              {editandoId === n.id ? (
                <div className="mt-2 space-y-2">
                  <textarea
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    rows={3}
                    className="min-h-[4rem] w-full resize-y rounded-[9px] border border-[var(--input)] bg-[var(--field)] px-3 py-2 text-[13.5px] text-foreground outline-none focus:border-accent"
                  />
                  <div className="flex justify-end gap-2">
                    <Button type="button" size="sm" variant="secondary" disabled={saving} onClick={cancelarEdicion}>
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={!editDraft.trim() || saving}
                      onClick={() => void guardarEdicion(n)}
                    >
                      {saving ? "Guardando…" : "Guardar"}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-1 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-foreground">
                  {n.texto}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
