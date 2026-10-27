"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { AltaField, AltaPersona, AltaSection, AltaShell, altaControl, type PersonaOpcion } from "@/components/ui/alta-form";
import { NuevoClientePanel } from "@/components/clientes/NuevoClientePanel";
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
import { subirArchivosMedia } from "@/lib/inmuebles/subir-media";
import { ZonaArchivosPendientes } from "@/components/inmuebles/ZonaArchivosPendientes";
import { Selector } from "@/components/ui/selector";
import { mensajeGuardado } from "@/lib/ui/mensaje-guardado";
import { coincideTelefonoBusqueda } from "@/lib/ui/busqueda";
import { proponerInmuebleADemandas } from "@/lib/demandas/proponer-stock";
import { siNoDe, triSiNo } from "@/lib/inmuebles/catalogo";
import { avisoPublicacion } from "@/lib/inmuebles/publicacion";
import { pedirSyncIdealista } from "@/lib/inmuebles/idealista-publicacion/pedir-sync";
import { PublicacionInmueble } from "@/components/inmuebles/PublicacionInmueble";

type InmuebleAltaSnap = {
  values: InmuebleFormValues;
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
  const [altaClienteOpen, setAltaClienteOpen] = useState(false);
  const [altaClienteNombre, setAltaClienteNombre] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendientesFoto, setPendientesFoto] = useState<File[]>([]);
  const [pendientesPlano, setPendientesPlano] = useState<File[]>([]);
  const [values, setValues] = useState<InmuebleFormValues>({
    ...INMUEBLE_FORM_VACIO,
    ofertante_id: ofertanteIdInicial ?? "",
  });

  const snapshot = useMemo<InmuebleAltaSnap>(
    () => ({ values, fijo: ofertanteFijo }),
    [values, ofertanteFijo]
  );
  const altaBorrador = useAltaBorrador({ tipo: "inmueble", ambito, open, snapshot, estaVacio: inmuebleAltaVacia });

  const vaciar = () => {
    setValues({ ...INMUEBLE_FORM_VACIO, ofertante_id: ofertanteIdInicial ?? "" });
    setQCliente("");
    setAltaClienteOpen(false);
    setAltaClienteNombre("");
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
    return clientes
      .filter((c) => c.nombre.toLowerCase().includes(q) || coincideTelefonoBusqueda(c.telefono, qCliente))
      .slice(0, 6);
  }, [clientes, qCliente]);

  const crear = async () => {
    if (!values.titulo.trim() && !values.direccion.trim()) {
      toast.error("Pon un título o una dirección.");
      return;
    }
    const faltaPublicar = avisoPublicacion(values, pendientesFoto.length);
    if (faltaPublicar) {
      toast.error(faltaPublicar);
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
    const ofertanteId = values.ofertante_id;
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
    const aviso = mensajeGuardado(error, "No se ha podido crear el inmueble.", data);
    if (aviso || !data) {
      setSaving(false);
      toast.error(aviso ?? "No se ha podido crear el inmueble.");
      return;
    }
    await proponerInmuebleADemandas(supabase, data.id);
    const fallosMedia: string[] = [];
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
        fallosMedia.push(...subida.errores);
      }
      if (pendientesPlano.length) {
        const subida = await subirArchivosMedia({
          propiedadId: data.id,
          userId: user.id,
          files: pendientesPlano,
          tipo: "plano",
          media,
        });
        fallosMedia.push(...subida.errores);
      }
    }
    const sync = await pedirSyncIdealista(data.id);
    setSaving(false);
    if (sync.estado === "publicado") toast.success(sync.mensaje ?? "Publicado en Idealista.");
    else if (sync.mensaje && (sync.estado === "error" || sync.estado === "incompleto")) toast.error(sync.mensaje);
    else if (sync.mensaje) toast.message(sync.mensaje);
    for (const err of fallosMedia) toast.error(err);
    if (fallosMedia.length) {
      toast.error("El inmueble se ha creado, pero alguna foto o plano no se ha guardado.");
    } else {
      toast.success("Inmueble creado.");
    }
    altaBorrador.consumir();
    onOpenChange(false);
    onCreado(data.id);
  };

  return (
    <>
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
      <AltaSection wide title="Propietario" hint="Puedes dejarlo sin asignar y ligarlo después. Si es nuevo, abre la misma ficha completa de Contactos.">
        <AltaPersona
          fijo={ofertanteFijo}
          fijoNombre={ofertanteNombre}
          permitirNinguno
          seleccionado={clienteSel}
          onSeleccionar={(persona) => set({ ofertante_id: persona.id })}
          onLimpiar={() => set({ ofertante_id: "" })}
          q={qCliente}
          setQ={setQCliente}
          sugeridos={sugeridos}
          onAltaNueva={(nombreSugerido) => {
            setAltaClienteNombre(nombreSugerido ?? "");
            setAltaClienteOpen(true);
          }}
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
            <AltaField label="Garaje" optional>
              <Selector value={triSiNo(values.garaje)} onChange={(e) => set({ garaje: siNoDe(e.target.value) })} className={altaControl}>
                <option value="">Sin indicar</option>
                <option value="si">Sí</option>
                <option value="no">No</option>
              </Selector>
            </AltaField>
            <AltaField label="Terraza" optional>
              <Selector value={triSiNo(values.terraza)} onChange={(e) => set({ terraza: siNoDe(e.target.value) })} className={altaControl}>
                <option value="">Sin indicar</option>
                <option value="si">Sí</option>
                <option value="no">No</option>
              </Selector>
            </AltaField>
            <AltaField label="Exterior" optional>
              <Selector value={triSiNo(values.exterior)} onChange={(e) => set({ exterior: siNoDe(e.target.value) })} className={altaControl}>
                <option value="">Sin indicar</option>
                <option value="si">Sí</option>
                <option value="no">No</option>
              </Selector>
            </AltaField>
            <AltaField label="Estado">
              <Selector value={values.estado} onChange={(e) => set({ estado: e.target.value as InmuebleFormValues["estado"] })} className={altaControl}>
                {ESTADOS_INMUEBLE.map((estado) => (
                  <option key={estado} value={estado}>
                    {ESTADO_INMUEBLE_LABEL[estado]}
                  </option>
                ))}
              </Selector>
            </AltaField>
          </div>
          <PublicacionInmueble values={values} onChange={set} fotos={pendientesFoto.length} controlClassName={altaControl} />
        </div>
      </AltaSection>

      <AltaSection wide title="Fotos y visita virtual" hint="Puedes dejarlo vacío y completarlo en la ficha. Los archivos de esta sesión no entran en el borrador del navegador.">
        <div className="flex flex-col gap-4">
          <AltaField label="Fotos" optional>
            <ZonaArchivosPendientes tipo="foto" files={pendientesFoto} onChange={setPendientesFoto} />
          </AltaField>
          <AltaField label="Planos" optional>
            <ZonaArchivosPendientes tipo="plano" files={pendientesPlano} onChange={setPendientesPlano} />
          </AltaField>
          <AltaField label="Vídeo (YouTube / Vimeo)" optional>
            <input value={values.video_url} onChange={(e) => set({ video_url: e.target.value })} placeholder="https://" className={altaControl} />
          </AltaField>
          <AltaField label="Tour 3D (Matterport / Kuula)" optional>
            <input value={values.tour_url} onChange={(e) => set({ tour_url: e.target.value })} placeholder="https://my.matterport.com/show/?m=…" className={altaControl} />
          </AltaField>
        </div>
      </AltaSection>

      <AltaSection title="Descripción" hint="Es el texto de la web y de Idealista. Las notas de abajo no salen." wide>
        <AltaField label="Descripción" optional>
          <textarea value={values.descripcion} onChange={(e) => set({ descripcion: e.target.value })} rows={4} className={`${altaControl} h-auto min-h-[6.5rem] resize-none py-2.5`} />
        </AltaField>
      </AltaSection>

      <AltaSection title="Notas internas" hint="Quedan en el CRM. No salen al portal ni a la ficha pública." wide>
        <AltaField label="Notas" optional>
          <textarea value={values.notas} onChange={(e) => set({ notas: e.target.value })} rows={3} className={`${altaControl} h-auto min-h-[5.5rem] resize-none py-2.5`} />
        </AltaField>
      </AltaSection>
    </AltaShell>
    <NuevoClientePanel
      open={altaClienteOpen}
      onOpenChange={setAltaClienteOpen}
      elevated
      nombreInicial={altaClienteNombre}
      ambito="desde-inmueble"
      onCreado={(id, extra) => {
        setClientes((prev) => {
          if (prev.some((c) => c.id === id)) return prev;
          return [...prev, { id, nombre: extra?.nombre ?? "Cliente", telefono: extra?.telefono ?? null }].sort((a, b) =>
            a.nombre.localeCompare(b.nombre)
          );
        });
        set({ ofertante_id: id });
        setQCliente("");
      }}
    />
    </>
  );
}
