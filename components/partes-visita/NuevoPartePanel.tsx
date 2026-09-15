"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { AltaExtra, AltaField, AltaSection, AltaShell, altaControl } from "@/components/ui/alta-form";
import { VisitContextoCatastro } from "@/components/partes-visita/VisitContextoCatastro";
import {
  contextoCatastralDesdeProperty,
  visitaDesdePropertyExigePropiedad,
  type ContextoCatastralVisita,
} from "@/lib/partes-visita";
import { prefillParteDesdeCita } from "@/lib/citas/citas";
import { altaCamposVacios, leerAltaBorrador } from "@/lib/ui/alta-borrador";
import { useAltaBorrador } from "@/lib/ui/use-alta-borrador";

type ParteAltaSnap = {
  propiedadId: string;
  visitanteNombre: string;
  visitanteDocumento: string;
  visitanteTelefono: string;
  visitanteEmail: string;
  inmuebleDireccion: string;
  inmuebleReferencia: string;
  fechaVisita: string;
  horaVisita: string;
  observaciones: string;
  estado: "borrador" | "pendiente_firma";
  desdeProperty: boolean;
};

function parteAltaVacia(s: ParteAltaSnap) {
  const visitante = altaCamposVacios(
    s.visitanteNombre,
    s.visitanteDocumento,
    s.visitanteTelefono,
    s.visitanteEmail,
    s.observaciones
  );
  if (!visitante) return false;
  if (s.desdeProperty) return true;
  return altaCamposVacios(s.propiedadId, s.inmuebleDireccion, s.inmuebleReferencia);
}

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
  const ambito = citaIdInicial ? `cita:${citaIdInicial}` : propiedadIdInicial ? `prop:${propiedadIdInicial}` : "libre";
  const saltarPrefill = useRef(false);
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

  const snapshot = useMemo<ParteAltaSnap>(
    () => ({
      propiedadId,
      visitanteNombre,
      visitanteDocumento,
      visitanteTelefono,
      visitanteEmail,
      inmuebleDireccion,
      inmuebleReferencia,
      fechaVisita,
      horaVisita,
      observaciones,
      estado,
      desdeProperty,
    }),
    [
      propiedadId,
      visitanteNombre,
      visitanteDocumento,
      visitanteTelefono,
      visitanteEmail,
      inmuebleDireccion,
      inmuebleReferencia,
      fechaVisita,
      horaVisita,
      observaciones,
      estado,
      desdeProperty,
    ]
  );
  const altaBorrador = useAltaBorrador({ tipo: "parte", ambito, open, snapshot, estaVacio: parteAltaVacia });

  const vaciar = () => {
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
  };

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    void supabase
      .from("propiedades")
      .select("id, referencia, titulo, direccion")
      .order("created_at", { ascending: false })
      .then(({ data }) => setPropiedades(data ?? []));
    const guardado = leerAltaBorrador<ParteAltaSnap>("parte", ambito);
    if (guardado && !parteAltaVacia(guardado.data)) {
      const d = guardado.data;
      saltarPrefill.current = true;
      setPropiedadId(desdeProperty ? propiedadIdInicial ?? "" : d.propiedadId);
      setVisitanteNombre(d.visitanteNombre);
      setVisitanteDocumento(d.visitanteDocumento);
      setVisitanteTelefono(d.visitanteTelefono);
      setVisitanteEmail(d.visitanteEmail);
      setInmuebleDireccion(d.inmuebleDireccion);
      setInmuebleReferencia(d.inmuebleReferencia);
      setFechaVisita(d.fechaVisita);
      setHoraVisita(d.horaVisita);
      setObservaciones(d.observaciones);
      setEstado(d.estado);
    } else {
      saltarPrefill.current = false;
      vaciar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !citaIdInicial || saltarPrefill.current) return;
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
    if (p && !saltarPrefill.current) {
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
        if (!saltarPrefill.current) {
          if (data.direccion) setInmuebleDireccion(data.direccion);
          if (data.referencia) setInmuebleReferencia(data.referencia);
        }
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
    altaBorrador.consumir();
    onOpenChange(false);
    onCreado(data.id);
  };

  return (
    <AltaShell
      open={open}
      onOpenChange={onOpenChange}
      title="Nuevo parte de visita"
      hint="El acta que firma quien visita. Empieza por la persona que tienes delante."
      primaryLabel="Crear parte"
      saving={saving}
      disablePrimary={!inmuebleDireccion.trim() || !agenteNombre.trim()}
      onSubmit={crear}
      borrador={{
        activo: altaBorrador.hayBorrador,
        guardadoEn: altaBorrador.guardadoEn,
        onEliminar: () => {
          saltarPrefill.current = false;
          altaBorrador.descartar();
          vaciar();
          toast.success("Borrador eliminado.");
        },
      }}
    >
      <AltaSection title="Visitante" hint="Nombre y teléfono. El DNI puede ir en la firma.">
        <div className="flex flex-col gap-5">
          <AltaField label="Nombre">
            <input autoFocus value={visitanteNombre} onChange={(e) => setVisitanteNombre(e.target.value)} className={altaControl} />
          </AltaField>
          <div className="grid grid-cols-2 gap-3">
            <AltaField label="Teléfono" optional>
              <input value={visitanteTelefono} onChange={(e) => setVisitanteTelefono(e.target.value)} className={altaControl} />
            </AltaField>
            <AltaField label="DNI / NIE" optional>
              <input value={visitanteDocumento} onChange={(e) => setVisitanteDocumento(e.target.value)} className={altaControl} />
            </AltaField>
          </div>
          <AltaField label="Email" optional>
            <input type="email" value={visitanteEmail} onChange={(e) => setVisitanteEmail(e.target.value)} className={altaControl} />
          </AltaField>
        </div>
      </AltaSection>

      <AltaSection title="Cuándo" hint="Fecha de la visita y si sale ya a firma.">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3">
            <AltaField label="Fecha">
              <input type="date" value={fechaVisita} onChange={(e) => setFechaVisita(e.target.value)} className={altaControl} />
            </AltaField>
            <AltaField label="Hora" optional>
              <input type="time" value={horaVisita} onChange={(e) => setHoraVisita(e.target.value)} className={altaControl} />
            </AltaField>
          </div>
          <AltaField label="Agente">
            <input value={agenteNombre} onChange={(e) => setAgenteNombre(e.target.value)} className={altaControl} />
          </AltaField>
          <div>
            <div className="mb-2.5 text-[12.5px] font-semibold text-[var(--text-2)]">Estado</div>
            <div className="flex flex-wrap gap-2">
              <ToggleChip on={estado === "pendiente_firma"} onClick={() => setEstado("pendiente_firma")}>
                Pendiente de firma
              </ToggleChip>
              <ToggleChip on={estado === "borrador"} onClick={() => setEstado("borrador")}>
                Borrador
              </ToggleChip>
            </div>
          </div>
        </div>
      </AltaSection>

      <AltaSection wide title="Inmueble" hint={desdeProperty ? "Ligado a la ficha desde la que vienes." : "Elige stock o escribe solo la dirección."}>
        {contextoCatastro ? (
          <div className="mb-5">
            <VisitContextoCatastro contexto={contextoCatastro} />
          </div>
        ) : null}
        <div className="grid gap-5 min-[780px]:grid-cols-2">
          <AltaField label="Inmueble del stock" optional={!desdeProperty}>
            <select
              value={propiedadId}
              onChange={(e) => {
                if (!desdeProperty) setPropiedadId(e.target.value);
              }}
              disabled={desdeProperty}
              className={altaControl}
            >
              {desdeProperty ? null : <option value="">Sin ficha (solo dirección)</option>}
              {propiedades.map((p) => (
                <option key={p.id} value={p.id}>
                  {[p.referencia, p.titulo || p.direccion].filter(Boolean).join(" · ")}
                </option>
              ))}
            </select>
          </AltaField>
          <AltaField label="Referencia" optional>
            <input value={inmuebleReferencia} onChange={(e) => setInmuebleReferencia(e.target.value)} className={altaControl} />
          </AltaField>
          <div className="min-[780px]:col-span-2">
            <AltaField label="Dirección">
              <input value={inmuebleDireccion} onChange={(e) => setInmuebleDireccion(e.target.value)} className={altaControl} />
            </AltaField>
          </div>
        </div>
      </AltaSection>

      <AltaExtra label="Observaciones" open={Boolean(observaciones)}>
        <AltaField label="Notas de la visita" optional>
          <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={3} className={`${altaControl} h-auto min-h-[5.5rem] resize-none py-2.5`} />
        </AltaField>
      </AltaExtra>
    </AltaShell>
  );
}
