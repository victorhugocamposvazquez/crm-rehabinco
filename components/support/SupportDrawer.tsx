"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, ExternalLink, ImagePlus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth/auth-context";
import { isSuperAdmin } from "@/lib/auth/roles";
import { usePermisos } from "@/lib/auth/permisos-context";
import { PERMISOS } from "@/lib/auth/permisos";
import {
  crearTicketSoporte,
  listarTicketsSoporte,
  subirAdjuntoSoporte,
} from "@/lib/support/client";
import { capturarSnapshotContexto } from "@/lib/support/telemetry";
import {
  SUPPORT_ESTADO_USUARIO_LABEL,
  requiereConfirmacionUsuario,
  type SupportAttachmentRef,
  type SupportCategoria,
  type SupportTicket,
} from "@/lib/support/types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activo: boolean;
  motivoInactivo: string | null;
  onCreated?: () => void;
};

export function SupportDrawer({
  open,
  onOpenChange,
  activo,
  motivoInactivo,
  onCreated,
}: Props) {
  const { user } = useAuth();
  const { tiene } = usePermisos();
  const router = useRouter();
  const [tab, setTab] = useState<"nuevo" | "mios">("nuevo");
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState<SupportCategoria>("bug");
  const [adjuntos, setAdjuntos] = useState<SupportAttachmentRef[]>([]);
  const [capturando, setCapturando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [cargandoLista, setCargandoLista] = useState(false);

  const cargarMios = useCallback(async () => {
    setCargandoLista(true);
    try {
      const res = await listarTicketsSoporte("mios");
      setTickets(res.tickets);
    } catch {
      // Silencio
    } finally {
      setCargandoLista(false);
    }
  }, []);

  useEffect(() => {
    if (open && tab === "mios") {
      void cargarMios();
    }
  }, [open, tab, cargarMios]);

  const capturarPantallaActual = async () => {
    setCapturando(true);
    try {
      // Cerramos visualmente un instante para fotografiar la pantalla real detrás del cajón
      onOpenChange(false);
      await new Promise((r) => setTimeout(r, 220));

      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(document.body, {
        scale: Math.min(window.devicePixelRatio || 1, 1.5),
        useCORS: true,
        logging: false,
        ignoreElements: (el) => el.hasAttribute("data-support-redact"),
      });

      onOpenChange(true);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/png", 0.9)
      );
      if (!blob) throw new Error("No se pudo generar la imagen.");

      const subido = await subirAdjuntoSoporte(blob, `pantalla-${Date.now()}.png`);
      setAdjuntos((prev) => [...prev, subido].slice(0, 4));
      toast.success("Captura de pantalla añadida.");
    } catch (err) {
      onOpenChange(true);
      toast.error(err instanceof Error ? err.message : "No se pudo capturar la pantalla.");
    } finally {
      setCapturando(false);
    }
  };

  const subirArchivoManual = async (file: File | null) => {
    if (!file) return;
    try {
      const subido = await subirAdjuntoSoporte(file, file.name);
      setAdjuntos((prev) => [...prev, subido].slice(0, 4));
      toast.success("Imagen adjuntada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al subir la imagen.");
    }
  };

  const enviar = async () => {
    if (!titulo.trim() || !descripcion.trim()) {
      toast.error("Completa el asunto y explica brevemente qué pasa.");
      return;
    }
    setEnviando(true);
    try {
      const permisosActivos = PERMISOS.filter((p) => tiene(p.id)).map((p) => p.id);
      const contexto = capturarSnapshotContexto(permisosActivos);
      const { ticket } = await crearTicketSoporte({
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        categoria,
        contexto,
        adjuntos,
      });

      setTitulo("");
      setDescripcion("");
      setAdjuntos([]);
      onCreated?.();
      toast.success(`Consulta registrada (${ticket.codigo}).`);
      onOpenChange(false);
      router.push(`/soporte?ticket=${encodeURIComponent(ticket.id)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo registrar el ticket.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} variant="side" side="right" showCloseButton>
      <div data-support-redact className="flex h-full flex-col">
        <div className="border-b border-border px-5 pb-3 pt-5 pr-14">
          <h2 className="text-[16px] font-semibold">Soporte y ayuda</h2>
          <p className="mt-0.5 text-[12.5px] text-[var(--text-2)]">
            Abre una consulta o revisa el estado de tus tickets.
          </p>
          <div className="mt-3 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTab("nuevo")}
              className={cn(
                "rounded-[8px] px-3 py-1.5 text-[13px] font-medium",
                tab === "nuevo"
                  ? "bg-foreground text-background"
                  : "bg-[var(--surface-soft)] text-[var(--text-2)] hover:text-foreground"
              )}
            >
              Nueva consulta
            </button>
            <button
              type="button"
              onClick={() => setTab("mios")}
              className={cn(
                "rounded-[8px] px-3 py-1.5 text-[13px] font-medium",
                tab === "mios"
                  ? "bg-foreground text-background"
                  : "bg-[var(--surface-soft)] text-[var(--text-2)] hover:text-foreground"
              )}
            >
              Mis tickets
            </button>
            <Link
              href="/soporte"
              onClick={() => onOpenChange(false)}
              className="ml-auto inline-flex items-center gap-1 text-[12.5px] font-medium text-accent hover:underline"
            >
              Panel completo
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {!activo && !isSuperAdmin(user?.role) ? (
            <div className="rounded-[12px] border border-border bg-[var(--surface-soft)] p-4 text-sm">
              <p className="font-semibold text-foreground">Servicio de soporte no activo</p>
              <p className="mt-1 text-[var(--text-2)]">
                {motivoInactivo ||
                  "Esta cuenta no tiene un plan de soporte activo actualmente. Contacta con la dirección de tu agencia."}
              </p>
            </div>
          ) : tab === "nuevo" ? (
            <div className="space-y-4">
              <div>
                <Label>¿Qué tipo de consulta es?</Label>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { id: "bug", label: "Algo falla / Error" },
                      { id: "duda", label: "Duda de cómo usar" },
                      { id: "datos", label: "Datos / Catastro / Portal" },
                      { id: "mejora", label: "Sugerencia o mejora" },
                    ] as const
                  ).map((op) => (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => setCategoria(op.id)}
                      className={cn(
                        "rounded-[9px] border px-3 py-2 text-left text-[12.5px] font-medium transition-colors",
                        categoria === op.id
                          ? "border-foreground bg-[var(--surface-soft)] text-foreground"
                          : "border-border text-[var(--text-2)] hover:bg-[var(--surface-soft)]"
                      )}
                    >
                      {op.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="soporte-titulo">Asunto breve</Label>
                <Input
                  id="soporte-titulo"
                  placeholder="Ej: No me deja guardar el teléfono en la finca"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="soporte-descripcion">¿Qué estaba haciendo y qué ha pasado?</Label>
                <textarea
                  id="soporte-descripcion"
                  rows={5}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Cuéntalo con tus palabras. Nosotros adjuntamos automáticamente en qué pantalla estás y si hubo algún fallo técnico."
                  className="w-full rounded-[10px] border border-border bg-[var(--surface)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void capturarPantallaActual()}
                    disabled={capturando || adjuntos.length >= 4}
                    className="gap-1.5"
                  >
                    <Camera className="h-4 w-4" />
                    {capturando ? "Capturando…" : "Capturar esta pantalla"}
                  </Button>
                  <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[9px] border border-border bg-[var(--surface)] px-3 text-[13px] font-medium hover:bg-[var(--surface-soft)]">
                    <ImagePlus className="h-4 w-4" />
                    Subir imagen
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        e.target.value = "";
                        void subirArchivoManual(f);
                      }}
                    />
                  </label>
                </div>

                {adjuntos.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {adjuntos.map((a) => (
                      <div
                        key={a.path}
                        className="relative overflow-hidden rounded-[9px] border border-border bg-[var(--surface-soft)] p-1.5"
                      >
                        {a.signedUrl ? (
                          <img
                            src={a.signedUrl}
                            alt={a.nombre}
                            className="h-20 w-full rounded-[6px] object-cover"
                          />
                        ) : (
                          <div className="grid h-20 place-items-center text-xs text-[var(--text-2)]">
                            {a.nombre}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => setAdjuntos((prev) => prev.filter((x) => x.path !== a.path))}
                          className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-white"
                          aria-label="Quitar captura"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="pt-2">
                <Button
                  type="button"
                  onClick={() => void enviar()}
                  disabled={enviando}
                  className="w-full gap-2"
                >
                  <Send className="h-4 w-4" />
                  {enviando ? "Enviando…" : "Enviar a soporte"}
                </Button>
                <p className="mt-2 text-center text-[11.5px] text-[var(--text-3)]">
                  Recibirás aviso en el CRM y podrás seguirlo desde tu panel en /soporte.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {cargandoLista ? (
                <p className="py-6 text-center text-sm text-[var(--text-2)]">Cargando tus tickets…</p>
              ) : tickets.length === 0 ? (
                <p className="rounded-[10px] border border-dashed border-border px-4 py-8 text-center text-sm text-[var(--text-2)]">
                  Aún no has abierto ninguna consulta.
                </p>
              ) : (
                tickets.map((t) => {
                  const pideConfirmar = requiereConfirmacionUsuario(t.estado);
                  return (
                    <Link
                      key={t.id}
                      href={`/soporte?ticket=${encodeURIComponent(t.id)}`}
                      onClick={() => onOpenChange(false)}
                      className={cn(
                        "block rounded-[11px] border p-3 transition-colors hover:bg-[var(--surface-soft)]",
                        pideConfirmar ? "border-amber-400 bg-amber-50/40 dark:bg-amber-950/20" : "border-border"
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
                      <p className="mt-1 truncate text-[13.5px] font-semibold text-foreground">{t.titulo}</p>
                      <p className="mt-0.5 text-[11.5px] text-[var(--text-3)]">
                        Actualizado {new Date(t.updated_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}
                      </p>
                    </Link>
                  );
                })
              )}
            </div>
          )}
        </div>

        {isSuperAdmin(user?.role) ? (
          <div className="border-t border-border bg-[var(--surface-soft)] px-5 py-3 text-[12.5px]">
            <Link
              href="/settings/soporte"
              onClick={() => onOpenChange(false)}
              className="font-semibold text-accent hover:underline"
            >
              Abrir consola Superadmin y Sala de Salud de Soporte →
            </Link>
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}
