"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { Sheet } from "@/components/ui/sheet";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { VisitContextoCatastro } from "@/components/partes-visita/VisitContextoCatastro";
import {
  contextoCatastralDesdeProperty,
  visitaDesdePropertyExigePropiedad,
  type ContextoCatastralVisita,
} from "@/lib/partes-visita";
import { prefillParteDesdeCita } from "@/lib/citas/citas";

export function NuevoPartePanel({
  open,
  onOpenChange,
  propiedadIdInicial,
  citaIdInicial,
  onCreado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propiedadIdInicial?: string;
  citaIdInicial?: string;
  onCreado: (id: string) => void;
}) {
  const { user } = useAuth();
  const desdeProperty = Boolean(propiedadIdInicial);
  const [propiedades, setPropiedades] = useState<
    Array<{ id: string; referencia: string | null; titulo: string | null; direccion: string | null }>
  >([]);
  const [propiedadId, setPropiedadId] = useState(propiedadIdInicial ?? "");
  const [visitanteNombre, setVisitanteNombre] = useState("");
  const [visitanteDocumento, setVisitanteDocumento] = useState("");
  const [visitanteTelefono, setVisitanteTelefono] = useState("");
  const [visitanteEmail, setVisitanteEmail] = useState("");
  const [inmuebleDireccion, setInmuebleDireccion] = useState("");
  const [inmuebleReferencia, setInmuebleReferencia] = useState("");
  const [fechaVisita, setFechaVisita] = useState(() => new Date().toISOString().slice(0, 10));
  const [horaVisita, setHoraVisita] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  });
  const [agenteNombre, setAgenteNombre] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [estado, setEstado] = useState<"borrador" | "pendiente_firma">("pendiente_firma");
  const [saving, setSaving] = useState(false);
  const [contextoCatastro, setContextoCatastro] = useState<ContextoCatastralVisita>(null);
  const [clienteId, setClienteId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    void supabase
      .from("propiedades")
      .select("id, referencia, titulo, direccion")
      .order("created_at", { ascending: false })
      .then(({ data }) => setPropiedades(data ?? []));
    setPropiedadId(propiedadIdInicial ?? "");
    setVisitanteNombre("");
    setVisitanteDocumento("");
    setVisitanteTelefono("");
    setVisitanteEmail("");
    setInmuebleDireccion("");
    setInmuebleReferencia("");
    setFechaVisita(new Date().toISOString().slice(0, 10));
    const now = new Date();
    setHoraVisita(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
    setObservaciones("");
    setEstado("pendiente_firma");
    setContextoCatastro(null);
    setClienteId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !citaIdInicial) return;
    const supabase = createClient();
    void supabase
      .from("citas")
      .select("id, titulo, empieza, propiedad_id, cliente_id")
      .eq("id", citaIdInicial)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const prefill = prefillParteDesdeCita({
          titulo: data.titulo,
          empieza: data.empieza,
          propiedadId: data.propiedad_id,
        });
        if (prefill.propiedadId) setPropiedadId(prefill.propiedadId);
        setFechaVisita(prefill.fechaVisita);
        setHoraVisita(prefill.horaVisita);
        if (prefill.observaciones) setObservaciones(prefill.observaciones);
        if (data.cliente_id) setClienteId(data.cliente_id);
      });
  }, [open, citaIdInicial]);

  useEffect(() => {
    if (!open || !user?.id) return;
    const supabase = createClient();
    void supabase
      .from("profiles")
      .select("nombre_completo, email")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        const nombre = data?.nombre_completo || data?.email?.split("@")[0] || user.email.split("@")[0];
        setAgenteNombre(nombre ?? "");
      });
  }, [open, user?.id, user?.email]);

  useEffect(() => {
    if (!open || !propiedadId) {
      setContextoCatastro(null);
      return;
    }
    const p = propiedades.find((x) => x.id === propiedadId);
    if (p) {
      if (p.direccion) setInmuebleDireccion(p.direccion);
      if (p.referencia) setInmuebleReferencia(p.referencia);
    }
    const supabase = createClient();
    void supabase
      .from("propiedades")
      .select("id, direccion, referencia, origen, referencia_catastral, catastro_property_links(finca_reference)")
      .eq("id", propiedadId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        if (data.direccion) setInmuebleDireccion(data.direccion);
        if (data.referencia) setInmuebleReferencia(data.referencia);
        const link = Array.isArray(data.catastro_property_links)
          ? data.catastro_property_links[0]
          : data.catastro_property_links;
        setContextoCatastro(
          contextoCatastralDesdeProperty({
            origen: data.origen,
            referenciaCatastral: data.referencia_catastral,
            link: link ? { fincaReference: link.finca_reference } : null,
          })
        );
      });
  }, [open, propiedadId, propiedades]);

  const crear = async () => {
    if (!visitaDesdePropertyExigePropiedad(desdeProperty, propiedadId)) {
      toast.error("Esta visita debe quedar ligada a la propiedad.");
      return;
    }
    if (!inmuebleDireccion.trim()) {
      toast.error("La dirección del inmueble es obligatoria.");
      return;
    }
    if (!agenteNombre.trim()) {
      toast.error("El agente comercial es obligatorio.");
      return;
    }
    const supabase = createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) {
      toast.error("Sesión expirada.");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("partes_visita")
      .insert({
        user_id: authUser.id,
        estado,
        visitante_nombre: visitanteNombre.trim() || null,
        visitante_documento: visitanteDocumento.trim() || null,
        visitante_telefono: visitanteTelefono.trim() || null,
        visitante_email: visitanteEmail.trim() || null,
        inmueble_direccion: inmuebleDireccion.trim(),
        inmueble_referencia: inmuebleReferencia.trim() || null,
        propiedad_id: desdeProperty ? propiedadId : propiedadId || null,
        comercial_id: authUser.id,
        fecha_visita: fechaVisita || null,
        hora_visita: horaVisita || null,
        agente_nombre: agenteNombre.trim(),
        observaciones: observaciones.trim() || null,
        cita_id: citaIdInicial || null,
        cliente_id: clienteId,
      })
      .select("id")
      .single();
    if (!error && data && citaIdInicial) {
      await supabase.from("citas").update({ estado: "hecha" }).eq("id", citaIdInicial);
    }
    setSaving(false);
    if (error || !data) {
      toast.error("No se ha podido crear el parte.");
      return;
    }
    toast.success("Parte de visita creado.");
    onOpenChange(false);
    onCreado(data.id);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} variant="side" side="right" className="min-[780px]:w-[min(52rem,90vw)]">
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2.5 border-b border-[var(--border-soft)] px-5 py-3.5">
          <span className="flex-1 text-[11px] uppercase tracking-[0.08em] text-[var(--label)]">Nuevo parte de visita</span>
          <button type="button" onClick={() => onOpenChange(false)} className="grid h-[34px] w-[34px] place-items-center rounded-lg text-[var(--text-2)]">
            ×
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5 min-[780px]:grid min-[780px]:grid-cols-2 min-[780px]:items-start min-[780px]:gap-x-7 min-[780px]:gap-y-4">
          <div className="flex flex-col gap-4">
            {contextoCatastro ? <VisitContextoCatastro contexto={contextoCatastro} /> : null}
            <label className="block text-[12px] font-semibold text-[var(--text-2)]">
              Inmueble del stock{desdeProperty ? " *" : ""}
              <select
                value={propiedadId}
                onChange={(e) => {
                  if (!desdeProperty) setPropiedadId(e.target.value);
                }}
                disabled={desdeProperty}
                className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] bg-white px-2.5 text-[14px] disabled:bg-[var(--surface-soft)]"
              >
                {desdeProperty ? null : <option value="">Sin ficha (solo dirección)</option>}
                {propiedades.map((p) => (
                  <option key={p.id} value={p.id}>
                    {[p.referencia, p.titulo || p.direccion].filter(Boolean).join(" · ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[12px] font-semibold text-[var(--text-2)]">
              Dirección *
              <input value={inmuebleDireccion} onChange={(e) => setInmuebleDireccion(e.target.value)} className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] px-3 text-[14px]" />
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="block text-[12px] font-semibold text-[var(--text-2)]">
                Referencia
                <input value={inmuebleReferencia} onChange={(e) => setInmuebleReferencia(e.target.value)} className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] px-3 text-[14px]" />
              </label>
              <label className="block text-[12px] font-semibold text-[var(--text-2)]">
                Agente *
                <input value={agenteNombre} onChange={(e) => setAgenteNombre(e.target.value)} className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] px-3 text-[14px]" />
              </label>
              <label className="block text-[12px] font-semibold text-[var(--text-2)]">
                Fecha *
                <input type="date" value={fechaVisita} onChange={(e) => setFechaVisita(e.target.value)} className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] px-3 text-[14px]" />
              </label>
              <label className="block text-[12px] font-semibold text-[var(--text-2)]">
                Hora
                <input type="time" value={horaVisita} onChange={(e) => setHoraVisita(e.target.value)} className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] px-3 text-[14px]" />
              </label>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <section>
              <div className="mb-1.5 text-[12px] font-semibold text-[var(--text-2)]">Visitante</div>
              <label className="block text-[12px] text-[var(--text-2)]">
                Nombre
                <input value={visitanteNombre} onChange={(e) => setVisitanteNombre(e.target.value)} className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] px-3 text-[14px]" />
              </label>
              <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                <label className="block text-[12px] text-[var(--text-2)]">
                  DNI / NIE
                  <input value={visitanteDocumento} onChange={(e) => setVisitanteDocumento(e.target.value)} className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] px-3 text-[14px]" />
                </label>
                <label className="block text-[12px] text-[var(--text-2)]">
                  Teléfono
                  <input value={visitanteTelefono} onChange={(e) => setVisitanteTelefono(e.target.value)} className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] px-3 text-[14px]" />
                </label>
              </div>
              <label className="mt-2.5 block text-[12px] text-[var(--text-2)]">
                Email
                <input type="email" value={visitanteEmail} onChange={(e) => setVisitanteEmail(e.target.value)} className="mt-1.5 h-10 w-full rounded-[9px] border border-[var(--input)] px-3 text-[14px]" />
              </label>
            </section>
            <label className="block text-[12px] font-semibold text-[var(--text-2)]">
              Observaciones
              <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={3} className="mt-1.5 w-full resize-none rounded-[9px] border border-[var(--input)] px-3 py-2 text-[14px]" />
            </label>
            <section>
              <div className="mb-1.5 text-[12px] font-semibold text-[var(--text-2)]">Estado</div>
              <div className="flex flex-wrap gap-1.5">
                <ToggleChip on={estado === "pendiente_firma"} onClick={() => setEstado("pendiente_firma")}>
                  Pendiente de firma
                </ToggleChip>
                <ToggleChip on={estado === "borrador"} onClick={() => setEstado("borrador")}>
                  Borrador
                </ToggleChip>
              </div>
            </section>
          </div>
        </div>
        <div className="flex gap-2 border-t border-[var(--border-soft)] px-5 py-3">
          <button type="button" disabled={saving} onClick={() => void crear()} className="h-10 flex-1 rounded-[9px] bg-accent text-[13.5px] font-semibold text-white disabled:opacity-60">
            {saving ? "Guardando…" : "Crear parte"}
          </button>
          <button type="button" onClick={() => onOpenChange(false)} className="h-10 rounded-[9px] border border-[var(--input)] px-3.5 text-[13.5px] font-semibold">
            Cancelar
          </button>
        </div>
      </div>
    </Sheet>
  );
}
