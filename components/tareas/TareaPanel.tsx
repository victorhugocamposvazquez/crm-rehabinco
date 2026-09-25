"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { TimeInput } from "@/components/ui/time-input";
import { Sheet } from "@/components/ui/sheet";
import { AvatarComercial } from "@/components/ui/avatar-comercial";
import { CampoComentario, TextoConMenciones } from "@/components/tareas/CampoComentario";
import { useFichaPeek } from "@/components/crm/FichaPeek";
import { relacionUno } from "@/lib/citas/citas";
import { inmuebleDesdeNotasCaptacion } from "@/lib/captacion/portales/contacto";
import { nombreYApellido } from "@/lib/ui/tokens";
import {
  COLUMNAS_TAREA,
  columnaDeTarea,
  cuandoComentario,
  textoVinculoTarea,
  venceLargo,
  type ColumnaTarea,
} from "@/lib/tareas/tareas";

export type TareaDetalle = {
  id: string;
  comercial_id: string;
  creado_por?: string | null;
  mencionados?: string[] | null;
  titulo: string;
  vence: string | null;
  hora?: string | null;
  estado: string;
  finca_reference: string | null;
  propiedad_id: string | null;
  cliente_id: string | null;
  demanda_id?: string | null;
  cita_id?: string | null;
  parte_visita_id?: string | null;
  created_at?: string | null;
  propiedades?: { titulo?: string | null; direccion?: string | null; referencia?: string | null } | null;
  clientes?: { nombre?: string | null } | null;
  demandas?: { tipo_operacion?: string | null } | null;
  partes_visita?: { inmueble_direccion?: string | null; fecha_visita?: string | null } | null;
  cita?: { lugar?: string | null; notas?: string | null } | null;
  profiles?: { nombre_completo?: string | null; color?: string | null; email?: string | null } | null;
  creador?: { nombre_completo?: string | null; color?: string | null; email?: string | null } | null;
};

type Actividad = {
  id: string;
  cuando: string;
  texto: string;
  actor?: { nombre?: string | null; color?: string | null } | null;
};

export function TareaPanel({
  tarea,
  hoy,
  userId,
  comerciales,
  onClose,
  onPatch,
  onToggle,
  onMover,
}: {
  tarea: TareaDetalle | null;
  hoy: string;
  userId: string;
  comerciales: Array<{ id: string; nombre: string; color: string | null }>;
  onClose: () => void;
  onPatch: (id: string, patch: Record<string, unknown>) => Promise<void>;
  onToggle: (id: string) => void;
  onMover: (id: string, col: ColumnaTarea) => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [finca, setFinca] = useState("");
  const [actividad, setActividad] = useState<Actividad[]>([]);
  const [propsOpts, setPropsOpts] = useState<Array<{ id: string; label: string }>>([]);
  const [cliOpts, setCliOpts] = useState<Array<{ id: string; label: string }>>([]);
  const [demOpts, setDemOpts] = useState<Array<{ id: string; label: string }>>([]);
  const [parteOpts, setParteOpts] = useState<Array<{ id: string; label: string; propiedadId: string | null }>>([]);
  const { abrir: abrirFicha } = useFichaPeek();

  useEffect(() => {
    setTitulo(tarea?.titulo ?? "");
    setFinca(tarea?.finca_reference ?? "");
  }, [tarea?.id, tarea?.titulo]);

  useEffect(() => {
    if (!tarea) {
      setActividad([]);
      return;
    }
    const supabase = createClient();
    let cancelled = false;
    void supabase
      .from("tareas_actividad")
      .select("id, texto, created_at, profiles:actor_id(nombre_completo, color)")
      .eq("tarea_id", tarea.id)
      .eq("tipo", "nota")
      .order("created_at")
      .then(({ data }) => {
        if (cancelled) return;
        setActividad(
          ((data ?? []) as Array<{
            id: string;
            texto: string;
            created_at: string;
            profiles?: { nombre_completo?: string | null; color?: string | null } | { nombre_completo?: string | null; color?: string | null }[] | null;
          }>).map((row) => {
            const actor = relacionUno(row.profiles);
            return {
              id: row.id,
              cuando: cuandoComentario(row.created_at, hoy),
              texto: row.texto,
              actor: actor ? { nombre: actor.nombre_completo, color: actor.color } : null,
            };
          })
        );
      });
    return () => {
      cancelled = true;
    };
  }, [tarea?.id, hoy]);

  useEffect(() => {
    if (!tarea) return;
    const supabase = createClient();
    void supabase
      .from("propiedades")
      .select("id, titulo, direccion, referencia")
      .order("updated_at", { ascending: false })
      .limit(200)
      .then(({ data }) =>
        setPropsOpts(
          (data ?? []).map((p) => ({
            id: p.id,
            label: [p.referencia, p.titulo || p.direccion].filter(Boolean).join(" · ") || "Inmueble",
          }))
        )
      );
    void supabase
      .from("clientes")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre")
      .limit(200)
      .then(({ data }) => setCliOpts((data ?? []).map((c) => ({ id: c.id, label: c.nombre }))));
    void supabase
      .from("demandas")
      .select("id, tipo_operacion, clientes:cliente_id(nombre)")
      .in("estado", ["activa", "pausada"])
      .order("updated_at", { ascending: false })
      .limit(200)
      .then(({ data }) =>
        setDemOpts(
          ((data ?? []) as Array<{
            id: string;
            tipo_operacion: string;
            clientes?: { nombre?: string | null } | { nombre?: string | null }[] | null;
          }>).map((d) => ({
            id: d.id,
            label: `${relacionUno(d.clientes)?.nombre ?? "Cliente"} · ${d.tipo_operacion}`,
          }))
        )
      );
    void supabase
      .from("partes_visita")
      .select("id, inmueble_direccion, fecha_visita, propiedad_id")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) =>
        setParteOpts(
          (data ?? []).map((p) => ({
            id: p.id,
            propiedadId: p.propiedad_id,
            label: [p.inmueble_direccion, p.fecha_visita].filter(Boolean).join(" · ") || "Parte",
          }))
        )
      );
  }, [tarea?.id]);

  if (!tarea) return null;

  const col = columnaDeTarea(tarea.vence, hoy, tarea.estado);
  const colMeta = COLUMNAS_TAREA.find((c) => c.id === col);
  const hecha = tarea.estado === "hecha";
  const nombreCreador =
    nombreYApellido(
      tarea.creador?.nombre_completo ?? comerciales.find((c) => c.id === tarea.creado_por)?.nombre,
      tarea.creador?.email
    ) || "—";
  const nombreAsignado =
    nombreYApellido(
      tarea.profiles?.nombre_completo ?? comerciales.find((c) => c.id === tarea.comercial_id)?.nombre,
      tarea.profiles?.email
    ) || "—";
  const inmuebleCaptacion = tarea.propiedad_id ? null : inmuebleDesdeNotasCaptacion(tarea.cita?.notas, tarea.cita?.lugar);
  const vinculo = textoVinculoTarea({
    propiedad: [tarea.propiedades?.referencia, tarea.propiedades?.titulo || tarea.propiedades?.direccion]
      .filter(Boolean)
      .join(" · ") || inmuebleCaptacion,
    cliente: tarea.clientes?.nombre,
    finca: tarea.finca_reference,
    demanda: tarea.demandas?.tipo_operacion ? `Demanda ${tarea.demandas.tipo_operacion}` : null,
    parte: tarea.partes_visita?.inmueble_direccion,
  });
  const destinoPrincipal = tarea.propiedad_id
    ? ({ tipo: "propiedad", id: tarea.propiedad_id } as const)
    : tarea.cliente_id
      ? ({ tipo: "cliente", id: tarea.cliente_id } as const)
      : tarea.finca_reference
        ? ({ tipo: "finca", id: tarea.finca_reference } as const)
        : tarea.demanda_id
          ? ({ tipo: "demanda", id: tarea.demanda_id } as const)
          : tarea.parte_visita_id
            ? ({ tipo: "parte", id: tarea.parte_visita_id } as const)
            : null;

  const guardarTitulo = () => {
    const limpio = titulo.trim();
    if (!limpio || limpio === tarea.titulo) {
      setTitulo(tarea.titulo);
      return;
    }
    void onPatch(tarea.id, { titulo: limpio });
  };

  const guardarNota = async (texto: string, mencionados: string[]) => {
    if (mencionados.length > 0) {
      const unidos = [...new Set([...(tarea.mencionados ?? []), ...mencionados])];
      await onPatch(tarea.id, { mencionados: unidos });
    }
    const supabase = createClient();
    const { data, error } = await supabase
      .from("tareas_actividad")
      .insert({ tarea_id: tarea.id, actor_id: userId, tipo: "nota", texto, mencionados })
      .select("id, created_at")
      .single();
    if (error || !data) {
      toast.error("No se ha podido guardar el comentario.");
      return;
    }
    const yo = comerciales.find((c) => c.id === userId);
    setActividad((prev) => [
      ...prev,
      { id: data.id, cuando: cuandoComentario(data.created_at, hoy), texto, actor: yo ? { nombre: yo.nombre, color: yo.color } : null },
    ]);
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()} variant="side" side="right">
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center gap-2.5 border-b border-[var(--border-soft)] px-4 py-3.5">
          <span className="flex-1 text-[11px] uppercase tracking-[.08em] text-[var(--label)]">Tarea</span>
          <button
            type="button"
            onClick={onClose}
            className="grid h-[34px] w-[34px] place-items-center rounded-lg text-[var(--text-2)] hover:bg-[var(--surface-soft)]"
            aria-label="Cerrar"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M6 6l12 12" />
              <path d="M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="flex items-start gap-2.5">
            <button
              type="button"
              aria-label="Hecha"
              onClick={() => onToggle(tarea.id)}
              className="mt-1 h-5 w-5 shrink-0 rounded-[6px] border-[1.5px]"
              style={{
                borderColor: hecha ? "#0B7461" : "#CFCBC2",
                background: hecha ? "#0B7461" : "#fff",
              }}
            />
            <textarea
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              onBlur={guardarTitulo}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  (e.target as HTMLTextAreaElement).blur();
                }
              }}
              rows={2}
              className="min-h-[52px] w-full resize-none bg-transparent text-[19px] font-semibold leading-snug tracking-[-.01em] outline-none"
            />
          </div>

          <div className="mt-[18px] grid grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[.07em] text-[var(--label)]">Columna</div>
              <div className="mt-1 flex items-center gap-1.5 text-[13.5px]">
                <span className="h-2 w-2 rounded-full" style={{ background: colMeta?.dot }} />
                {colMeta?.label}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[.07em] text-[var(--label)]">Vence</div>
              <input
                type="date"
                value={tarea.vence ?? ""}
                onChange={(e) =>
                  void onPatch(tarea.id, {
                    vence: e.target.value || null,
                    estado: hecha ? "hecha" : tarea.estado === "esperando" ? "esperando" : "pendiente",
                  })
                }
                className="mt-1 w-full bg-transparent text-[13.5px] capitalize outline-none"
              />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[.07em] text-[var(--label)]">Creada por</div>
              <div className="mt-1 flex items-center gap-1.5 text-[13.5px]">
                <AvatarComercial
                  nombre={tarea.creador?.nombre_completo ?? nombreCreador}
                  email={tarea.creador?.email}
                  color={tarea.creador?.color ?? tarea.profiles?.color}
                  size={18}
                />
                {nombreCreador}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[.07em] text-[var(--label)]">Asignada a</div>
              {comerciales.length > 0 ? (
                <div className="mt-1 flex items-center gap-1.5">
                  <AvatarComercial
                    nombre={tarea.profiles?.nombre_completo ?? nombreAsignado}
                    email={tarea.profiles?.email}
                    color={tarea.profiles?.color}
                    size={18}
                  />
                  <select
                    value={tarea.comercial_id}
                    onChange={(e) => void onPatch(tarea.id, { comercial_id: e.target.value })}
                    className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none"
                  >
                    {comerciales.some((c) => c.id === tarea.comercial_id) ? null : (
                      <option value={tarea.comercial_id}>{nombreAsignado}</option>
                    )}
                    {comerciales.map((c) => (
                      <option key={c.id} value={c.id}>
                        {nombreYApellido(c.nombre) || c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="mt-1 flex items-center gap-1.5 text-[13.5px]">
                  <AvatarComercial
                    nombre={tarea.profiles?.nombre_completo ?? nombreAsignado}
                    email={tarea.profiles?.email}
                    color={tarea.profiles?.color}
                    size={18}
                  />
                  {nombreAsignado}
                </div>
              )}
            </div>
            <div className="col-span-2">
              <div className="text-[11px] uppercase tracking-[.07em] text-[var(--label)]">Vinculado a</div>
              {destinoPrincipal && vinculo !== "Sin vincular" ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    abrirFicha(destinoPrincipal);
                  }}
                  className="mt-1 flex min-h-11 w-full items-center truncate rounded-[9px] bg-accent-soft px-3 text-left text-[13.5px] font-medium text-accent"
                >
                  {vinculo}
                </button>
              ) : inmuebleCaptacion ? (
                <p className="mt-1 rounded-[9px] bg-accent-soft px-3 py-2 text-[13.5px] font-medium text-accent">{inmuebleCaptacion}</p>
              ) : (
                <p className="mt-1 text-[13.5px] text-[var(--text-2)]">Sin vincular</p>
              )}
            </div>
          </div>

          <div className="mt-[18px] rounded-[11px] border border-border bg-[#FBFBF9] px-3.5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 text-[13.5px] font-semibold">
                <CalendarDays size={15} className="text-accent" />
                Calendario
              </div>
              {tarea.hora ? (
                <label className="flex items-center gap-2 text-[12.5px] text-[var(--text-2)]">
                  Programada · {venceLargo(tarea.vence)}
                  <TimeInput
                    value={tarea.hora.slice(0, 5)}
                    onChange={(v) => void onPatch(tarea.id, { hora: v || null })}
                    className="h-8 rounded-lg border border-[var(--input)] bg-white px-2 text-[13px]"
                  />
                </label>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void onPatch(tarea.id, { hora: "12:00", vence: tarea.vence ?? hoy })}
                >
                  Poner hora y añadir
                </Button>
              )}
            </div>
          </div>

          <div className="mt-[18px] grid gap-3">
            <CampoVinculo
              label="Inmueble"
              valor={
                tarea.propiedad_id
                  ? propsOpts.find((p) => p.id === tarea.propiedad_id)?.label || vinculo
                  : inmuebleCaptacion
              }
              onVer={tarea.propiedad_id ? () => abrirFicha({ tipo: "propiedad", id: tarea.propiedad_id! }) : undefined}
            >
              {inmuebleCaptacion ? (
                <div className="mt-1 rounded-[9px] bg-accent-soft px-3 py-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[.07em] text-accent">Captación</div>
                  <p className="mt-0.5 text-[13.5px] font-medium leading-snug">{inmuebleCaptacion}</p>
                </div>
              ) : null}
              <select
                value={tarea.propiedad_id ?? ""}
                onChange={(e) =>
                  void onPatch(tarea.id, { propiedad_id: e.target.value || null })
                }
                className="mt-1 flex h-10 w-full rounded-[9px] border border-[var(--input)] bg-white px-2.5 text-[13.5px] text-foreground"
              >
                <option value="">{inmuebleCaptacion ? "Sin inmueble del CRM" : "Sin inmueble"}</option>
                {propsOpts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </CampoVinculo>
            <CampoVinculo
              label="Cliente"
              valor={tarea.cliente_id ? (cliOpts.find((c) => c.id === tarea.cliente_id)?.label || tarea.clientes?.nombre) : null}
              onVer={tarea.cliente_id ? () => abrirFicha({ tipo: "cliente", id: tarea.cliente_id! }) : undefined}
            >
              <select
                value={tarea.cliente_id ?? ""}
                onChange={(e) =>
                  void onPatch(tarea.id, { cliente_id: e.target.value || null })
                }
                className="mt-1 flex h-10 w-full rounded-[9px] border border-[var(--input)] bg-white px-2.5 text-[13.5px] text-foreground"
              >
                <option value="">Sin cliente</option>
                {cliOpts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </CampoVinculo>
            <CampoVinculo
              label="Demanda"
              valor={tarea.demanda_id ? (demOpts.find((d) => d.id === tarea.demanda_id)?.label || tarea.demandas?.tipo_operacion) : null}
              onVer={tarea.demanda_id ? () => abrirFicha({ tipo: "demanda", id: tarea.demanda_id! }) : undefined}
            >
              <select
                value={tarea.demanda_id ?? ""}
                onChange={(e) =>
                  void onPatch(tarea.id, { demanda_id: e.target.value || null })
                }
                className="mt-1 flex h-10 w-full rounded-[9px] border border-[var(--input)] bg-white px-2.5 text-[13.5px] text-foreground"
              >
                <option value="">Sin demanda</option>
                {demOpts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </CampoVinculo>
            <CampoVinculo
              label="Parte de visita"
              valor={tarea.parte_visita_id ? (parteOpts.find((p) => p.id === tarea.parte_visita_id)?.label || tarea.partes_visita?.inmueble_direccion) : null}
              onVer={tarea.parte_visita_id ? () => abrirFicha({ tipo: "parte", id: tarea.parte_visita_id! }) : undefined}
            >
              <select
                value={tarea.parte_visita_id ?? ""}
                onChange={(e) => {
                  const parte = parteOpts.find((p) => p.id === e.target.value);
                  void onPatch(tarea.id, {
                    parte_visita_id: e.target.value || null,
                    ...(parte?.propiedadId && !tarea.propiedad_id ? { propiedad_id: parte.propiedadId } : {}),
                  });
                }}
                className="mt-1 flex h-10 w-full rounded-[9px] border border-[var(--input)] bg-white px-2.5 text-[13.5px] text-foreground"
              >
                <option value="">Sin parte</option>
                {parteOpts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </CampoVinculo>
            <CampoVinculo
              label="Finca (Catastro)"
              valor={tarea.finca_reference}
              onVer={tarea.finca_reference ? () => abrirFicha({ tipo: "finca", id: tarea.finca_reference! }) : undefined}
            >
              <input
                value={finca}
                onChange={(e) => setFinca(e.target.value)}
                onBlur={() => {
                  const valor = finca.trim() || null;
                  if (valor === (tarea.finca_reference ?? null)) return;
                  void onPatch(tarea.id, { finca_reference: valor });
                }}
                placeholder="Referencia catastral"
                className="mt-1 flex h-10 w-full rounded-[9px] border border-[var(--input)] bg-white px-2.5 font-mono text-[12.5px] text-foreground"
              />
            </CampoVinculo>
          </div>

          <div className="mt-[18px]">
            <div className="mb-2 text-[11px] uppercase tracking-[.07em] text-[var(--label)]">Comentarios</div>
            {actividad.length === 0 ? (
              <p className="mb-3 text-[12.5px] text-[var(--text-3)]">Todavía no hay comentarios. Escribe el primero.</p>
            ) : (
              <div className="mb-3 space-y-2.5">
                {actividad.map((a) => (
                  <div key={a.id} className="flex gap-2">
                    <AvatarComercial nombre={a.actor?.nombre} color={a.actor?.color} size={22} title={a.actor?.nombre ?? undefined} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="truncate text-[12.5px] font-semibold">
                          {nombreYApellido(a.actor?.nombre) || "Comercial"}
                        </span>
                        <span className="shrink-0 text-[11px] text-[var(--text-3)]">{a.cuando}</span>
                      </div>
                      <p className="mt-0.5 rounded-[10px] bg-[var(--surface-soft)] px-2.5 py-1.5 text-[13px] leading-snug">
                        <TextoConMenciones texto={a.texto} equipo={comerciales} />
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <CampoComentario equipo={comerciales} onEnviar={(texto, mencionados) => void guardarNota(texto, mencionados)} />
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 border-t border-[var(--border-soft)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {COLUMNAS_TAREA.filter((c) => c.id !== col).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onMover(tarea.id, item.id)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[var(--input)] bg-white px-3 text-[12.5px] font-medium hover:border-accent hover:text-accent"
            >
              <span className="h-[7px] w-[7px] rounded-full" style={{ background: item.dot }} />
              Mover a {item.label}
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

function CampoVinculo({
  label,
  valor,
  onVer,
  children,
}: {
  label: string;
  valor?: string | null;
  onVer?: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[.07em] text-[var(--label)]">{label}</div>
      {valor && onVer ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onVer();
          }}
          className="mt-1 flex min-h-11 w-full items-center justify-between gap-2 rounded-[9px] bg-accent-soft px-3 text-left text-[13.5px] font-medium text-accent"
        >
          <span className="min-w-0 truncate">{valor}</span>
          <span className="shrink-0 text-[12px]">Ver ficha</span>
        </button>
      ) : null}
      {children}
    </div>
  );
}
