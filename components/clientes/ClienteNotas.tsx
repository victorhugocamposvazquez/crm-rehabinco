"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { AvatarComercial } from "@/components/ui/avatar-comercial";
import { mensajeGuardado } from "@/lib/ui/mensaje-guardado";
import { nombreYApellido } from "@/lib/ui/tokens";
import { TextoConEnlaces } from "@/components/ui/TextoConEnlaces";
import { cn } from "@/lib/utils";

export type TipoNotaCliente = "nota" | "llamada" | "interes" | "otro";

const TIPO_LABEL: Record<TipoNotaCliente, string> = {
  nota: "Nota",
  llamada: "Llamada",
  interes: "Interés",
  otro: "Otro",
};

type PerfilActor = {
  nombre_completo: string | null;
  email?: string | null;
  color?: string | null;
};

type NotaFila = {
  id: string;
  texto: string;
  tipo: TipoNotaCliente;
  created_at: string;
  actor_id?: string | null;
  profiles?: PerfilActor | PerfilActor[] | null;
  legacy?: boolean;
};

function actorDe(profiles: NotaFila["profiles"]): {
  nombre: string;
  email: string | null;
  color: string | null;
} {
  if (!profiles) return { nombre: "Equipo", email: null, color: null };
  const uno = Array.isArray(profiles) ? profiles[0] : profiles;
  return {
    nombre: nombreYApellido(uno?.nombre_completo, uno?.email) || "Equipo",
    email: uno?.email ?? null,
    color: uno?.color ?? null,
  };
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
  notaLegacy,
  compact = false,
  onCambio,
}: {
  clienteId: string;
  /** Nota legacy en `clientes.notas` por si aún no estuviera en `clientes_notas`. */
  notaLegacy?: string | null;
  /** Modo compacto para paneles laterales (/clientes, FichaPeek). */
  compact?: boolean;
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
    if (!clienteId) return;
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("clientes_notas")
      .select("id, texto, tipo, created_at, actor_id, profiles:actor_id(nombre_completo, email, color)")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      toast.error(error.message);
      setNotas([]);
    } else {
      const filas = (data ?? []) as NotaFila[];
      const legacyLimpio = notaLegacy?.trim() || "";
      if (
        legacyLimpio &&
        !filas.some((f) => f.texto.trim() === legacyLimpio)
      ) {
        filas.push({
          id: "legacy-nota",
          texto: legacyLimpio,
          tipo: "nota",
          created_at: "",
          legacy: true,
        });
      }
      setNotas(filas);
    }
    setLoading(false);
  }, [clienteId, notaLegacy]);

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

  const guardarEdicion = async (n: NotaFila) => {
    const body = editTexto.trim();
    if (!body || saving) return;
    setSaving(true);
    try {
      const supabase = createClient();
      if (n.legacy) {
        const { error } = await supabase.from("clientes_notas").insert({
          cliente_id: clienteId,
          actor_id: user?.id ?? null,
          texto: body,
          tipo: editTipo,
        });
        if (error) {
          toast.error(error.message);
          return;
        }
      } else {
        const { error } = await supabase
          .from("clientes_notas")
          .update({ texto: body, tipo: editTipo })
          .eq("id", n.id);
        if (error) {
          toast.error(error.message);
          return;
        }
      }
      cancelarEdicion();
      toast.success("Nota actualizada.");
      await cargar();
      onCambio?.();
    } finally {
      setSaving(false);
    }
  };

  const cuerpo = (
    <div className="space-y-3">
      {loading ? (
        <p className="text-[12.5px] text-[var(--text-3)]">Cargando notas…</p>
      ) : notas.length === 0 ? (
        <p className="text-[12.5px] text-[var(--text-3)]">
          Aún no hay notas. Escribe lo que hablasteis y quedará visible para todo el equipo.
        </p>
      ) : (
        <ul className="space-y-2">
          {notas.map((n) => {
            const autor = actorDe(n.profiles);
            return (
              <li
                key={n.id}
                id={`nota-${n.id}`}
                className="rounded-[10px] border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <AvatarComercial
                    nombre={autor.nombre}
                    email={autor.email}
                    color={autor.color}
                    size={18}
                    title={autor.nombre}
                  />
                  <span className="text-[12.5px] font-semibold text-foreground">{autor.nombre}</span>
                  <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[var(--accent-dark)]">
                    {TIPO_LABEL[n.tipo] ?? n.tipo}
                  </span>
                  {n.created_at ? (
                    <span className="text-[11.5px] tabular-nums text-[var(--text-3)]">
                      {fechaHora(n.created_at)}
                    </span>
                  ) : (
                    <span className="text-[11.5px] text-[var(--text-3)]">Nota inicial</span>
                  )}
                  {editandoId === n.id ? null : (
                    <button
                      type="button"
                      onClick={() => iniciarEdicion(n)}
                      className="ml-auto text-[11.5px] font-semibold text-accent hover:underline"
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
                      className="w-full resize-y rounded-[9px] border border-[var(--input)] bg-[var(--field)] px-3 py-2 text-[13.5px] outline-none focus:border-accent"
                    />
                    <div className="flex justify-end gap-2">
                      <Button type="button" size="sm" variant="secondary" disabled={saving} onClick={cancelarEdicion}>
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!editTexto.trim() || saving}
                        onClick={() => void guardarEdicion(n)}
                      >
                        {saving ? "Guardando…" : "Guardar"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1.5 whitespace-pre-wrap break-words text-[13.5px] leading-snug text-foreground">
                    <TextoConEnlaces texto={n.texto} />
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className={cn("rounded-[11px] border border-[var(--border)] bg-[var(--surface-soft)]", compact ? "p-2.5" : "p-3")}>
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
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void guardar();
            }
          }}
          rows={compact ? 2 : 3}
          placeholder="Qué hablasteis, interés, siguiente paso…"
          className="w-full resize-y rounded-[9px] border border-[var(--input)] bg-[var(--field)] px-3 py-2 text-[13.5px] outline-none focus:border-accent"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] text-[var(--text-3)]">Visible para todo el equipo</span>
          <Button type="button" size="sm" disabled={!texto.trim() || saving} onClick={() => void guardar()}>
            {saving ? "Guardando…" : "Añadir nota"}
          </Button>
        </div>
      </div>
    </div>
  );

  if (compact) {
    return (
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[12px] font-medium text-[var(--text-3)]">Notas e historial de llamadas</span>
          <span className="text-[11.5px] tabular-nums text-[var(--text-2)]">{notas.length}</span>
        </div>
        {cuerpo}
      </div>
    );
  }

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>Conversaciones y notas del equipo</CardTitle>
      </CardHeader>
      <CardContent>{cuerpo}</CardContent>
    </Card>
  );
}
