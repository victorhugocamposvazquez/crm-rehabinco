"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { isAdmin } from "@/lib/auth/roles";
import { Sheet } from "@/components/ui/sheet";
import { AvatarComercial } from "@/components/ui/avatar-comercial";
import { nombreYApellido } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";
import { TIPOS_INMUEBLE, TIPO_INMUEBLE_LABEL } from "@/lib/inmuebles/catalogo";
import { TIPOS_OPERACION_DEMANDA, TIPO_OPERACION_DEMANDA_LABEL } from "@/lib/demandas/matching";
import {
  ORIGENES_DEMANDA,
  REQUISITOS_RAPIDOS,
  ZONAS_DEMANDA,
  payloadNuevaDemanda,
  validarNuevaDemanda,
  type BorradorNuevaDemanda,
} from "@/lib/demandas/nueva";
import type { ComercialFiltro } from "@/components/captacion/FiltroComercial";

type ClienteOpcion = { id: string; nombre: string; telefono: string | null };

const BORRADOR_VACIO: Omit<BorradorNuevaDemanda, "comercialId"> = {
  clienteId: "",
  tipoOperacion: "compra",
  tiposInmueble: ["piso"],
  zonas: [],
  presupuestoMin: "",
  presupuestoMax: "",
  superficieMin: "",
  superficieMax: "",
  habitacionesMin: "",
  banosMin: "",
  requisitos: "",
  requisitosRapidos: [],
  origen: "llamada",
};

function Chip({
  on,
  children,
  onClick,
}: {
  on: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-8 items-center rounded-full border px-2.5 text-[12.5px] font-medium",
        on ? "border-accent bg-accent-soft text-accent-dark" : "border-[var(--border)] bg-white text-[var(--text-2)]"
      )}
    >
      {children}
    </button>
  );
}

export function NuevaDemandaPanel({
  open,
  onOpenChange,
  clienteIdInicial,
  clienteNombre,
  onCreada,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteIdInicial?: string;
  clienteNombre?: string;
  onCreada: (id: string) => void;
}) {
  const { user } = useAuth();
  const admin = isAdmin(user?.role);
  const clienteFijo = Boolean(clienteIdInicial);
  const [clientes, setClientes] = useState<ClienteOpcion[]>([]);
  const [comerciales, setComerciales] = useState<ComercialFiltro[]>([]);
  const [qCliente, setQCliente] = useState("");
  const [nuevoCliente, setNuevoCliente] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [telefonoNuevo, setTelefonoNuevo] = useState("");
  const [zonaExtra, setZonaExtra] = useState("");
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<BorradorNuevaDemanda>({
    ...BORRADOR_VACIO,
    comercialId: user?.id ?? "",
  });

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    void Promise.all([
      supabase.from("clientes").select("id, nombre, telefono").eq("activo", true).order("nombre"),
      supabase.from("profiles").select("id, nombre_completo, color, email, role").eq("activo", true),
    ]).then(([cli, com]) => {
      setClientes((cli.data ?? []) as ClienteOpcion[]);
      setComerciales(
        ((com.data ?? []) as Array<{ id: string; nombre_completo: string | null; color: string | null; email: string | null; role: string }>)
          .filter((row) => row.role !== "editor")
          .map((row) => ({
            id: row.id,
            nombre: nombreYApellido(row.nombre_completo, row.email) || row.email || "—",
            color: row.color,
          }))
      );
    });
    setDraft({
      ...BORRADOR_VACIO,
      clienteId: clienteIdInicial ?? "",
      comercialId: user?.id ?? "",
    });
    setQCliente("");
    setNuevoCliente(false);
    setNombreNuevo("");
    setTelefonoNuevo("");
    setZonaExtra("");
    // Al abrir se parte de cliente y usuario de este render; no resetear si hidrata el auth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const clienteSel = clientes.find((c) => c.id === draft.clienteId);
  const sugeridos = useMemo(() => {
    const q = qCliente.trim().toLowerCase();
    if (!q) return clientes.slice(0, 8);
    return clientes
      .filter((c) => `${c.nombre} ${c.telefono ?? ""}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [clientes, qCliente]);

  const set = <K extends keyof BorradorNuevaDemanda>(key: K, value: BorradorNuevaDemanda[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const toggleLista = (key: "tiposInmueble" | "zonas" | "requisitosRapidos", valor: string) => {
    setDraft((prev) => {
      const lista = prev[key];
      return { ...prev, [key]: lista.includes(valor) ? lista.filter((item) => item !== valor) : [...lista, valor] };
    });
  };

  const addZonaExtra = () => {
    const zona = zonaExtra.trim();
    if (!zona) return;
    setDraft((prev) => ({ ...prev, zonas: prev.zonas.includes(zona) ? prev.zonas : [...prev.zonas, zona] }));
    setZonaExtra("");
  };

  const crear = async () => {
    if (!user) return;
    let clienteId = draft.clienteId;
    const supabase = createClient();
    if (!clienteId) {
      const nombre = nombreNuevo.trim();
      if (!nombre) {
        toast.error("Elige o crea un cliente.");
        return;
      }
      const { data, error } = await supabase
        .from("clientes")
        .insert({
          user_id: user.id,
          nombre,
          telefono: telefonoNuevo.trim() || null,
          tipo_cliente: "particular",
          localidad: draft.zonas[0] ?? null,
        })
        .select("id")
        .single();
      if (error || !data) {
        toast.error("No se ha podido crear el cliente.");
        return;
      }
      clienteId = data.id;
    }
    const borrador = { ...draft, clienteId, comercialId: draft.comercialId || user.id };
    const fallo = validarNuevaDemanda(borrador);
    if (fallo) {
      toast.error(fallo);
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.from("demandas").insert(payloadNuevaDemanda(borrador)).select("id").single();
    setSaving(false);
    if (error || !data) {
      toast.error("No se ha podido crear la demanda.");
      return;
    }
    toast.success("Demanda creada.");
    onOpenChange(false);
    onCreada(data.id);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} variant="side" side="right" className="min-[780px]:w-[min(32rem,92vw)]">
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2.5 border-b border-[var(--border-soft)] px-4 py-3.5">
          <span className="flex-1 text-[11px] uppercase tracking-[0.08em] text-[var(--label)]">Nueva demanda</span>
          <button type="button" onClick={() => onOpenChange(false)} className="grid h-[34px] w-[34px] place-items-center rounded-lg text-[var(--text-2)]">
            ×
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          <section>
            <div className="mb-1.5 text-[12px] font-semibold text-[var(--text-2)]">Cliente</div>
            {clienteFijo ? (
              <div className="rounded-[9px] border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5 text-[14px] font-semibold">
                {clienteNombre || clienteSel?.nombre || "Cliente"}
              </div>
            ) : (
              <>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setNuevoCliente(false)}
                    className={cn("h-8 rounded-full border px-2.5 text-[12.5px] font-medium", !nuevoCliente ? "border-accent bg-accent-soft text-accent-dark" : "border-[var(--border)] text-[var(--text-2)]")}
                  >
                    Existente
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNuevoCliente(true);
                      set("clienteId", "");
                    }}
                    className={cn("h-8 rounded-full border px-2.5 text-[12.5px] font-medium", nuevoCliente ? "border-accent bg-accent-soft text-accent-dark" : "border-[var(--border)] text-[var(--text-2)]")}
                  >
                    Nuevo
                  </button>
                </div>
                {nuevoCliente ? (
                  <div className="mt-2 grid grid-cols-2 gap-2.5">
                    <label className="col-span-2 block text-[12px] font-semibold text-[var(--text-2)]">
                      Nombre
                      <input value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)} placeholder="María López" className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] px-3 text-[14px]" />
                    </label>
                    <label className="col-span-2 block text-[12px] font-semibold text-[var(--text-2)]">
                      Teléfono
                      <input value={telefonoNuevo} onChange={(e) => setTelefonoNuevo(e.target.value)} placeholder="600 000 000" className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] px-3 text-[14px]" />
                    </label>
                  </div>
                ) : (
                  <div className="mt-2">
                    {clienteSel ? (
                      <div className="flex items-center justify-between rounded-[9px] border border-accent bg-accent-soft px-3 py-2">
                        <div>
                          <div className="text-[14px] font-semibold">{clienteSel.nombre}</div>
                          {clienteSel.telefono ? <div className="text-[12px] text-[var(--text-2)]">{clienteSel.telefono}</div> : null}
                        </div>
                        <button type="button" onClick={() => set("clienteId", "")} className="text-[12.5px] font-semibold text-accent">
                          Cambiar
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          value={qCliente}
                          onChange={(e) => setQCliente(e.target.value)}
                          placeholder="Buscar por nombre o teléfono"
                          className="h-10 w-full rounded-[9px] border border-[var(--input)] px-3 text-[14px]"
                        />
                        <div className="mt-1.5 max-h-44 overflow-y-auto rounded-[9px] border border-[var(--border)]">
                          {sugeridos.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                set("clienteId", c.id);
                                setQCliente("");
                              }}
                              className="flex w-full items-center justify-between gap-2 border-b border-[var(--border-soft)] px-3 py-2 text-left last:border-0 hover:bg-[var(--surface-soft)]"
                            >
                              <span className="truncate text-[13.5px] font-medium">{c.nombre}</span>
                              <span className="shrink-0 font-mono text-[11.5px] text-[var(--text-2)]">{c.telefono || ""}</span>
                            </button>
                          ))}
                          {sugeridos.length === 0 ? (
                            <div className="px-3 py-2.5 text-[12.5px] text-[var(--text-2)]">
                              Sin coincidencias.{" "}
                              <button
                                type="button"
                                className="font-semibold text-accent"
                                onClick={() => {
                                  setNuevoCliente(true);
                                  setNombreNuevo(qCliente);
                                }}
                              >
                                Crear cliente
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </section>

          <section>
            <div className="mb-1.5 text-[12px] font-semibold text-[var(--text-2)]">Operación</div>
            <div className="flex flex-wrap gap-1.5">
              {TIPOS_OPERACION_DEMANDA.map((op) => (
                <Chip key={op} on={draft.tipoOperacion === op} onClick={() => set("tipoOperacion", op)}>
                  {TIPO_OPERACION_DEMANDA_LABEL[op]}
                </Chip>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-1.5 text-[12px] font-semibold text-[var(--text-2)]">Tipo de inmueble</div>
            <div className="flex flex-wrap gap-1.5">
              {TIPOS_INMUEBLE.map((tipo) => (
                <Chip key={tipo} on={draft.tiposInmueble.includes(tipo)} onClick={() => toggleLista("tiposInmueble", tipo)}>
                  {TIPO_INMUEBLE_LABEL[tipo]}
                </Chip>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-1.5 text-[12px] font-semibold text-[var(--text-2)]">Zonas</div>
            <div className="flex flex-wrap gap-1.5">
              {ZONAS_DEMANDA.map((zona) => (
                <Chip key={zona} on={draft.zonas.includes(zona)} onClick={() => toggleLista("zonas", zona)}>
                  {zona}
                </Chip>
              ))}
              {draft.zonas.filter((z) => !(ZONAS_DEMANDA as readonly string[]).includes(z)).map((zona) => (
                <Chip key={zona} on onClick={() => toggleLista("zonas", zona)}>
                  {zona}
                </Chip>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={zonaExtra}
                onChange={(e) => setZonaExtra(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addZonaExtra();
                  }
                }}
                placeholder="Otra zona o CP"
                className="h-10 flex-1 rounded-[9px] border border-[var(--input)] px-3 text-[14px]"
              />
              <button type="button" onClick={addZonaExtra} className="h-10 rounded-[9px] border border-[var(--input)] px-3 text-[13px] font-semibold">
                Añadir
              </button>
            </div>
          </section>

          <section>
            <div className="mb-1.5 text-[12px] font-semibold text-[var(--text-2)]">
              Presupuesto {draft.tipoOperacion === "alquiler" ? "€/mes" : "€"}
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="block text-[12px] text-[var(--text-2)]">
                Mínimo
                <input value={draft.presupuestoMin} onChange={(e) => set("presupuestoMin", e.target.value)} inputMode="numeric" placeholder="—" className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] px-3 text-[14px] tabular-nums" />
              </label>
              <label className="block text-[12px] text-[var(--text-2)]">
                Máximo
                <input value={draft.presupuestoMax} onChange={(e) => set("presupuestoMax", e.target.value)} inputMode="numeric" placeholder="Hasta" className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] px-3 text-[14px] tabular-nums" />
              </label>
            </div>
          </section>

          <section>
            <div className="mb-1.5 text-[12px] font-semibold text-[var(--text-2)]">Tamaño</div>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="block text-[12px] text-[var(--text-2)]">
                m² mín.
                <input value={draft.superficieMin} onChange={(e) => set("superficieMin", e.target.value)} inputMode="numeric" className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] px-3 text-[14px] tabular-nums" />
              </label>
              <label className="block text-[12px] text-[var(--text-2)]">
                m² máx.
                <input value={draft.superficieMax} onChange={(e) => set("superficieMax", e.target.value)} inputMode="numeric" className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] px-3 text-[14px] tabular-nums" />
              </label>
              <label className="block text-[12px] text-[var(--text-2)]">
                Hab. mín.
                <input value={draft.habitacionesMin} onChange={(e) => set("habitacionesMin", e.target.value)} inputMode="numeric" className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] px-3 text-[14px] tabular-nums" />
              </label>
              <label className="block text-[12px] text-[var(--text-2)]">
                Baños mín.
                <input value={draft.banosMin} onChange={(e) => set("banosMin", e.target.value)} inputMode="numeric" className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] px-3 text-[14px] tabular-nums" />
              </label>
            </div>
          </section>

          <section>
            <div className="mb-1.5 text-[12px] font-semibold text-[var(--text-2)]">Imprescindible</div>
            <div className="flex flex-wrap gap-1.5">
              {REQUISITOS_RAPIDOS.map((item) => (
                <Chip key={item} on={draft.requisitosRapidos.includes(item)} onClick={() => toggleLista("requisitosRapidos", item)}>
                  {item}
                </Chip>
              ))}
            </div>
            <textarea
              value={draft.requisitos}
              onChange={(e) => set("requisitos", e.target.value)}
              placeholder="Orientación, reforma, colegios, planta baja…"
              rows={3}
              className="mt-2 w-full resize-none rounded-[9px] border border-[var(--input)] px-3 py-2 text-[14px]"
            />
          </section>

          <section>
            <div className="mb-1.5 text-[12px] font-semibold text-[var(--text-2)]">Origen</div>
            <div className="flex flex-wrap gap-1.5">
              {ORIGENES_DEMANDA.map((item) => (
                <Chip key={item.id} on={draft.origen === item.id} onClick={() => set("origen", item.id)}>
                  {item.label}
                </Chip>
              ))}
            </div>
          </section>

          {admin ? (
            <section>
              <div className="mb-1.5 text-[12px] font-semibold text-[var(--text-2)]">Comercial</div>
              <div className="flex flex-wrap gap-1.5">
                {comerciales.map((c) => {
                  const on = draft.comercialId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => set("comercialId", c.id)}
                      className={cn("flex h-8 items-center gap-1.5 rounded-full border pr-2.5 pl-1 text-[12.5px] font-medium", on ? "border-accent bg-accent-soft" : "border-[var(--border)] bg-white text-[var(--text-2)]")}
                    >
                      <AvatarComercial nombre={c.nombre} color={c.color} size={24} />
                      {c.nombre.split(" ")[0]}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
        <div className="flex gap-2 border-t border-[var(--border-soft)] px-4 py-3">
          <button type="button" disabled={saving} onClick={() => void crear()} className="h-10 flex-1 rounded-[9px] bg-accent text-[13.5px] font-semibold text-white disabled:opacity-60">
            {saving ? "Guardando…" : "Crear demanda"}
          </button>
          <button type="button" onClick={() => onOpenChange(false)} className="h-10 rounded-[9px] border border-[var(--input)] px-3.5 text-[13.5px] font-semibold">
            Cancelar
          </button>
        </div>
      </div>
    </Sheet>
  );
}
