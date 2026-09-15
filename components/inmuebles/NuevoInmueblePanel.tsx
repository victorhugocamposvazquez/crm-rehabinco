"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { AltaExtra, AltaField, AltaPersona, AltaSection, AltaShell, altaControl, type PersonaOpcion } from "@/components/ui/alta-form";
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
  const [clientes, setClientes] = useState<PersonaOpcion[]>([]);
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
      .then(({ data }) => setClientes((data ?? []) as PersonaOpcion[]));
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
    if (!q) return [];
    return clientes.filter((c) => `${c.nombre} ${c.telefono ?? ""}`.toLowerCase().includes(q)).slice(0, 6);
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
    <AltaShell
      open={open}
      onOpenChange={onOpenChange}
      title="Nuevo inmueble"
      hint="Con título o dirección basta. Fotos, catastro y el resto se completan en la ficha."
      primaryLabel="Crear inmueble"
      saving={saving}
      disablePrimary={!values.titulo.trim() && !values.direccion.trim()}
      onSubmit={crear}
    >
      <AltaSection wide title="Propietario" hint="Puedes dejarlo sin asignar y ligarlo después.">
        <AltaPersona
          fijo={ofertanteFijo}
          fijoNombre={ofertanteNombre}
          modoNuevo={nuevoPropietario}
          setModoNuevo={setNuevoPropietario}
          permitirNinguno
          seleccionado={clienteSel}
          onSeleccionar={(persona) => set({ ofertante_id: persona.id })}
          onLimpiar={() => set({ ofertante_id: "" })}
          q={qCliente}
          setQ={setQCliente}
          sugeridos={sugeridos}
          nombreNuevo={nombreNuevo}
          setNombreNuevo={setNombreNuevo}
          telefonoNuevo={telefonoNuevo}
          setTelefonoNuevo={setTelefonoNuevo}
          autoFocus={!ofertanteFijo}
        />
      </AltaSection>

      <AltaSection title="Qué es" hint="Operación y tipo. El título es lo que verás en el listado.">
        <div className="flex flex-col gap-5">
          <div>
            <div className="mb-2.5 text-[12.5px] font-semibold text-[var(--text-2)]">Operación</div>
            <div className="flex flex-wrap gap-2">
              {TIPOS_OPERACION.map((op) => (
                <ToggleChip key={op} on={values.tipo_operacion === op} onClick={() => set({ tipo_operacion: op })}>
                  {TIPO_OPERACION_LABEL[op]}
                </ToggleChip>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2.5 text-[12.5px] font-semibold text-[var(--text-2)]">Tipo</div>
            <div className="flex flex-wrap gap-2">
              {TIPOS_INMUEBLE.map((tipo) => (
                <ToggleChip key={tipo} on={values.tipo_inmueble === tipo} onClick={() => set({ tipo_inmueble: tipo })}>
                  {TIPO_INMUEBLE_LABEL[tipo]}
                </ToggleChip>
              ))}
            </div>
          </div>
          <AltaField label="Título">
            <input
              autoFocus={ofertanteFijo}
              value={values.titulo}
              onChange={(e) => set({ titulo: e.target.value })}
              placeholder="Piso 3 hab. reforma, Oleiros"
              className={altaControl}
            />
          </AltaField>
        </div>
      </AltaSection>

      <AltaSection title="Dónde" hint="La dirección es la que usa el parte de visita y el matching.">
        <div className="flex flex-col gap-5">
          <AltaField label="Dirección">
            <input value={values.direccion} onChange={(e) => set({ direccion: e.target.value })} placeholder="Calle, número, piso" className={altaControl} />
          </AltaField>
          <div>
            <div className="mb-2.5 text-[12.5px] font-semibold text-[var(--text-2)]">Localidad</div>
            <div className="flex flex-wrap gap-2">
              {ZONAS_DEMANDA.map((zona) => (
                <ToggleChip key={zona} on={values.localidad === zona} onClick={() => set({ localidad: values.localidad === zona ? "" : zona })}>
                  {zona}
                </ToggleChip>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <input value={values.localidad} onChange={(e) => set({ localidad: e.target.value })} placeholder="Otra localidad" className={`${altaControl} mt-0`} />
              <input value={values.codigo_postal} onChange={(e) => set({ codigo_postal: e.target.value })} placeholder="CP" className={`${altaControl} mt-0`} />
            </div>
          </div>
        </div>
      </AltaSection>

      <AltaSection title="Precio y tamaño" hint="Lo mínimo para comparar con demandas.">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3">
            {values.tipo_operacion !== "alquiler" ? (
              <AltaField label="Venta €" optional>
                <input value={values.precio_venta} onChange={(e) => set({ precio_venta: e.target.value })} inputMode="numeric" className={altaControl} />
              </AltaField>
            ) : null}
            {values.tipo_operacion !== "venta" ? (
              <AltaField label="Alquiler €/mes" optional>
                <input value={values.precio_alquiler} onChange={(e) => set({ precio_alquiler: e.target.value })} inputMode="numeric" className={altaControl} />
              </AltaField>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <AltaField label="m²" optional>
              <input value={values.superficie_m2} onChange={(e) => set({ superficie_m2: e.target.value, superficie_construida: e.target.value })} inputMode="numeric" className={altaControl} />
            </AltaField>
            <AltaField label="Habitaciones" optional>
              <input value={values.habitaciones} onChange={(e) => set({ habitaciones: e.target.value })} inputMode="numeric" className={altaControl} />
            </AltaField>
            <AltaField label="Baños" optional>
              <input value={values.banos} onChange={(e) => set({ banos: e.target.value })} inputMode="numeric" className={altaControl} />
            </AltaField>
            <AltaField label="Estado">
              <select value={values.estado} onChange={(e) => set({ estado: e.target.value as InmuebleFormValues["estado"] })} className={altaControl}>
                {ESTADOS_INMUEBLE.map((estado) => (
                  <option key={estado} value={estado}>
                    {ESTADO_INMUEBLE_LABEL[estado]}
                  </option>
                ))}
              </select>
            </AltaField>
          </div>
          <label className="flex items-center justify-between gap-3 rounded-[12px] border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3.5">
            <span>
              <span className="block text-[14px] font-semibold">Listo para matching</span>
              <span className="text-[12.5px] text-[var(--text-2)]">Visible internamente, no en portales</span>
            </span>
            <input type="checkbox" checked={values.publicado} onChange={(e) => set({ publicado: e.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />
          </label>
        </div>
      </AltaSection>

      <AltaExtra label="Notas internas">
        <AltaField label="Notas" optional>
          <textarea value={values.notas} onChange={(e) => set({ notas: e.target.value })} rows={3} className={`${altaControl} h-auto min-h-[5.5rem] resize-none py-2.5`} />
        </AltaField>
      </AltaExtra>
    </AltaShell>
  );
}
