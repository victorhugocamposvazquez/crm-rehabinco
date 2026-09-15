"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { AltaField, AltaPersona, AltaSection, AltaShell, altaControl, type PersonaOpcion } from "@/components/ui/alta-form";
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
import { BuscadorLocalidad } from "@/components/geo/BuscadorLocalidad";
import { altaCamposVacios, leerAltaBorrador } from "@/lib/ui/alta-borrador";
import { useAltaBorrador } from "@/lib/ui/use-alta-borrador";
import { acceptMedia, validarArchivoMedia } from "@/lib/inmuebles/media";
import { subirArchivosMedia } from "@/lib/inmuebles/subir-media";

type InmuebleAltaSnap = {
  values: InmuebleFormValues;
  nuevoPropietario: boolean;
  nombreNuevo: string;
  telefonoNuevo: string;
  fijo: boolean;
};

function inmuebleAltaVacia(s: InmuebleAltaSnap) {
  const v = s.values;
  return altaCamposVacios(
    v.titulo,
    v.direccion,
    v.localidad,
    v.codigo_postal,
    v.precio_venta,
    v.precio_alquiler,
    v.superficie_m2,
    v.habitaciones,
    v.banos,
    v.notas,
    v.video_url,
    v.tour_url,
    s.nombreNuevo,
    s.telefonoNuevo,
    s.nuevoPropietario,
    s.fijo ? "" : v.ofertante_id
  );
}

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
  const ambito = ofertanteIdInicial ?? "libre";
  const [clientes, setClientes] = useState<PersonaOpcion[]>([]);
  const [qCliente, setQCliente] = useState("");
  const [nuevoPropietario, setNuevoPropietario] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [telefonoNuevo, setTelefonoNuevo] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendientesFoto, setPendientesFoto] = useState<File[]>([]);
  const [pendientesPlano, setPendientesPlano] = useState<File[]>([]);
  const [values, setValues] = useState<InmuebleFormValues>({
    ...INMUEBLE_FORM_VACIO,
    ofertante_id: ofertanteIdInicial ?? "",
  });

  const snapshot = useMemo<InmuebleAltaSnap>(
    () => ({ values, nuevoPropietario, nombreNuevo, telefonoNuevo, fijo: ofertanteFijo }),
    [values, nuevoPropietario, nombreNuevo, telefonoNuevo, ofertanteFijo]
  );
  const altaBorrador = useAltaBorrador({ tipo: "inmueble", ambito, open, snapshot, estaVacio: inmuebleAltaVacia });

  const vaciar = () => {
    setValues({ ...INMUEBLE_FORM_VACIO, ofertante_id: ofertanteIdInicial ?? "" });
    setQCliente("");
    setNuevoPropietario(false);
    setNombreNuevo("");
    setTelefonoNuevo("");
    setPendientesFoto([]);
    setPendientesPlano([]);
  };

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    void supabase
      .from("clientes")
      .select("id, nombre, telefono")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => setClientes((data ?? []) as PersonaOpcion[]));
    const guardado = leerAltaBorrador<InmuebleAltaSnap>("inmueble", ambito);
    if (guardado && !inmuebleAltaVacia(guardado.data)) {
      setValues({
        ...INMUEBLE_FORM_VACIO,
        ...guardado.data.values,
        ofertante_id: ofertanteFijo ? ofertanteIdInicial ?? "" : guardado.data.values.ofertante_id,
      });
      setNuevoPropietario(guardado.data.nuevoPropietario);
      setNombreNuevo(guardado.data.nombreNuevo);
      setTelefonoNuevo(guardado.data.telefonoNuevo);
      setQCliente("");
    } else {
      vaciar();
    }
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
    if (error || !data) {
      setSaving(false);
      toast.error("No se ha podido crear el inmueble.");
      return;
    }
    if (pendientesFoto.length || pendientesPlano.length) {
      let media: Awaited<ReturnType<typeof subirArchivosMedia>>["media"] = [];
      if (pendientesFoto.length) {
        const subida = await subirArchivosMedia({
          propiedadId: data.id,
          userId: user.id,
          files: pendientesFoto,
          tipo: "foto",
          media,
        });
        media = subida.media;
        for (const err of subida.errores) toast.error(err);
      }
      if (pendientesPlano.length) {
        const subida = await subirArchivosMedia({
          propiedadId: data.id,
          userId: user.id,
          files: pendientesPlano,
          tipo: "plano",
          media,
        });
        for (const err of subida.errores) toast.error(err);
      }
    }
    setSaving(false);
    toast.success("Inmueble creado.");
    altaBorrador.consumir();
    onOpenChange(false);
    onCreado(data.id);
  };

  return (
    <AltaShell
      open={open}
      onOpenChange={onOpenChange}
      title="Nuevo inmueble"
      hint="Con título o dirección basta. Fotos, planos y tour 3D pueden ir ya o en la ficha."
      primaryLabel="Crear inmueble"
      saving={saving}
      disablePrimary={!values.titulo.trim() && !values.direccion.trim()}
      onSubmit={crear}
      borrador={{
        activo: altaBorrador.hayBorrador,
        guardadoEn: altaBorrador.guardadoEn,
        onEliminar: () => {
          altaBorrador.descartar();
          vaciar();
          toast.success("Borrador eliminado.");
        },
      }}
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
            <div className="grid grid-cols-2 gap-3">
              <BuscadorLocalidad
                value={values.localidad}
                onChange={(valor) => set({ localidad: Array.isArray(valor) ? valor[0] ?? "" : valor })}
                placeholder="Toda España · 3 letras"
              />
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

      <AltaSection wide title="Fotos y visita virtual" hint="Puedes dejarlo vacío y completarlo en la ficha. Los archivos de esta sesión no entran en el borrador del navegador.">
        <div className="flex flex-col gap-4">
          <AltaField label="Fotos" optional>
            <input
              type="file"
              accept={acceptMedia("foto")}
              multiple
              className={`${altaControl} mt-2 cursor-pointer py-2.5 file:mr-3 file:rounded-md file:border-0 file:bg-[var(--surface-soft)] file:px-3 file:py-1.5 file:text-[12.5px] file:font-semibold`}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                const ok: File[] = [];
                for (const file of files) {
                  const fallo = validarArchivoMedia("foto", file);
                  if (fallo) toast.error(fallo);
                  else ok.push(file);
                }
                setPendientesFoto(ok);
              }}
            />
            {pendientesFoto.length ? (
              <p className="mt-1.5 text-[12.5px] text-[var(--text-2)]">{pendientesFoto.length} foto{pendientesFoto.length === 1 ? "" : "s"} listas para subir</p>
            ) : null}
          </AltaField>
          <AltaField label="Planos" optional>
            <input
              type="file"
              accept={acceptMedia("plano")}
              multiple
              className={`${altaControl} mt-2 cursor-pointer py-2.5 file:mr-3 file:rounded-md file:border-0 file:bg-[var(--surface-soft)] file:px-3 file:py-1.5 file:text-[12.5px] file:font-semibold`}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                const ok: File[] = [];
                for (const file of files) {
                  const fallo = validarArchivoMedia("plano", file);
                  if (fallo) toast.error(fallo);
                  else ok.push(file);
                }
                setPendientesPlano(ok);
              }}
            />
            {pendientesPlano.length ? (
              <p className="mt-1.5 text-[12.5px] text-[var(--text-2)]">{pendientesPlano.length} plano{pendientesPlano.length === 1 ? "" : "s"} listos</p>
            ) : null}
          </AltaField>
          <AltaField label="Vídeo (YouTube / Vimeo)" optional>
            <input value={values.video_url} onChange={(e) => set({ video_url: e.target.value })} placeholder="https://" className={altaControl} />
          </AltaField>
          <AltaField label="Tour 3D (Matterport / Kuula)" optional>
            <input value={values.tour_url} onChange={(e) => set({ tour_url: e.target.value })} placeholder="https://my.matterport.com/show/?m=…" className={altaControl} />
          </AltaField>
        </div>
      </AltaSection>

      <AltaSection title="Notas internas" hint="Quedan en el CRM. No salen al portal ni a la ficha pública." wide>
        <AltaField label="Notas" optional>
          <textarea value={values.notas} onChange={(e) => set({ notas: e.target.value })} rows={3} className={`${altaControl} h-auto min-h-[5.5rem] resize-none py-2.5`} />
        </AltaField>
      </AltaSection>
    </AltaShell>
  );
}
