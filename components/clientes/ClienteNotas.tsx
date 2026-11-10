"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { mensajeGuardado } from "@/lib/ui/mensaje-guardado";
import { nombreYApellido } from "@/lib/ui/tokens";

export type TipoNotaCliente = "nota" | "llamada" | "interes" | "otro";

const TIPO_LABEL: Record<TipoNotaCliente, string> = {
  nota: "Nota",
  llamada: "Llamada",
  interes: "Interés",
  otro: "Otro",
};

type NotaFila = {
  id: string;
  texto: string;
  tipo: TipoNotaCliente;
  created_at: string;
  actor?: { nombre_completo: string | null } | { nombre_completo: string | null }[] | null;
};

function actorNombre(actor: NotaFila["actor"]): string {
  if (!actor) return "Equipo";
  const uno = Array.isArray(actor) ? actor[0] : actor;
  return nombreYApellido(uno?.nombre_completo) || "Equipo";
}

function fechaHora(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  return d.toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ClienteNotas({
  clienteId,
  onCambio,
}: {
  clienteId: string;
  onCambio?: () => void;
}) {
  const { user } = useAuth();
  const [notas, setNotas] = useState<NotaFila[]>([]);
  const [loading, setLoading] = useState(true);
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState<TipoNotaCliente>("nota");
  const [saving, setSaving] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editTexto, setEditTexto] = useState("");
  const [editTipo, setEditTipo] = useState<TipoNotaCliente>("nota");

  const cargar = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("clientes_notas")
      .select("id, texto, tipo, created_at, profiles:actor_id(nombre_completo)")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      toast.error(error.message);
      setNotas([]);
    } else {
      setNotas((data ?? []) as NotaFila[]);
    }
    setLoading(false);
  }, [clienteId]);

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
      const { data, error } = await supabase
        .from("clientes_notas")
        .insert({
          cliente_id: clienteId,
          actor_id: user.id,
          texto: body,
          tipo,
        })
        .select("id")
        .single();
      const aviso = mensajeGuardado(error, "No se ha podido guardar la nota.", data);
      if (aviso || !data) {
        toast.error(aviso ?? "No se ha podido guardar la nota.");
        return;
      }
      setTexto("");
      setTipo("nota");
      toast.success("Nota guardada.");
      await cargar();
      onCambio?.();
    } finally {
      setSaving(false);
    }
  };

  const iniciarEdicion = (n: NotaFila) => {
    setEditandoId(n.id);
    setEditTexto(n.texto);
    setEditTipo(n.tipo);
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setEditTexto("");
    setEditTipo("nota");
  };

  const guardarEdicion = async (id: string) => {
    const body = editTexto.trim();
    if (!body || saving) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("clientes_notas")
        .update({ texto: body, tipo: editTipo })
        .eq("id", id);
      if (error) {
        toast.error(error.message);
        return;
      }
      cancelarEdicion();
      toast.success("Nota actualizada.");
      await cargar();
      onCambio?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>Conversaciones</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-neutral-500">Cargando notas…</p>
        ) : notas.length === 0 ? (
          <p className="text-sm text-neutral-500">Aún no hay notas. Escribe lo que hablasteis.</p>
        ) : (
          <ul className="divide-y divide-[var(--border-row)]">
            {notas.map((n) => (
              <li key={n.id} className="py-3">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--accent-dark)]">
                    {TIPO_LABEL[n.tipo] ?? n.tipo}
                  </span>
                  <span className="text-[12.5px] font-medium text-foreground">{actorNombre(n.actor)}</span>
                  <span className="text-[12px] text-[var(--text-3)]">{fechaHora(n.created_at)}</span>
                  {editandoId === n.id ? null : (
                    <button
                      type="button"
                      onClick={() => iniciarEdicion(n)}
                      className="text-[12px] font-semibold text-accent hover:underline"
                    >
                      Editar
                    </button>
                  )}
                </div>
                {editandoId === n.id ? (
                  <div className="mt-2 space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {(["nota", "llamada", "interes", "otro"] as TipoNotaCliente[]).map((t) => (
                        <ToggleChip key={t} on={editTipo === t} onClick={() => setEditTipo(t)}>
                          {TIPO_LABEL[t]}
                        </ToggleChip>
                      ))}
                    </div>
                    <textarea
                      value={editTexto}
                      onChange={(e) => setEditTexto(e.target.value)}
                      rows={3}
                      className="w-full resize-y rounded-[9px] border border-[var(--input)] bg-[var(--field)] px-3 py-2.5 text-[14px] outline-none focus:border-accent"
                    />
                    <div className="flex justify-end gap-2">
                      <Button type="button" size="sm" variant="secondary" disabled={saving} onClick={cancelarEdicion}>
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!editTexto.trim() || saving}
                        onClick={() => void guardarEdicion(n.id)}
                      >
                        {saving ? "Guardando…" : "Guardar"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-snug text-foreground">{n.texto}</p>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="rounded-[11px] border border-[var(--border)] bg-[var(--surface-soft)] p-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {(["nota", "llamada", "interes"] as TipoNotaCliente[]).map((t) => (
              <ToggleChip key={t} on={tipo === t} onClick={() => setTipo(t)}>
                {TIPO_LABEL[t]}
              </ToggleChip>
            ))}
          </div>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            placeholder="Qué hablasteis, interés, siguiente paso…"
            className="w-full resize-none rounded-[9px] border border-[var(--input)] bg-[var(--field)] px-3 py-2.5 text-[14px] outline-none focus:border-accent"
          />
          <div className="mt-2 flex justify-end">
            <Button type="button" size="sm" disabled={!texto.trim() || saving} onClick={() => void guardar()}>
              {saving ? "Guardando…" : "Añadir nota"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
