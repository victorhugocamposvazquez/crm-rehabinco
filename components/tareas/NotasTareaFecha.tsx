"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { mensajeGuardado } from "@/lib/ui/mensaje-guardado";
import { nombreYApellido } from "@/lib/ui/tokens";

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
}: {
  tareaId: string;
  /** Texto antiguo de citas.notas, sin fecha propia. */
  notaLegacy?: string | null;
}) {
  const { user } = useAuth();
  const [notas, setNotas] = useState<Nota[]>([]);
  const [texto, setTexto] = useState("");
  const [saving, setSaving] = useState(false);
  const legacy = notaLegacy?.trim() || "";

  const cargar = useCallback(async () => {
    const { data, error } = await createClient()
      .from("tareas_actividad")
      .select("id, texto, created_at, profiles:actor_id(nombre_completo)")
      .eq("tarea_id", tareaId)
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
  }, [tareaId, legacy]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const guardar = async () => {
    const body = texto.trim();
    if (!body || saving) return;
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
          tarea_id: tareaId,
          actor_id: null,
          tipo: "nota",
          texto: legacy,
        });
      }
      const { data, error } = await supabase
        .from("tareas_actividad")
        .insert({
          tarea_id: tareaId,
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

  return (
    <div className="space-y-3">
      {notas.length === 0 ? (
        <p className="text-[13px] text-[var(--text-3)]">Aún no hay notas. Cada una guarda su día y hora.</p>
      ) : (
        <ul className="divide-y divide-[var(--border-row)]">
          {notas.map((n) => (
            <li key={n.id} className="py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-3)]">
                {fechaNota(n.created_at)}
                {n.autor ? ` · ${n.autor}` : ""}
                {n.legacy ? " · nota anterior" : ""}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-snug text-foreground">{n.texto}</p>
            </li>
          ))}
        </ul>
      )}
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={3}
        placeholder="Nueva nota. Se guarda con la fecha de ahora."
        className="min-h-[5rem] w-full resize-y rounded-[9px] border border-[var(--input)] bg-white px-3 py-2.5 text-[13.5px] outline-none focus:border-accent max-[819px]:text-base"
      />
      <div className="flex justify-end">
        <Button type="button" size="sm" disabled={!texto.trim() || saving} onClick={() => void guardar()}>
          {saving ? "Guardando…" : "Añadir nota"}
        </Button>
      </div>
    </div>
  );
}
