"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TimeInput } from "@/components/ui/time-input";
import { Label } from "@/components/ui/label";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { DocumentoSplit, PdfFrame } from "@/components/documentos/DocumentoSplit";
import { useImprimirDocumento } from "@/components/documentos/DialogoGuardarAlImprimir";
import { prepararDocumentoExportHtml } from "@/lib/documentos-paginacion";
import { VisitContextoCatastro } from "@/components/partes-visita/VisitContextoCatastro";
import { prefillParteDesdeCita } from "@/lib/citas/citas";
import {
  contextoCatastralDesdeProperty,
  visitaDesdePropertyExigePropiedad,
  type ContextoCatastralVisita,
} from "@/lib/partes-visita";
import {
  downloadParteVisitaPdf,
  horaMasUna,
  htmlParteVisita,
  parseCalidadVisita,
  type CalidadVisita,
  type ParteVisitaPdfDatos,
} from "@/lib/parte-visita-pdf";
import { altaCamposVacios, leerAltaBorrador } from "@/lib/ui/alta-borrador";
import { useAltaBorrador } from "@/lib/ui/use-alta-borrador";
import { cn } from "@/lib/utils";

const area =
  "mt-1.5 min-h-[5rem] w-full resize-y rounded-[9px] border border-[var(--input)] bg-white px-3 py-2.5 text-[13.5px] outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/15 max-[819px]:text-base";

type Snap = {
  propiedadId: string;
  visitanteNombre: string;
  visitanteDocumento: string;
  visitanteTelefono: string;
  visitanteEmail: string;
  inmuebleDireccion: string;
  inmuebleReferencia: string;
  fechaVisita: string;
  horaVisita: string;
  horaFin: string;
  calidad: CalidadVisita;
  observaciones: string;
  estado: "borrador" | "pendiente_firma";
};

function snapVacio(s: Snap) {
  return altaCamposVacios(
    s.visitanteNombre,
    s.visitanteDocumento,
    s.visitanteTelefono,
    s.visitanteEmail,
    s.inmuebleDireccion,
    s.inmuebleReferencia,
    s.observaciones
  );
}

export function ParteVisitaEditor({
  parteId,
  propiedadIdInicial,
  citaIdInicial,
}: {
  parteId?: string;
  propiedadIdInicial?: string;
  citaIdInicial?: string;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const desdeProperty = Boolean(propiedadIdInicial);
  const ambito = parteId ? `id:${parteId}` : citaIdInicial ? `cita:${citaIdInicial}` : propiedadIdInicial ? `prop:${propiedadIdInicial}` : "libre";
  const [loading, setLoading] = useState(Boolean(parteId));
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
  const [horaVisita, setHoraVisita] = useState("17:00");
  const [horaFin, setHoraFin] = useState("19:00");
  const [calidad, setCalidad] = useState<CalidadVisita>("comprador");
  const [agenteNombre, setAgenteNombre] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [estado, setEstado] = useState<"borrador" | "pendiente_firma">("pendiente_firma");
  const [firmaVisitante, setFirmaVisitante] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [contextoCatastro, setContextoCatastro] = useState<ContextoCatastralVisita>(null);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [prefillListo, setPrefillListo] = useState(false);

  const snapshot = useMemo<Snap>(
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
      horaFin,
      calidad,
      observaciones,
      estado,
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
      horaFin,
      calidad,
      observaciones,
      estado,
    ]
  );
  const altaBorrador = useAltaBorrador({
    tipo: "parte",
    ambito,
    open: !parteId && prefillListo,
    snapshot,
    estaVacio: snapVacio,
  });

  const pdfDatos: ParteVisitaPdfDatos = {
    visitante_nombre: visitanteNombre,
    visitante_documento: visitanteDocumento,
    inmueble_direccion: inmuebleDireccion,
    fecha_visita: fechaVisita,
    hora_visita: horaVisita,
    hora_fin: horaFin,
    calidad,
    agente_nombre: agenteNombre,
    firma_visitante: firmaVisitante,
  };
  const html = useMemo(() => htmlParteVisita(pdfDatos), [pdfDatos]);

  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("propiedades")
      .select("id, referencia, titulo, direccion")
      .order("created_at", { ascending: false })
      .then(({ data }) => setPropiedades(data ?? []));
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const supabase = createClient();
    void supabase
      .from("profiles")
      .select("nombre_completo, email")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (agenteNombre) return;
        const nombre = data?.nombre_completo || data?.email?.split("@")[0] || user.email.split("@")[0];
        setAgenteNombre(nombre ?? "");
      });
  }, [user?.id, user?.email, agenteNombre]);

  useEffect(() => {
    if (!parteId) return;
    const supabase = createClient();
    void supabase
      .from("partes_visita")
      .select("*")
      .eq("id", parteId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          toast.error(error?.message ?? "No se ha podido cargar el parte.");
          setLoading(false);
          return;
        }
        setVisitanteNombre(data.visitante_nombre ?? "");
        setVisitanteDocumento(data.visitante_documento ?? "");
        setVisitanteTelefono(data.visitante_telefono ?? "");
        setVisitanteEmail(data.visitante_email ?? "");
        setInmuebleDireccion(data.inmueble_direccion ?? "");
        setInmuebleReferencia(data.inmueble_referencia ?? "");
        setFechaVisita(data.fecha_visita ?? new Date().toISOString().slice(0, 10));
        setHoraVisita(data.hora_visita ? String(data.hora_visita).slice(0, 5) : "17:00");
        setHoraFin(data.hora_fin ? String(data.hora_fin).slice(0, 5) : horaMasUna(data.hora_visita));
        setCalidad(parseCalidadVisita(data.calidad));
        setAgenteNombre(data.agente_nombre ?? "");
        setObservaciones(data.observaciones ?? "");
        setEstado(data.estado === "borrador" ? "borrador" : "pendiente_firma");
        setFirmaVisitante(data.firma_visitante);
        setPropiedadId(data.propiedad_id ?? "");
        setClienteId(data.cliente_id);
        setLoading(false);
      });
  }, [parteId]);

  useEffect(() => {
    if (parteId) return;
    const guardado = leerAltaBorrador<Snap>("parte", ambito);
    if (guardado && !snapVacio(guardado.data)) {
      const d = guardado.data;
      setPropiedadId(desdeProperty ? propiedadIdInicial ?? "" : d.propiedadId);
      setVisitanteNombre(d.visitanteNombre);
      setVisitanteDocumento(d.visitanteDocumento);
      setVisitanteTelefono(d.visitanteTelefono);
      setVisitanteEmail(d.visitanteEmail);
      setInmuebleDireccion(d.inmuebleDireccion);
      setInmuebleReferencia(d.inmuebleReferencia);
      setFechaVisita(d.fechaVisita);
      setHoraVisita(d.horaVisita);
      setHoraFin(d.horaFin || horaMasUna(d.horaVisita));
      setCalidad(d.calidad);
      setObservaciones(d.observaciones);
      setEstado(d.estado);
      setPrefillListo(true);
      return;
    }
    if (!citaIdInicial) {
      setPrefillListo(true);
      return;
    }
    const supabase = createClient();
    void supabase
      .from("citas")
      .select("id, titulo, empieza, propiedad_id, cliente_id")
      .eq("id", citaIdInicial)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const prefill = prefillParteDesdeCita({
            titulo: data.titulo,
            empieza: data.empieza,
            propiedadId: data.propiedad_id,
          });
          if (prefill.propiedadId) setPropiedadId(prefill.propiedadId);
          setFechaVisita(prefill.fechaVisita);
          setHoraVisita(prefill.horaVisita);
          setHoraFin(horaMasUna(prefill.horaVisita));
          if (prefill.observaciones) setObservaciones(prefill.observaciones);
          if (data.cliente_id) setClienteId(data.cliente_id);
        }
        setPrefillListo(true);
      });
  }, [parteId, ambito, citaIdInicial, desdeProperty, propiedadIdInicial]);

  useEffect(() => {
    if (!propiedadId) {
      setContextoCatastro(null);
      return;
    }
    const supabase = createClient();
    void supabase
      .from("propiedades")
      .select("id, direccion, referencia, origen, referencia_catastral, catastro_property_links(finca_reference)")
      .eq("id", propiedadId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        if (!inmuebleDireccion && data.direccion) setInmuebleDireccion(data.direccion);
        if (!inmuebleReferencia && data.referencia) setInmuebleReferencia(data.referencia);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propiedadId]);

  const guardar = async (opts?: { quedarse?: boolean }): Promise<boolean> => {
    if (!visitaDesdePropertyExigePropiedad(desdeProperty, propiedadId)) {
      toast.error("Esta visita debe quedar ligada a la propiedad.");
      return false;
    }
    if (!inmuebleDireccion.trim()) {
      toast.error("La dirección del inmueble es obligatoria.");
      return false;
    }
    if (!agenteNombre.trim()) {
      toast.error("El agente comercial es obligatorio.");
      return false;
    }
    const supabase = createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) {
      toast.error("Sesión expirada.");
      return false;
    }
    setSaving(true);
    const payload = {
      estado,
      visitante_nombre: visitanteNombre.trim() || null,
      visitante_documento: visitanteDocumento.trim() || null,
      visitante_telefono: visitanteTelefono.trim() || null,
      visitante_email: visitanteEmail.trim() || null,
      inmueble_direccion: inmuebleDireccion.trim(),
      inmueble_referencia: inmuebleReferencia.trim() || null,
      propiedad_id: propiedadId || null,
      fecha_visita: fechaVisita || null,
      hora_visita: horaVisita || null,
      hora_fin: horaFin || null,
      calidad,
      agente_nombre: agenteNombre.trim(),
      observaciones: observaciones.trim() || null,
      updated_at: new Date().toISOString(),
    };
    if (parteId) {
      const { error } = await supabase.from("partes_visita").update(payload).eq("id", parteId);
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return false;
      }
      toast.success("Parte guardado.");
      if (!opts?.quedarse) {
        router.push(`/partes-visita/${parteId}`);
        router.refresh();
      }
      return true;
    }
    const { data, error } = await supabase
      .from("partes_visita")
      .insert({
        ...payload,
        user_id: authUser.id,
        comercial_id: authUser.id,
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
      toast.error(error?.message ?? "No se ha podido crear el parte.");
      return false;
    }
    altaBorrador.consumir();
    toast.success("Parte de visita guardado.");
    if (opts?.quedarse) {
      router.replace(`/partes-visita/${data.id}/editar`);
    } else {
      router.push(`/partes-visita/${data.id}`);
    }
    router.refresh();
    return true;
  };

  const descargar = async () => {
    setPrinting(true);
    try {
      await downloadParteVisitaPdf(pdfDatos);
      toast.success("PDF descargado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se ha podido generar el PDF.");
    } finally {
      setPrinting(false);
    }
  };

  const imprimir = useImprimirDocumento(html, guardar, { prepararHtml: prepararDocumentoExportHtml });

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <Link
          href={parteId ? `/partes-visita/${parteId}` : "/herramientas"}
          aria-label="Volver"
          className="flex shrink-0 items-center justify-center rounded-lg text-neutral-600 hover:text-foreground"
        >
          <ChevronLeft className="h-7 w-7" strokeWidth={1.5} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight min-[820px]:text-[28px]">
            {parteId ? "Editar parte de visita" : "Nuevo parte de visita"}
          </h1>
          <p className="mt-1 text-[13px] text-[var(--text-2)]">
            Rellena los campos. A la derecha ves el PDF con los datos de Rehabinco.
          </p>
        </div>
        <div className="hidden gap-2 min-[820px]:flex">
          <Button type="button" variant="secondary" onClick={imprimir.pedirImprimir}>
            Imprimir
          </Button>
          <Button type="button" onClick={() => void guardar()} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>

      <DocumentoSplit
        form={
          <div className="space-y-4">
            <section className="rounded-[14px] border border-border bg-white p-4 min-[820px]:p-5">
              <h2 className="text-[15px] font-semibold">Visitante</h2>
              <div className="mt-4 grid gap-4 min-[820px]:grid-cols-2">
                <div className="min-[820px]:col-span-2">
                  <Label htmlFor="visitante">Nombre y apellidos</Label>
                  <Input id="visitante" className="mt-1.5" value={visitanteNombre} onChange={(e) => setVisitanteNombre(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="dni">DNI / NIE</Label>
                  <Input id="dni" className="mt-1.5" value={visitanteDocumento} onChange={(e) => setVisitanteDocumento(e.target.value)} />
                </div>
                <div>
                  <Label>Calidad</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <ToggleChip on={calidad === "comprador"} onClick={() => setCalidad("comprador")}>
                      Comprador
                    </ToggleChip>
                    <ToggleChip on={calidad === "arrendatario"} onClick={() => setCalidad("arrendatario")}>
                      Arrendatario
                    </ToggleChip>
                  </div>
                </div>
                <div>
                  <Label htmlFor="tel">Teléfono</Label>
                  <Input id="tel" className="mt-1.5" value={visitanteTelefono} onChange={(e) => setVisitanteTelefono(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="mail">Email</Label>
                  <Input id="mail" type="email" className="mt-1.5" value={visitanteEmail} onChange={(e) => setVisitanteEmail(e.target.value)} />
                </div>
              </div>
            </section>

            <section className="rounded-[14px] border border-border bg-white p-4 min-[820px]:p-5">
              <h2 className="text-[15px] font-semibold">Visita</h2>
              <div className="mt-4 grid gap-4 min-[820px]:grid-cols-2">
                <div>
                  <Label htmlFor="fecha">Fecha</Label>
                  <Input id="fecha" type="date" className="mt-1.5" value={fechaVisita} onChange={(e) => setFechaVisita(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="agente">Agente</Label>
                  <Input id="agente" className="mt-1.5" value={agenteNombre} onChange={(e) => setAgenteNombre(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="hora">Desde</Label>
                  <TimeInput id="hora" className="mt-1.5 flex h-9 w-full rounded-[9px] border border-[var(--input)] bg-white px-3 py-2 text-[13.5px]" value={horaVisita} onChange={setHoraVisita} />
                </div>
                <div>
                  <Label htmlFor="hora-fin">Hasta</Label>
                  <TimeInput id="hora-fin" className="mt-1.5 flex h-9 w-full rounded-[9px] border border-[var(--input)] bg-white px-3 py-2 text-[13.5px]" value={horaFin} onChange={setHoraFin} />
                </div>
              </div>
            </section>

            <section className="rounded-[14px] border border-border bg-white p-4 min-[820px]:p-5">
              <h2 className="text-[15px] font-semibold">Inmuebles visitados</h2>
              <p className="mt-1 text-[12.5px] text-[var(--text-2)]">Puedes poner varias calles, como en la cuartilla.</p>
              {contextoCatastro ? (
                <div className="mt-3">
                  <VisitContextoCatastro contexto={contextoCatastro} />
                </div>
              ) : null}
              <div className="mt-4 grid gap-4">
                <div>
                  <Label htmlFor="stock">Inmueble del stock</Label>
                  <select
                    id="stock"
                    value={propiedadId}
                    disabled={desdeProperty}
                    onChange={(e) => setPropiedadId(e.target.value)}
                    className={cn(area, "mt-1.5 h-9 min-h-0 py-0 max-[819px]:h-[46px]")}
                  >
                    <option value="">Sin ficha (solo dirección)</option>
                    {propiedades.map((p) => (
                      <option key={p.id} value={p.id}>
                        {[p.referencia, p.titulo || p.direccion].filter(Boolean).join(" · ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="dir">Dirección o calles</Label>
                  <textarea
                    id="dir"
                    value={inmuebleDireccion}
                    onChange={(e) => setInmuebleDireccion(e.target.value)}
                    className={area}
                    placeholder="JUANA DE VEGA 29-31, 5ºB"
                  />
                </div>
                <div>
                  <Label htmlFor="ref">Referencia</Label>
                  <Input id="ref" className="mt-1.5" value={inmuebleReferencia} onChange={(e) => setInmuebleReferencia(e.target.value)} />
                </div>
              </div>
            </section>

            <section className="rounded-[14px] border border-border bg-white p-4 min-[820px]:p-5">
              <h2 className="text-[15px] font-semibold">Notas internas</h2>
              <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} className={cn(area, "mt-3")} />
              <div className="mt-4">
                <div className="mb-2 text-[12.5px] font-semibold text-[var(--text-2)]">Estado</div>
                <div className="flex flex-wrap gap-2">
                  <ToggleChip on={estado === "pendiente_firma"} onClick={() => setEstado("pendiente_firma")}>
                    Pendiente de firma
                  </ToggleChip>
                  <ToggleChip on={estado === "borrador"} onClick={() => setEstado("borrador")}>
                    Borrador
                  </ToggleChip>
                </div>
              </div>
            </section>
          </div>
        }
        preview={<PdfFrame html={html} pages={1} onDownload={descargar} downloading={printing} onPrint={imprimir.pedirImprimir} />}
      />

      {imprimir.dialogo}

      <div className="fixed bottom-0 left-0 right-0 z-40 flex gap-2 border-t border-border bg-white/95 px-4 py-3 min-[820px]:hidden">
        <Button type="button" variant="secondary" className="flex-1" onClick={imprimir.pedirImprimir}>
          Imprimir
        </Button>
        <Button type="button" className="flex-1" onClick={() => void guardar()} disabled={saving}>
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </div>
  );
}
