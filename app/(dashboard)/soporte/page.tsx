"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, ImagePlus, Plus, RotateCcw, Send } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth/auth-context";
import { isSuperAdmin } from "@/lib/auth/roles";
import {
  accionUsuarioTicket,
  enviarMensajeTicket,
  listarTicketsSoporte,
  obtenerTicketDetalle,
  subirAdjuntoSoporte,
} from "@/lib/support/client";
import {
  SUPPORT_ESTADO_USUARIO_LABEL,
  requiereConfirmacionUsuario,
  type SupportAttachmentRef,
  type SupportTicket,
  type SupportTicketMessage,
} from "@/lib/support/types";
import { SupportDrawer } from "@/components/support/SupportDrawer";
import { cn } from "@/lib/utils";

const AUTOR_LABEL: Record<string, string> = {
  usuario: "Tú",
  ia: "Asistente de soporte",
  agente_codigo: "Equipo técnico",
  agente_cursor: "Equipo técnico",
  superadmin: "Soporte técnico",
  sistema: "Sistema",
};

function SoporteContenido() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("ticket");

  const [activo, setActivo] = useState(true);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [cargando, setCargando] = useState(true);
  const [detalle, setDetalle] = useState<SupportTicket | null>(null);
  const [mensajes, setMensajes] = useState<SupportTicketMessage[]>([]);
  const [cargandoHilo, setCargandoHilo] = useState(false);

  const [respuesta, setRespuesta] = useState("");
  const [adjuntos, setAdjuntos] = useState<SupportAttachmentRef[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [mostrarMotivoReabrir, setMostrarMotivoReabrir] = useState(false);
  const [motivoReabrir, setMotivoReabrir] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const cargarLista = useCallback(async () => {
    setCargando(true);
    try {
      const res = await listarTicketsSoporte("mios");
      setActivo(res.activo);
      setMotivo(res.motivo);
      setTickets(res.tickets);
      if (!selectedId && res.tickets[0]) {
        router.replace(`/soporte?ticket=${encodeURIComponent(res.tickets[0].id)}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar tus tickets.");
    } finally {
      setCargando(false);
    }
  }, [selectedId, router]);

  const cargarDetalle = useCallback(async (id: string) => {
    setCargandoHilo(true);
    try {
      const res = await obtenerTicketDetalle(id);
      setDetalle(res.ticket);
      setMensajes(res.messages.filter((m) => !m.interno));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo abrir el ticket.");
    } finally {
      setCargandoHilo(false);
    }
  }, []);

  useEffect(() => {
    void cargarLista();
  }, [cargarLista]);

  useEffect(() => {
    if (selectedId) {
      void cargarDetalle(selectedId);
      setMostrarMotivoReabrir(false);
      setMotivoReabrir("");
    } else {
      setDetalle(null);
      setMensajes([]);
    }
  }, [selectedId, cargarDetalle]);

  const enviarMensaje = async () => {
    if (!detalle) return;
    if (!respuesta.trim() && adjuntos.length === 0) return;
    setEnviando(true);
    try {
      const res = await enviarMensajeTicket(detalle.id, {
        cuerpo: respuesta.trim(),
        adjuntos,
      });
      setRespuesta("");
      setAdjuntos([]);
      setDetalle(res.ticket);
      setMensajes((prev) => [...prev, res.message]);
      void cargarLista();
      toast.success("Mensaje enviado a soporte.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al enviar mensaje.");
    } finally {
      setEnviando(false);
    }
  };

  const confirmarSolucionado = async () => {
    if (!detalle) return;
    setEnviando(true);
    try {
      const res = await accionUsuarioTicket(detalle.id, {
        accion: "confirmar_resuelto",
      });
      setDetalle(res.ticket);
      await cargarDetalle(detalle.id);
      await cargarLista();
      toast.success("Marcado como solucionado. ¡Gracias por confirmarlo!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo confirmar.");
    } finally {
      setEnviando(false);
    }
  };

  const reabrirTicket = async () => {
    if (!detalle) return;
    if (motivoReabrir.trim().length < 4) {
      toast.error("Indícanos brevemente qué sigue fallando para revisarlo.");
      return;
    }
    setEnviando(true);
    try {
      const res = await accionUsuarioTicket(detalle.id, {
        accion: "reabrir",
        comentario: motivoReabrir.trim(),
      });
      setDetalle(res.ticket);
      setMostrarMotivoReabrir(false);
      setMotivoReabrir("");
      await cargarDetalle(detalle.id);
      await cargarLista();
      toast.success("Ticket reabierto. Hemos avisado de inmediato al equipo técnico.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo reabrir el ticket.");
    } finally {
      setEnviando(false);
    }
  };

  const subirImagenHilo = async (file: File | null) => {
    if (!file) return;
    try {
      const subido = await subirAdjuntoSoporte(file, file.name);
      setAdjuntos((prev) => [...prev, subido].slice(0, 4));
      toast.success("Imagen lista para enviar.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir la imagen.");
    }
  };

  if (!cargando && !activo && !isSuperAdmin(user?.role)) {
    return (
      <div>
        <PageHeader
          breadcrumb={[{ label: "Soporte", href: "/soporte" }]}
          title="Soporte técnico"
          description="Seguimiento de consultas e incidencias."
        />
        <Card className="mt-6">
          <CardContent className="p-6">
            <h2 className="text-base font-semibold">Plan de soporte no activo</h2>
            <p className="mt-1.5 text-sm text-[var(--text-2)]">
              {motivo ||
                "Esta empresa no cuenta con un plan de soporte activo actualmente. Si necesitas activarlo, contacta con administración."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Soporte", href: "/soporte" }]}
        title="Mis consultas de soporte"
        description="Revisa el estado de tus tickets, escribe al equipo y confirma cuándo una solución funciona de verdad."
        actions={
          <Button type="button" onClick={() => setDrawerOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Nueva consulta
          </Button>
        }
      />

      <div className="mt-6 grid gap-4 min-[920px]:grid-cols-[320px_1fr]">
        {/* Columna izquierda: listado de mis tickets */}
        <div className="space-y-2">
          {cargando ? (
            <p className="py-6 text-sm text-[var(--text-2)]">Cargando…</p>
          ) : tickets.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-[var(--text-2)]">
                No tienes tickets abiertos todavía. Pulsa «Nueva consulta» cuando necesites ayuda.
              </CardContent>
            </Card>
          ) : (
            tickets.map((t) => {
              const sel = t.id === selectedId;
              const pideConfirmar = requiereConfirmacionUsuario(t.estado);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => router.push(`/soporte?ticket=${encodeURIComponent(t.id)}`)}
                  className={cn(
                    "w-full rounded-[12px] border p-3.5 text-left transition-colors",
                    sel
                      ? "border-foreground bg-[var(--surface)] shadow-sm"
                      : "border-border bg-[var(--surface)] hover:bg-[var(--surface-soft)]",
                    pideConfirmar && !sel && "border-amber-400"
                  )}
                >
                  <div className="flex items-center justify-between gap-2 text-[11.5px]">
                    <span className="font-mono font-semibold text-[var(--text-2)]">{t.codigo}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 font-medium",
                        pideConfirmar
                          ? "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200"
                          : t.estado === "resuelto"
                            ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200"
                            : "bg-[var(--surface-soft)] text-[var(--text-2)]"
                      )}
                    >
                      {SUPPORT_ESTADO_USUARIO_LABEL[t.estado]}
                    </span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[13.5px] font-semibold text-foreground">{t.titulo}</p>
                  <p className="mt-1 text-[11.5px] text-[var(--text-3)]">
                    {new Date(t.updated_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}
                  </p>
                </button>
              );
            })
          )}
        </div>

        {/* Columna derecha: conversación y confirmación */}
        <div>
          {!detalle ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-[var(--text-2)]">
                {cargandoHilo ? "Abriendo ticket…" : "Selecciona una consulta de la izquierda para ver sus detalles."}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-[var(--text-2)]">{detalle.codigo}</span>
                      <span className="rounded-full bg-[var(--surface-soft)] px-2.5 py-0.5 text-xs font-medium text-foreground">
                        {SUPPORT_ESTADO_USUARIO_LABEL[detalle.estado]}
                      </span>
                    </div>
                    <h2 className="mt-1 text-[17px] font-semibold text-foreground">{detalle.titulo}</h2>
                    <p className="mt-0.5 text-xs text-[var(--text-3)]">
                      Abierto el {new Date(detalle.created_at).toLocaleString("es-ES")} · Zona: {detalle.modulo || "general"}
                    </p>
                  </div>

                  {detalle.estado !== "resuelto" && detalle.estado !== "cerrado" ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={enviando}
                      onClick={() => void confirmarSolucionado()}
                      className="gap-1.5"
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Marcar como solucionado
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={enviando}
                      onClick={() => setMostrarMotivoReabrir(true)}
                      className="gap-1.5"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Reabrir ticket
                    </Button>
                  )}
                </div>

                {/* Banner destacado cuando nunca damos por hecho que esté resuelto sin su OK */}
                {requiereConfirmacionUsuario(detalle.estado) ? (
                  <div className="mt-4 rounded-[12px] border border-amber-300 bg-amber-50/70 p-4 dark:border-amber-800 dark:bg-amber-950/30">
                    <p className="text-sm font-semibold text-foreground">
                      ¿Ya ha quedado solucionado?
                    </p>
                    <p className="mt-1 text-[13px] text-[var(--text-2)]">
                      {detalle.solucion_resumen ||
                        "Hemos respondido o aplicado una corrección. No cerramos el ticket automáticamente hasta que confirmes que te funciona bien."}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={enviando}
                        onClick={() => void confirmarSolucionado()}
                        className="gap-1.5"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Sí, está solucionado
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={enviando}
                        onClick={() => setMostrarMotivoReabrir(true)}
                        className="gap-1.5"
                      >
                        <RotateCcw className="h-4 w-4" />
                        No, sigue ocurriendo
                      </Button>
                    </div>
                  </div>
                ) : null}

                {mostrarMotivoReabrir ? (
                  <div className="mt-4 rounded-[12px] border border-border bg-[var(--surface-soft)] p-3.5">
                    <p className="text-xs font-semibold text-foreground">
                      Cuéntanos qué sigue fallando para priorizarlo:
                    </p>
                    <textarea
                      rows={3}
                      value={motivoReabrir}
                      onChange={(e) => setMotivoReabrir(e.target.value)}
                      placeholder="Ej: He recargado la página pero sigue saliendo el mismo aviso..."
                      className="mt-2 w-full rounded-[9px] border border-border bg-[var(--surface)] px-3 py-2 text-sm"
                    />
                    <div className="mt-2 flex gap-2">
                      <Button type="button" size="sm" disabled={enviando} onClick={() => void reabrirTicket()}>
                        Confirmar reapertura
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setMostrarMotivoReabrir(false)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : null}

                {/* Hilo de mensajes */}
                <div className="mt-5 space-y-3">
                  {mensajes.map((m) => {
                    const esMio = m.autor_tipo === "usuario";
                    return (
                      <div
                        key={m.id}
                        className={cn(
                          "rounded-[12px] border p-3.5 text-sm",
                          esMio
                            ? "ml-0 border-border bg-[var(--surface)] min-[640px]:ml-8"
                            : "mr-0 border-border bg-[var(--surface-soft)] min-[640px]:mr-8"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2 text-[11.5px] text-[var(--text-3)]">
                          <span className="font-semibold text-foreground">
                            {AUTOR_LABEL[m.autor_tipo] || m.autor_tipo}
                          </span>
                          <span>
                            {new Date(m.created_at).toLocaleString("es-ES", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </span>
                        </div>
                        <p className="mt-1.5 whitespace-pre-wrap leading-relaxed text-foreground">{m.cuerpo}</p>
                        {Array.isArray(m.adjuntos) && m.adjuntos.length > 0 ? (
                          <div className="mt-2.5 flex flex-wrap gap-2">
                            {m.adjuntos.map((a) =>
                              a.signedUrl ? (
                                <a
                                  key={a.path}
                                  href={a.signedUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block overflow-hidden rounded-[8px] border border-border"
                                >
                                  <img src={a.signedUrl} alt={a.nombre} className="h-28 max-w-[200px] object-cover" />
                                </a>
                              ) : null
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {/* Caja para escribir en cualquier momento */}
                <div className="mt-5 border-t border-border pt-4">
                  <textarea
                    rows={3}
                    value={respuesta}
                    onChange={(e) => setRespuesta(e.target.value)}
                    placeholder="Escribe un comentario o añade más detalles…"
                    className="w-full rounded-[10px] border border-border bg-[var(--surface)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {adjuntos.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {adjuntos.map((a) => (
                        <span
                          key={a.path}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-[var(--surface-soft)] px-2.5 py-1 text-xs"
                        >
                          {a.nombre}
                          <button
                            type="button"
                            onClick={() => setAdjuntos((prev) => prev.filter((x) => x.path !== a.path))}
                            className="font-bold text-[var(--text-2)] hover:text-foreground"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                    <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[9px] border border-border bg-[var(--surface)] px-3 text-[13px] font-medium hover:bg-[var(--surface-soft)]">
                      <ImagePlus className="h-4 w-4" />
                      Adjuntar captura
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null;
                          e.target.value = "";
                          void subirImagenHilo(f);
                        }}
                      />
                    </label>
                    <Button
                      type="button"
                      disabled={enviando || (!respuesta.trim() && adjuntos.length === 0)}
                      onClick={() => void enviarMensaje()}
                      className="gap-1.5"
                    >
                      <Send className="h-4 w-4" />
                      {enviando ? "Enviando…" : "Enviar mensaje"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <SupportDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        activo={activo}
        motivoInactivo={motivo}
        onCreated={() => void cargarLista()}
      />
    </div>
  );
}

export default function SoporteUsuarioPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-[var(--text-2)]">Cargando soporte…</p>}>
      <SoporteContenido />
    </Suspense>
  );
}
