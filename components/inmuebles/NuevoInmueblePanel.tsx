"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Sheet } from "@/components/ui/sheet";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { cn } from "@/lib/utils";
import {
  ESTADOS_INMUEBLE,
  ESTADO_INMUEBLE_LABEL,
  INMUEBLE_FORM_VACIO,
  TIPOS_INMUEBLE,
  TIPOS_OPERACION,
  TIPO_INMUEBLE_LABEL,
  TIPO_OPERACION_LABEL,
  inmuebleDesdeForm,
  type InmuebleFormValues,
} from "@/lib/inmuebles/catalogo";
import { ZONAS_DEMANDA } from "@/lib/demandas/nueva";

type ClienteOpcion = { id: string; nombre: string; telefono: string | null };

export function NuevoInmueblePanel({
  open,
  onOpenChange,
  ofertanteIdInicial,
  ofertanteNombre,
  onCreado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ofertanteIdInicial?: string;
  ofertanteNombre?: string;
  onCreado: (id: string) => void;
}) {
  const ofertanteFijo = Boolean(ofertanteIdInicial);
  const [clientes, setClientes] = useState<ClienteOpcion[]>([]);
  const [qCliente, setQCliente] = useState("");
  const [nuevoPropietario, setNuevoPropietario] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [telefonoNuevo, setTelefonoNuevo] = useState("");
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<InmuebleFormValues>({
    ...INMUEBLE_FORM_VACIO,
    ofertante_id: ofertanteIdInicial ?? "",
  });

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    void supabase
      .from("clientes")
      .select("id, nombre, telefono")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => setClientes((data ?? []) as ClienteOpcion[]));
    setValues({ ...INMUEBLE_FORM_VACIO, ofertante_id: ofertanteIdInicial ?? "" });
    setQCliente("");
    setNuevoPropietario(false);
    setNombreNuevo("");
    setTelefonoNuevo("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (patch: Partial<InmuebleFormValues>) => setValues((v) => ({ ...v, ...patch }));
  const clienteSel = clientes.find((c) => c.id === values.ofertante_id);
  const sugeridos = useMemo(() => {
    const q = qCliente.trim().toLowerCase();
    if (!q) return clientes.slice(0, 8);
    return clientes.filter((c) => `${c.nombre} ${c.telefono ?? ""}`.toLowerCase().includes(q)).slice(0, 8);
  }, [clientes, qCliente]);

  const crear = async () => {
    if (!values.titulo.trim() && !values.direccion.trim()) {
      toast.error("Pon un título o una dirección.");
      return;
    }
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sesión expirada.");
      return;
    }
    let ofertanteId = values.ofertante_id;
    if (!ofertanteId && nuevoPropietario) {
      const nombre = nombreNuevo.trim();
      if (!nombre) {
        toast.error("El propietario necesita un nombre.");
        return;
      }
      const { data, error } = await supabase
        .from("clientes")
        .insert({
          user_id: user.id,
          nombre,
          telefono: telefonoNuevo.trim() || null,
          tipo_cliente: "particular",
          localidad: values.localidad.trim() || null,
        })
        .select("id")
        .single();
      if (error || !data) {
        toast.error("No se ha podido crear el propietario.");
        return;
      }
      ofertanteId = data.id;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("propiedades")
      .insert({
        user_id: user.id,
        comercial_id: user.id,
        ...inmuebleDesdeForm({ ...values, ofertante_id: ofertanteId }),
      })
      .select("id")
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error("No se ha podido crear el inmueble.");
      return;
    }
    toast.success("Inmueble creado.");
    onOpenChange(false);
    onCreado(data.id);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} variant="side" side="right" className="min-[780px]:w-[min(52rem,90vw)]">
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2.5 border-b border-[var(--border-soft)] px-5 py-3.5">
          <span className="flex-1 text-[11px] uppercase tracking-[0.08em] text-[var(--label)]">Nuevo inmueble</span>
          <button type="button" onClick={() => onOpenChange(false)} className="grid h-[34px] w-[34px] place-items-center rounded-lg text-[var(--text-2)]">
            ×
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5 min-[780px]:grid min-[780px]:grid-cols-2 min-[780px]:items-start min-[780px]:gap-x-7 min-[780px]:gap-y-4">
          <section className="min-[780px]:col-span-2">
            <div className="mb-1.5 text-[12px] font-semibold text-[var(--text-2)]">Propietario</div>
            {ofertanteFijo ? (
              <div className="rounded-[9px] border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5 text-[14px] font-semibold">
                {ofertanteNombre || clienteSel?.nombre || "Cliente"}
              </div>
            ) : (
              <>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => setNuevoPropietario(false)} className={cn("h-8 rounded-full border px-2.5 text-[12.5px] font-medium", !nuevoPropietario ? "border-accent bg-accent-soft text-accent-dark" : "border-[var(--border)] text-[var(--text-2)]")}>
                    Existente
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNuevoPropietario(true);
                      set({ ofertante_id: "" });
                    }}
                    className={cn("h-8 rounded-full border px-2.5 text-[12.5px] font-medium", nuevoPropietario ? "border-accent bg-accent-soft text-accent-dark" : "border-[var(--border)] text-[var(--text-2)]")}
                  >
                    Nuevo
                  </button>
                  <button type="button" onClick={() => { setNuevoPropietario(false); set({ ofertante_id: "" }); }} className="h-8 text-[12.5px] font-medium text-[var(--text-2)]">
                    Sin propietario
                  </button>
                </div>
                {nuevoPropietario ? (
                  <div className="mt-2 grid grid-cols-1 gap-2.5 min-[780px]:grid-cols-2">
                    <label className="block text-[12px] font-semibold text-[var(--text-2)]">
                      Nombre
                      <input value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)} className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] px-3 text-[14px]" />
                    </label>
                    <label className="block text-[12px] font-semibold text-[var(--text-2)]">
                      Teléfono
                      <input value={telefonoNuevo} onChange={(e) => setTelefonoNuevo(e.target.value)} className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] px-3 text-[14px]" />
                    </label>
                  </div>
                ) : clienteSel ? (
                  <div className="mt-2 flex items-center justify-between rounded-[9px] border border-accent bg-accent-soft px-3 py-2">
                    <div>
                      <div className="text-[14px] font-semibold">{clienteSel.nombre}</div>
                      {clienteSel.telefono ? <div className="text-[12px] text-[var(--text-2)]">{clienteSel.telefono}</div> : null}
                    </div>
                    <button type="button" onClick={() => set({ ofertante_id: "" })} className="text-[12.5px] font-semibold text-accent">
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <div className="mt-2">
                    <input value={qCliente} onChange={(e) => setQCliente(e.target.value)} placeholder="Buscar por nombre o teléfono" className="h-10 w-full rounded-[9px] border border-[var(--input)] px-3 text-[14px]" />
                    <div className="mt-1.5 max-h-28 overflow-y-auto rounded-[9px] border border-[var(--border)]">
                      {sugeridos.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            set({ ofertante_id: c.id });
                            setQCliente("");
                          }}
                          className="flex w-full items-center justify-between gap-2 border-b border-[var(--border-soft)] px-3 py-2 text-left last:border-0 hover:bg-[var(--surface-soft)]"
                        >
                          <span className="truncate text-[13.5px] font-medium">{c.nombre}</span>
                          <span className="shrink-0 font-mono text-[11.5px] text-[var(--text-2)]">{c.telefono || ""}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          <div className="flex flex-col gap-4">
            <section>
              <div className="mb-1.5 text-[12px] font-semibold text-[var(--text-2)]">Operación</div>
              <div className="flex flex-wrap gap-1.5">
                {TIPOS_OPERACION.map((op) => (
                  <ToggleChip key={op} on={values.tipo_operacion === op} onClick={() => set({ tipo_operacion: op })}>
                    {TIPO_OPERACION_LABEL[op]}
                  </ToggleChip>
                ))}
              </div>
            </section>
            <section>
              <div className="mb-1.5 text-[12px] font-semibold text-[var(--text-2)]">Tipo</div>
              <div className="flex flex-wrap gap-1.5">
                {TIPOS_INMUEBLE.map((tipo) => (
                  <ToggleChip key={tipo} on={values.tipo_inmueble === tipo} onClick={() => set({ tipo_inmueble: tipo })}>
                    {TIPO_INMUEBLE_LABEL[tipo]}
                  </ToggleChip>
                ))}
              </div>
            </section>
            <label className="block text-[12px] font-semibold text-[var(--text-2)]">
              Título
              <input value={values.titulo} onChange={(e) => set({ titulo: e.target.value })} placeholder="Piso 3 hab. reforma, Oleiros" className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] px-3 text-[14px]" />
            </label>
            <label className="block text-[12px] font-semibold text-[var(--text-2)]">
              Dirección
              <input value={values.direccion} onChange={(e) => set({ direccion: e.target.value })} placeholder="Calle, número, piso" className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] px-3 text-[14px]" />
            </label>
            <section>
              <div className="mb-1.5 text-[12px] font-semibold text-[var(--text-2)]">Localidad</div>
              <div className="flex flex-wrap gap-1.5">
                {ZONAS_DEMANDA.map((zona) => (
                  <ToggleChip key={zona} on={values.localidad === zona} onClick={() => set({ localidad: values.localidad === zona ? "" : zona })}>
                    {zona}
                  </ToggleChip>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2.5">
                <input value={values.localidad} onChange={(e) => set({ localidad: e.target.value })} placeholder="Otra localidad" className="h-10 rounded-[9px] border border-[var(--input)] px-3 text-[14px]" />
                <input value={values.codigo_postal} onChange={(e) => set({ codigo_postal: e.target.value })} placeholder="CP" className="h-10 rounded-[9px] border border-[var(--input)] px-3 text-[14px]" />
              </div>
            </section>
          </div>

          <div className="flex flex-col gap-4">
            <section>
              <div className="mb-1.5 text-[12px] font-semibold text-[var(--text-2)]">Precio</div>
              <div className="grid grid-cols-2 gap-2.5">
                {values.tipo_operacion !== "alquiler" ? (
                  <label className="block text-[12px] text-[var(--text-2)]">
                    Venta €
                    <input value={values.precio_venta} onChange={(e) => set({ precio_venta: e.target.value })} inputMode="numeric" className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] px-3 text-[14px] tabular-nums" />
                  </label>
                ) : null}
                {values.tipo_operacion !== "venta" ? (
                  <label className="block text-[12px] text-[var(--text-2)]">
                    Alquiler €/mes
                    <input value={values.precio_alquiler} onChange={(e) => set({ precio_alquiler: e.target.value })} inputMode="numeric" className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] px-3 text-[14px] tabular-nums" />
                  </label>
                ) : null}
              </div>
            </section>
            <section>
              <div className="mb-1.5 text-[12px] font-semibold text-[var(--text-2)]">Tamaño</div>
              <div className="grid grid-cols-2 gap-2.5">
                <label className="block text-[12px] text-[var(--text-2)]">
                  m²
                  <input value={values.superficie_m2} onChange={(e) => set({ superficie_m2: e.target.value, superficie_construida: e.target.value })} inputMode="numeric" className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] px-3 text-[14px] tabular-nums" />
                </label>
                <label className="block text-[12px] text-[var(--text-2)]">
                  Hab.
                  <input value={values.habitaciones} onChange={(e) => set({ habitaciones: e.target.value })} inputMode="numeric" className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] px-3 text-[14px] tabular-nums" />
                </label>
                <label className="block text-[12px] text-[var(--text-2)]">
                  Baños
                  <input value={values.banos} onChange={(e) => set({ banos: e.target.value })} inputMode="numeric" className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] px-3 text-[14px] tabular-nums" />
                </label>
                <label className="block text-[12px] text-[var(--text-2)]">
                  Estado
                  <select value={values.estado} onChange={(e) => set({ estado: e.target.value as InmuebleFormValues["estado"] })} className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] bg-white px-2.5 text-[14px]">
                    {ESTADOS_INMUEBLE.map((estado) => (
                      <option key={estado} value={estado}>
                        {ESTADO_INMUEBLE_LABEL[estado]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>
            <label className="flex items-center justify-between gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5">
              <span>
                <span className="block text-[13.5px] font-semibold">Listo para matching</span>
                <span className="text-[12px] text-[var(--text-2)]">Publicado internamente</span>
              </span>
              <input type="checkbox" checked={values.publicado} onChange={(e) => set({ publicado: e.target.checked })} className="h-4 w-4" />
            </label>
            <label className="block text-[12px] font-semibold text-[var(--text-2)]">
              Notas internas
              <textarea value={values.notas} onChange={(e) => set({ notas: e.target.value })} rows={2} className="mt-1.5 w-full resize-none rounded-[9px] border border-[var(--input)] px-3 py-2 text-[14px]" />
            </label>
          </div>
        </div>
        <div className="flex gap-2 border-t border-[var(--border-soft)] px-5 py-3">
          <button type="button" disabled={saving} onClick={() => void crear()} className="h-10 flex-1 rounded-[9px] bg-accent text-[13.5px] font-semibold text-white disabled:opacity-60">
            {saving ? "Guardando…" : "Crear inmueble"}
          </button>
          <button type="button" onClick={() => onOpenChange(false)} className="h-10 rounded-[9px] border border-[var(--input)] px-3.5 text-[13.5px] font-semibold">
            Cancelar
          </button>
        </div>
      </div>
    </Sheet>
  );
}
