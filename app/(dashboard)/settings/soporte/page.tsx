"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  Building2,
  CheckCircle2,
  ExternalLink,
  GitPullRequest,
  Play,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { SettingsAdminNav } from "@/components/settings/SettingsAdminNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Selector } from "@/components/ui/selector";
import { useAuth } from "@/lib/auth/auth-context";
import { isSuperAdmin } from "@/lib/auth/roles";
import {
  accionSuperadminTicket,
  enviarMensajeTicket,
  fetchSupportAdminHealth,
  guardarSupportSettings,
  listarTicketsSoporte,
  obtenerTicketDetalle,
  type SupportAdminHealthResponse,
} from "@/lib/support/client";
import {
  SUPPORT_ESTADO_ADMIN_LABEL,
  SUPPORT_SOLVER_LABELS,
  empresaTieneSoporteActivo,
  type SupportAdhesionEstado,
  type SupportEstado,
  type SupportSettingsRow,
  type SupportSolverProviderId,
  type SupportTicket,
  type SupportTicketMessage,
} from "@/lib/support/types";
import { cn } from "@/lib/utils";

const DOT_SALUD: Record<"ok" | "aviso" | "error", string> = {
  ok: "bg-emerald-500",
  aviso: "bg-amber-500",
  error: "bg-red-500",
};

function ConsolaSoporteSuperadmin() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const ticketUrlId = searchParams.get("ticket");

  const [pestana, setPestana] = useState<"bandeja" | "empresas" | "salud">("bandeja");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [cargandoTickets, setCargandoTickets] = useState(true);
  const [seleccionado, setSeleccionado] = useState<SupportTicket | null>(null);
  const [mensajes, setMensajes] = useState<SupportTicketMessage[]>([]);

  // Controles a demanda por ticket individual
  const [modoTicket, setModoTicket] = useState<SupportSolverProviderId>("solo_triaje_ia");
  const [modeloTicket, setModeloTicket] = useState<"auto" | "composer-2.5">("auto");
  const [debateTicket, setDebateTicket] = useState(false);

  const [mensajeTexto, setMensajeTexto] = useState("");
  const [esNotaInterna, setEsNotaInterna] = useState(false);
  const [resumenSolucionManual, setResumenSolucionManual] = useState("");
  const [instruccionesAgente, setInstruccionesAgente] = useState("");
  const [operando, setOperando] = useState(false);

  const [health, setHealth] = useState<SupportAdminHealthResponse | null>(null);
  const [cargandoSalud, setCargandoSalud] = useState(false);
  const [nuevaEmpresaKey, setNuevaEmpresaKey] = useState("");
  const [nuevaEmpresaNombre, setNuevaEmpresaNombre] = useState("");

  useEffect(() => {
    if (user && !isSuperAdmin(user.role)) {
      router.replace("/settings");
    }
  }, [user, router]);

  const cargarTickets = useCallback(async () => {
    setCargandoTickets(true);
    try {
      const res = await listarTicketsSoporte("todos", filtroEstado);
      setTickets(res.tickets);
      if (ticketUrlId) {
        const hallado = res.tickets.find((t) => t.id === ticketUrlId);
        if (hallado) setSeleccionado(hallado);
      } else if (!seleccionado && res.tickets[0]) {
        setSeleccionado(res.tickets[0]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error cargando tickets.");
    } finally {
      setCargandoTickets(false);
    }
  }, [filtroEstado, ticketUrlId, seleccionado]);

  const cargarSaludYConfig = useCallback(async () => {
    setCargandoSalud(true);
    try {
      const res = await fetchSupportAdminHealth();
      setHealth(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo leer la salud del sistema.");
    } finally {
      setCargandoSalud(false);
    }
  }, []);

  const abrirTicket = useCallback(
    async (id: string) => {
      try {
        const res = await obtenerTicketDetalle(id);
        setSeleccionado(res.ticket);
        setMensajes(res.messages);
        setModoTicket(
          res.ticket.solver_provider ?? health?.settings.solver_provider ?? "solo_triaje_ia"
        );
        setModeloTicket(
          res.ticket.cursor_model_override ?? health?.settings.cursor_model ?? "auto"
        );
        setDebateTicket(Boolean(res.ticket.debate_mode));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo cargar el hilo.");
      }
    },
    [health?.settings.solver_provider, health?.settings.cursor_model]
  );

  useEffect(() => {
    if (!isSuperAdmin(user?.role)) return;
    void cargarTickets();
    void cargarSaludYConfig();
  }, [user?.role, cargarTickets, cargarSaludYConfig]);

  useEffect(() => {
    if (seleccionado?.id) {
      void abrirTicket(seleccionado.id);
    }
  }, [seleccionado?.id, abrirTicket]);

  if (!isSuperAdmin(user?.role)) return null;

  const responder = async () => {
    if (!seleccionado || !mensajeTexto.trim()) return;
    setOperando(true);
    try {
      const res = await enviarMensajeTicket(seleccionado.id, {
        cuerpo: mensajeTexto.trim(),
        interno: esNotaInterna,
      });
      setMensajeTexto("");
      setSeleccionado(res.ticket);
      setMensajes((prev) => [...prev, res.message]);
      void cargarTickets();
      toast.success(esNotaInterna ? "Nota interna guardada." : "Respuesta enviada al usuario.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fallo al enviar mensaje.");
    } finally {
      setOperando(false);
    }
  };

  const cambiarEstadoManual = async (estado: SupportEstado, conResumen = false) => {
    if (!seleccionado) return;
    setOperando(true);
    try {
      const res = await accionSuperadminTicket(seleccionado.id, {
        accion: "cambiar_estado",
        estado,
        resumenSolucion: conResumen ? resumenSolucionManual.trim() : undefined,
        notificarUsuario: estado === "pendiente_confirmacion" || Boolean(resumenSolucionManual.trim()),
      });
      setSeleccionado(res.ticket);
      setResumenSolucionManual("");
      await abrirTicket(seleccionado.id);
      await cargarTickets();
      toast.success(`Estado actualizado a «${SUPPORT_ESTADO_ADMIN_LABEL[estado]}».`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar el estado.");
    } finally {
      setOperando(false);
    }
  };

  const guardarOEjecutarModoTicket = async (ejecutarAhora: boolean) => {
    if (!seleccionado) return;
    setOperando(true);
    try {
      const res = await accionSuperadminTicket(seleccionado.id, {
        accion: "configurar_modo_ticket",
        provider: modoTicket,
        cursorModel: modeloTicket,
        debateMode: debateTicket,
        ejecutarAhora,
      });
      setSeleccionado(res.ticket);
      await abrirTicket(seleccionado.id);
      await cargarTickets();
      if (ejecutarAhora) void cargarSaludYConfig();
      toast.success(res.detalle || (ejecutarAhora ? "Motor ejecutado en este ticket." : "Modo del ticket guardado."));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo aplicar el modo en este ticket.");
    } finally {
      setOperando(false);
    }
  };

  const aprobarFusionarPr = async () => {
    if (!seleccionado) return;
    setOperando(true);
    try {
      const res = await accionSuperadminTicket(seleccionado.id, {
        accion: "aprobar_fusionar_pr",
      });
      setSeleccionado(res.ticket);
      await abrirTicket(seleccionado.id);
      await cargarTickets();
      toast.success(res.detalle || "PR fusionado. El usuario recibirá solicitud de confirmación.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo fusionar el PR.");
    } finally {
      setOperando(false);
    }
  };

  const enviarInstruccionesCursor = async () => {
    if (!seleccionado || !instruccionesAgente.trim()) return;
    setOperando(true);
    try {
      const res = await accionSuperadminTicket(seleccionado.id, {
        accion: "reanudar_agente",
        instrucciones: instruccionesAgente.trim(),
      });
      setInstruccionesAgente("");
      setSeleccionado(res.ticket);
      await abrirTicket(seleccionado.id);
      toast.success(res.detalle || "Instrucciones enviadas al agente.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo reanudar el agente.");
    } finally {
      setOperando(false);
    }
  };

  const actualizarAjustes = async (patch: Partial<SupportSettingsRow> & { project_key: string }) => {
    setOperando(true);
    try {
      await guardarSupportSettings(patch);
      await cargarSaludYConfig();
      toast.success("Configuración guardada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setOperando(false);
    }
  };

  const altaNuevaEmpresa = async () => {
    const key = nuevaEmpresaKey.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    const nombre = nuevaEmpresaNombre.trim();
    if (!key || !nombre) {
      toast.error("Indica identificador (ej. inmobiliaria-norte) y nombre de la empresa.");
      return;
    }
    await actualizarAjustes({
      project_key: key,
      empresa_nombre: nombre,
      estado_adhesion: "pendiente",
      plan_activo: false,
      plan_nombre: "Pendiente de activación manual",
    });
    setNuevaEmpresaKey("");
    setNuevaEmpresaNombre("");
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Ajustes", href: "/settings" },
          { label: "Soporte y salud" },
        ]}
        title="Consola de Soporte, Empresas y Salud"
        description="Gestión manual o a demanda por ticket, control de empresas adheridas con plan activo y estado de motores (Cursor Auto / Composer 2.5)."
        actions={
          <Button asChild variant="secondary" size="sm" className="gap-1.5">
            <Link href="/soporte">
              Abrir panel de cliente (/soporte)
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        }
      />
      <SettingsAdminNav role={user?.role} />

      <div className="mt-6 min-[820px]:overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
          <button
            type="button"
            onClick={() => setPestana("bandeja")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[9px] px-3.5 py-2 text-[13.5px] font-medium",
              pestana === "bandeja"
                ? "bg-foreground text-background"
                : "bg-[var(--surface)] text-[var(--text-2)] hover:bg-[var(--surface-soft)]"
            )}
          >
            Bandeja de tickets ({tickets.length})
          </button>
          <button
            type="button"
            onClick={() => setPestana("empresas")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[9px] px-3.5 py-2 text-[13.5px] font-medium",
              pestana === "empresas"
                ? "bg-foreground text-background"
                : "bg-[var(--surface)] text-[var(--text-2)] hover:bg-[var(--surface-soft)]"
            )}
          >
            <Building2 className="h-4 w-4" />
            Empresas adheridas y plan activo
          </button>
          <button
            type="button"
            onClick={() => setPestana("salud")}
            className={cn(
              "inline-flex items-center gap-2 rounded-[9px] px-3.5 py-2 text-[13.5px] font-medium",
              pestana === "salud"
                ? "bg-foreground text-background"
                : "bg-[var(--surface)] text-[var(--text-2)] hover:bg-[var(--surface-soft)]"
            )}
          >
            <Activity className="h-4 w-4" />
            Salud del sistema
            {health ? (
              <span className={cn("h-2.5 w-2.5 rounded-full", DOT_SALUD[health.nivelGeneral])} />
            ) : null}
          </button>
        </div>

        {/* PESTAÑA 1: BANDEJA OPERATIVA Y MODO A DEMANDA POR TICKET */}
        {pestana === "bandeja" ? (
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Selector
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="h-9 rounded-[9px] border border-border bg-[var(--surface)] px-3 text-sm"
              >
                <option value="todos">Todos los estados</option>
                <option value="nuevo">Nuevos</option>
                <option value="reabierto">Reabiertos por usuario</option>
                <option value="escalado_humano">Escalados a soporte</option>
                <option value="en_curso_manual">En curso manual</option>
                <option value="pr_revision">PR listo para 1 clic</option>
                <option value="agente_trabajando">Motor trabajando</option>
                <option value="pendiente_confirmacion">Esperando confirmación del usuario</option>
                <option value="respondido_ia">Respondidos por IA</option>
                <option value="resuelto">Confirmados resueltos</option>
              </Selector>
              <Button type="button" variant="secondary" size="sm" onClick={() => void cargarTickets()} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                Refrescar
              </Button>
            </div>

            <div className="grid gap-4 min-[1024px]:grid-cols-[340px_1fr]">
              <div className="max-h-[75vh] space-y-2 overflow-y-auto pr-1">
                {cargandoTickets ? (
                  <p className="py-6 text-sm text-[var(--text-2)]">Cargando bandeja…</p>
                ) : tickets.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center text-sm text-[var(--text-2)]">
                      No hay tickets en este filtro.
                    </CardContent>
                  </Card>
                ) : (
                  tickets.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSeleccionado(t)}
                      className={cn(
                        "w-full rounded-[12px] border p-3 text-left transition-colors",
                        seleccionado?.id === t.id
                          ? "border-foreground bg-[var(--surface)]"
                          : "border-border bg-[var(--surface)] hover:bg-[var(--surface-soft)]",
                        t.estado === "reabierto" && "border-red-400"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11.5px]">
                        <span className="font-mono font-semibold">
                          {t.codigo} · {t.project_key}
                        </span>
                        <span className="rounded-full bg-[var(--surface-soft)] px-2 py-0.5 font-medium text-[var(--text-2)]">
                          {SUPPORT_ESTADO_ADMIN_LABEL[t.estado]}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[13.5px] font-semibold">{t.titulo}</p>
                      <p className="mt-1 truncate text-[11.5px] text-[var(--text-3)]">
                        {t.user_email || "Sin email"} ({t.user_role || "rol"}) · Modo:{" "}
                        {t.solver_provider || "por defecto"}
                        {t.debate_mode ? " · Debate 2x" : ""}
                      </p>
                    </button>
                  ))
                )}
              </div>

              <div>
                {!seleccionado ? (
                  <Card>
                    <CardContent className="p-8 text-center text-sm text-[var(--text-2)]">
                      Selecciona un ticket para gestionarlo.
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="space-y-5 p-5">
                      <div className="border-b border-border pb-4">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-mono font-semibold">{seleccionado.codigo}</span>
                          <span className="rounded-full bg-[var(--surface-soft)] px-2.5 py-0.5 font-medium">
                            {SUPPORT_ESTADO_ADMIN_LABEL[seleccionado.estado]}
                          </span>
                          <span className="text-[var(--text-3)]">
                            Categoría: {seleccionado.categoria} · Riesgo: {seleccionado.riesgo}
                          </span>
                          {seleccionado.reabierto_veces > 0 ? (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-800">
                              Reabierto {seleccionado.reabierto_veces}x
                            </span>
                          ) : null}
                        </div>
                        <h2 className="mt-1.5 text-lg font-semibold">{seleccionado.titulo}</h2>
                        <p className="mt-0.5 text-xs text-[var(--text-2)]">
                          Abierto por <strong>{seleccionado.user_email || seleccionado.user_id}</strong> ({seleccionado.user_role}) en ruta{" "}
                          <code className="rounded bg-[var(--surface-soft)] px-1.5 py-0.5">
                            {seleccionado.contexto?.pathname || "/"}
                          </code>
                        </p>

                        {(seleccionado.contexto?.eventos?.length ?? 0) > 0 ? (
                          <details className="mt-2.5 rounded-[9px] border border-border bg-[var(--surface-soft)] px-3 py-2 text-xs">
                            <summary className="cursor-pointer font-medium">
                              Ver {seleccionado.contexto.eventos!.length} errores de consola/red capturados automáticamente
                            </summary>
                            <ul className="mt-2 space-y-1 font-mono text-[11px] text-[var(--text-2)]">
                              {seleccionado.contexto.eventos!.map((ev, idx) => (
                                <li key={idx}>
                                  [{ev.tipo}] {ev.resumen}
                                </li>
                              ))}
                            </ul>
                          </details>
                        ) : null}
                      </div>

                      {/* MODO DEL MOTOR DE RESOLUCIÓN A DEMANDA PARA ESTE TICKET */}
                      <div className="rounded-[12px] border border-border p-3.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-2)]">
                          Modo del motor de resolución para ESTE ticket (a demanda)
                        </p>
                        <div className="mt-2.5 grid gap-3 min-[720px]:grid-cols-2">
                          <div>
                            <Label className="text-xs">Modo en este ticket</Label>
                            <Selector
                              value={modoTicket}
                              onChange={(e) => setModoTicket(e.target.value as SupportSolverProviderId)}
                              className="mt-1 h-9 w-full rounded-[8px] border border-border bg-[var(--surface)] px-2.5 text-xs"
                            >
                              {(Object.keys(SUPPORT_SOLVER_LABELS) as SupportSolverProviderId[]).map((k) => (
                                <option key={k} value={k}>
                                  {SUPPORT_SOLVER_LABELS[k].label}
                                </option>
                              ))}
                            </Selector>
                          </div>

                          {(modoTicket === "cursor_cloud" || modoTicket === "solo_triaje_ia") ? (
                            <div>
                              <Label className="text-xs">Modelo Cursor (eficiencia y coste)</Label>
                              <Selector
                                value={modeloTicket}
                                onChange={(e) => setModeloTicket(e.target.value as "auto" | "composer-2.5")}
                                className="mt-1 h-9 w-full rounded-[8px] border border-border bg-[var(--surface)] px-2.5 text-xs"
                              >
                                <option value="auto">auto (1ª opción · Máximo ahorro de costes)</option>
                                <option value="composer-2.5">composer-2.5 (Directo)</option>
                              </Selector>
                            </div>
                          ) : null}
                        </div>

                        {modoTicket === "cursor_cloud" ? (
                          <div className="mt-3 rounded-[9px] border border-border bg-[var(--surface-soft)] px-3 py-2.5 text-xs">
                            <label className="flex cursor-pointer items-start gap-2">
                              <input
                                type="checkbox"
                                checked={debateTicket}
                                onChange={(e) => setDebateTicket(e.target.checked)}
                                className="mt-0.5"
                              />
                              <span>
                                <strong className="inline-flex items-center gap-1 text-foreground">
                                  <Users className="h-3.5 w-3.5" />
                                  Activar debate entre 2 modelos (Autor + Verificador independiente)
                                </strong>
                                <span className="mt-0.5 block text-[var(--text-2)]">
                                  El agente principal ({modeloTicket}) propone la solución y un segundo subagente independiente ({modeloTicket === "auto" ? "composer-2.5" : "auto"}) audita el diff buscando fallos o regresiones antes de abrir el PR. Úsalo solo en tickets delicados para ahorrar cuota.
                                </span>
                              </span>
                            </label>
                          </div>
                        ) : null}

                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={operando}
                            onClick={() => void guardarOEjecutarModoTicket(false)}
                            className="gap-1.5"
                          >
                            <Save className="h-3.5 w-3.5" />
                            Guardar modo en este ticket
                          </Button>
                          {modoTicket !== "manual" ? (
                            <Button
                              type="button"
                              size="sm"
                              disabled={operando}
                              onClick={() => void guardarOEjecutarModoTicket(true)}
                              className="gap-1.5"
                            >
                              <Play className="h-3.5 w-3.5" />
                              {modoTicket === "solo_triaje_ia"
                                ? "Ejecutar Triaje IA ahora"
                                : "Cambiar modo y lanzar ahora"}
                            </Button>
                          ) : null}
                        </div>

                        {(seleccionado.github_pr_url || seleccionado.external_issue_url || seleccionado.vercel_preview_url) ? (
                          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3 text-xs">
                            {seleccionado.github_pr_url ? (
                              <a
                                href={seleccionado.github_pr_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"
                              >
                                <GitPullRequest className="h-3.5 w-3.5" />
                                Ver PR #{seleccionado.github_pr_number ?? ""}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : null}
                            {seleccionado.vercel_preview_url ? (
                              <a
                                href={seleccionado.vercel_preview_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"
                              >
                                Abrir Preview Vercel
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : null}
                            {seleccionado.external_issue_url ? (
                              <a
                                href={seleccionado.external_issue_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"
                              >
                                Ver referencia externa
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : null}
                            {seleccionado.github_pr_number && seleccionado.estado === "pr_revision" ? (
                              <Button
                                type="button"
                                size="sm"
                                disabled={operando}
                                onClick={() => void aprobarFusionarPr()}
                                className="ml-auto gap-1.5"
                              >
                                <ShieldCheck className="h-4 w-4" />
                                Aprobar y fusionar PR en 1 clic
                              </Button>
                            ) : null}
                          </div>
                        ) : null}

                        {seleccionado.cursor_agent_id ? (
                          <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                            <Input
                              value={instruccionesAgente}
                              onChange={(e) => setInstruccionesAgente(e.target.value)}
                              placeholder={`Dar indicación extra al agente (${seleccionado.cursor_agent_id})…`}
                              className="min-w-[220px] flex-1 text-xs"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={operando || !instruccionesAgente.trim()}
                              onClick={() => void enviarInstruccionesCursor()}
                            >
                              Enviar al agente
                            </Button>
                          </div>
                        ) : null}
                      </div>

                      {/* Bloque de control MANUAL de estados y solución */}
                      <div className="rounded-[12px] border border-border bg-[var(--surface-soft)] p-3.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-2)]">
                          Actuación manual sobre este ticket
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={operando}
                            onClick={() => void cambiarEstadoManual("en_curso_manual")}
                          >
                            Tomar en curso manual
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={operando}
                            onClick={() => void cambiarEstadoManual("esperando_usuario")}
                          >
                            Esperando datos del usuario
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={operando}
                            onClick={() => void cambiarEstadoManual("cerrado")}
                          >
                            Forzar cierre administrativo
                          </Button>
                        </div>

                        <div className="mt-3 border-t border-border pt-3">
                          <Label className="text-xs">
                            Marcar como solucionado a mano (pide confirmación al usuario en /soporte)
                          </Label>
                          <div className="mt-1.5 flex flex-wrap gap-2">
                            <Input
                              value={resumenSolucionManual}
                              onChange={(e) => setResumenSolucionManual(e.target.value)}
                              placeholder="Ej: Ya hemos corregido tu permiso / arreglado el dato en la finca..."
                              className="min-w-[240px] flex-1 bg-[var(--surface)]"
                            />
                            <Button
                              type="button"
                              size="sm"
                              disabled={operando}
                              onClick={() => void cambiarEstadoManual("pendiente_confirmacion", true)}
                              className="gap-1.5"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Proponer solución y pedir OK
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Conversación completa */}
                      <div className="space-y-2.5">
                        {mensajes.map((m) => (
                          <div
                            key={m.id}
                            className={cn(
                              "rounded-[11px] border p-3 text-sm",
                              m.interno
                                ? "border-amber-300 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/25"
                                : "border-border bg-[var(--surface)]"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2 text-[11.5px] text-[var(--text-3)]">
                              <span className="font-semibold text-foreground">
                                {m.autor_tipo.toUpperCase()} {m.interno ? "· NOTA INTERNA (oculta al usuario)" : ""}
                              </span>
                              <span>{new Date(m.created_at).toLocaleString("es-ES")}</span>
                            </div>
                            <p className="mt-1 whitespace-pre-wrap text-[13.5px]">{m.cuerpo}</p>
                            {Array.isArray(m.adjuntos) && m.adjuntos.length > 0 ? (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {m.adjuntos.map((a) =>
                                  a.signedUrl ? (
                                    <a key={a.path} href={a.signedUrl} target="_blank" rel="noreferrer">
                                      <img
                                        src={a.signedUrl}
                                        alt={a.nombre}
                                        className="h-28 rounded-[8px] border border-border object-cover"
                                      />
                                    </a>
                                  ) : null
                                )}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>

                      {/* Responder al usuario o anotar internamente */}
                      <div className="border-t border-border pt-4">
                        <div className="mb-2 flex items-center gap-3 text-xs">
                          <label className="inline-flex cursor-pointer items-center gap-1.5 font-medium">
                            <input
                              type="checkbox"
                              checked={esNotaInterna}
                              onChange={(e) => setEsNotaInterna(e.target.checked)}
                            />
                            Guardar solo como nota interna (no avisa al usuario)
                          </label>
                        </div>
                        <textarea
                          rows={3}
                          value={mensajeTexto}
                          onChange={(e) => setMensajeTexto(e.target.value)}
                          placeholder={
                            esNotaInterna
                              ? "Apunte interno para soporte…"
                              : "Escribe una respuesta para la persona que abrió el ticket…"
                          }
                          className="w-full rounded-[10px] border border-border bg-[var(--surface)] px-3 py-2 text-sm"
                        />
                        <div className="mt-2 flex justify-end">
                          <Button
                            type="button"
                            disabled={operando || !mensajeTexto.trim()}
                            onClick={() => void responder()}
                            className="gap-1.5"
                          >
                            <Send className="h-4 w-4" />
                            {esNotaInterna ? "Guardar nota interna" : "Enviar respuesta al usuario"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* PESTAÑA 2: EMPRESAS ADHERIDAS Y PLAN ACTIVO */}
        {pestana === "empresas" ? (
          <div className="mt-5 space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Empresas adheridas y estado del plan de pago</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-[var(--text-2)]">
                  Solo las empresas con <strong>Adhesión aceptada manualmente</strong> y{" "}
                  <strong>Plan de pago activo</strong> tienen acceso a abrir tickets de soporte.
                </p>

                <div className="space-y-3">
                  {(health?.empresas ?? []).map((emp) => {
                    const estadoGlobal = empresaTieneSoporteActivo(emp);
                    return (
                      <div
                        key={emp.project_key}
                        className="rounded-[12px] border border-border bg-[var(--surface-soft)] p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="font-semibold text-foreground">{emp.empresa_nombre}</span>{" "}
                            <span className="font-mono text-xs text-[var(--text-2)]">({emp.project_key})</span>
                          </div>
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                              estadoGlobal.activo
                                ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200"
                                : "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200"
                            )}
                          >
                            {estadoGlobal.activo ? "Acceso a soporte ACTIVO" : `BLOQUEADO · ${estadoGlobal.motivo}`}
                          </span>
                        </div>

                        <div className="mt-3 grid gap-3 min-[720px]:grid-cols-4">
                          <div>
                            <Label className="text-xs">Decisión de adhesión (manual)</Label>
                            <Selector
                              value={emp.estado_adhesion}
                              onChange={(e) =>
                                void actualizarAjustes({
                                  project_key: emp.project_key,
                                  estado_adhesion: e.target.value as SupportAdhesionEstado,
                                })
                              }
                              className="mt-1 h-9 w-full rounded-[8px] border border-border bg-[var(--surface)] px-2.5 text-sm"
                            >
                              <option value="pendiente">Pendiente de aceptar</option>
                              <option value="aceptada">Aceptada</option>
                              <option value="suspendida">Pausada / Suspendida</option>
                              <option value="rechazada">Rechazada</option>
                            </Selector>
                          </div>

                          <div>
                            <Label className="text-xs">Plan de pago activo</Label>
                            <div className="mt-1 flex h-9 items-center gap-2">
                              <input
                                type="checkbox"
                                checked={emp.plan_activo}
                                onChange={(e) =>
                                  void actualizarAjustes({
                                    project_key: emp.project_key,
                                    plan_activo: e.target.checked,
                                  })
                                }
                              />
                              <span className="text-sm">{emp.plan_activo ? "Al corriente de pago" : "Inactivo / Impago"}</span>
                            </div>
                          </div>

                          <div>
                            <Label className="text-xs">Nombre del plan</Label>
                            <Input
                              defaultValue={emp.plan_nombre}
                              onBlur={(e) => {
                                if (e.target.value !== emp.plan_nombre) {
                                  void actualizarAjustes({
                                    project_key: emp.project_key,
                                    plan_nombre: e.target.value,
                                  });
                                }
                              }}
                              className="mt-1 h-9 bg-[var(--surface)]"
                            />
                          </div>

                          <div>
                            <Label className="text-xs">Vencimiento manual (opcional)</Label>
                            <Input
                              type="date"
                              defaultValue={emp.plan_vence_en ?? ""}
                              onBlur={(e) => {
                                if ((e.target.value || null) !== emp.plan_vence_en) {
                                  void actualizarAjustes({
                                    project_key: emp.project_key,
                                    plan_vence_en: e.target.value || null,
                                  });
                                }
                              }}
                              className="mt-1 h-9 bg-[var(--surface)]"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-border pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-2)]">
                    Pre-registrar otra inmobiliaria / clon futuro
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Input
                      placeholder="Clave proyecto (ej: crm-costa)"
                      value={nuevaEmpresaKey}
                      onChange={(e) => setNuevaEmpresaKey(e.target.value)}
                      className="max-w-[220px]"
                    />
                    <Input
                      placeholder="Nombre agencia (ej: Inmobiliaria Costa)"
                      value={nuevaEmpresaNombre}
                      onChange={(e) => setNuevaEmpresaNombre(e.target.value)}
                      className="max-w-[260px]"
                    />
                    <Button type="button" variant="secondary" onClick={() => void altaNuevaEmpresa()}>
                      Añadir empresa
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* PESTAÑA 3: SALUD DEL SISTEMA Y MOTORES POR DEFECTO */}
        {pestana === "salud" && health ? (
          <div className="mt-5 space-y-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Salud en tiempo real del sistema de tickets</CardTitle>
                  <p className="mt-1 text-xs text-[var(--text-2)]">
                    El guardado de tickets es directo a base de datos: aunque no haya claves externas activas, ningún ticket se pierde nunca.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={cargandoSalud}
                  onClick={() => void cargarSaludYConfig()}
                  className="gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Comprobar ahora
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {health.checks.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-start gap-3 rounded-[11px] border border-border bg-[var(--surface-soft)] p-3.5"
                  >
                    <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", DOT_SALUD[c.nivel])} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{c.label}</p>
                      <p className="mt-0.5 text-[13px] text-[var(--text-2)]">{c.detalle}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Comportamiento por defecto para nuevos tickets (ahorro de costes)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 min-[720px]:grid-cols-3">
                  <div>
                    <Label className="text-xs">Modo por defecto al entrar un ticket nuevo</Label>
                    <Selector
                      value={health.settings.solver_provider}
                      onChange={(e) =>
                        void actualizarAjustes({
                          project_key: health.settings.project_key,
                          solver_provider: e.target.value as SupportSolverProviderId,
                        })
                      }
                      className="mt-1 h-10 w-full rounded-[9px] border border-border bg-[var(--surface)] px-3 text-sm"
                    >
                      {(Object.keys(SUPPORT_SOLVER_LABELS) as SupportSolverProviderId[]).map((k) => (
                        <option key={k} value={k}>
                          {SUPPORT_SOLVER_LABELS[k].label}
                        </option>
                      ))}
                    </Selector>
                    <p className="mt-1 text-xs text-[var(--text-2)]">
                      Luego puedes cambiar el modo individualmente dentro de cada ticket.
                    </p>
                  </div>

                  <div>
                    <Label className="text-xs">Modelo prioritario en Cursor (Triaje + Agente)</Label>
                    <Selector
                      value={health.settings.cursor_model}
                      onChange={(e) =>
                        void actualizarAjustes({
                          project_key: health.settings.project_key,
                          cursor_model: e.target.value as "auto" | "composer-2.5",
                        })
                      }
                      className="mt-1 h-10 w-full rounded-[9px] border border-border bg-[var(--surface)] px-3 text-sm"
                    >
                      <option value="auto">auto (Recomendado · Máximo ahorro)</option>
                      <option value="composer-2.5">composer-2.5</option>
                    </Selector>
                    <p className="mt-1 text-xs text-[var(--text-3)]">
                      Usa tu CURSOR_API_KEY sin necesitar API de Anthropic aparte.
                    </p>
                  </div>

                  <div>
                    <Label className="text-xs">
                      Tope automático semanal (usados 7d: {health.runsEstaSemana})
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      max={500}
                      defaultValue={health.settings.max_agent_runs_per_week}
                      onBlur={(e) =>
                        void actualizarAjustes({
                          project_key: health.settings.project_key,
                          max_agent_runs_per_week: Number(e.target.value || 0),
                        })
                      }
                      className="mt-1 h-10"
                    />
                  </div>
                </div>

                {health.settings.solver_provider === "cursor_cloud" ? (
                  <div className="border-t border-border pt-3">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={health.settings.auto_merge_enabled}
                        onChange={(e) =>
                          void actualizarAjustes({
                            project_key: health.settings.project_key,
                            auto_merge_enabled: e.target.checked,
                          })
                        }
                      />
                      Permitir auto-merge con los 4 candados (el ticket seguirá pidiendo confirmación al usuario)
                    </label>
                  </div>
                ) : null}

                {health.settings.solver_provider === "webhook_externo" ? (
                  <div className="border-t border-border pt-3">
                    <Label className="text-xs">URL del Webhook externo</Label>
                    <Input
                      defaultValue={health.settings.solver_webhook_url ?? ""}
                      placeholder="https://..."
                      onBlur={(e) =>
                        void actualizarAjustes({
                          project_key: health.settings.project_key,
                          solver_webhook_url: e.target.value,
                        })
                      }
                      className="mt-1"
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function SoporteSuperadminPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-[var(--text-2)]">Cargando consola…</p>}>
      <ConsolaSoporteSuperadmin />
    </Suspense>
  );
}
