"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronLeft, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { eliminarDocumentos } from "@/lib/actions/papelera";
import { useAuth } from "@/lib/auth/auth-context";
import { isAdmin } from "@/lib/auth/roles";
import { relacionUno } from "@/lib/citas/citas";
import { CreadorDocumento } from "@/components/documentos/CreadorDocumento";
import { Button } from "@/components/ui/button";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { DocumentoSplit } from "@/components/documentos/DocumentoSplit";
import { PdfFrameEditable } from "@/components/documentos/PdfFrameEditable";
import { useImprimirDocumento } from "@/components/documentos/DialogoGuardarAlImprimir";
import {
  hojaEncargoDesdeFila,
  hojaEncargoHonorariosVacia,
  type ClausulasPersonalizadasHonorarios,
  type HojaEncargoHonorariosDatos,
} from "@/lib/hoja-encargo-honorarios";
import { clausulasPersonalizadasDesdeEdicion } from "@/lib/contrato-arras-preview";
import type { ClausulasPersonalizadasArras } from "@/lib/contrato-arras";
import { prepararDocumentoExportHtml } from "@/lib/documentos-paginacion";
import {
  downloadHojaEncargoHonorariosPdf,
  htmlHojaEncargoHonorarios,
  htmlHojaEncargoHonorariosExport,
  textosHojaEncargoHonorarios,
} from "@/lib/hoja-encargo-honorarios-pdf";
import { EMPRESA_DOCUMENTOS } from "@/lib/empresa-documentos";
import { altaCamposVacios, leerAltaBorrador } from "@/lib/ui/alta-borrador";
import { useAltaBorrador } from "@/lib/ui/use-alta-borrador";
import type { Json } from "@/lib/supabase/types";

function snapVacio(s: HojaEncargoHonorariosDatos) {
  return altaCamposVacios(s.cliente_nombre, s.cliente_dni, s.inmueble_descripcion);
}

export function HojaEncargoHonorariosEditor({ documentoId }: { documentoId?: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const admin = isAdmin(user?.role);
  const [metaCreador, setMetaCreador] = useState<{
    user_id: string;
    comercial_id: string | null;
    creador: { nombre_completo?: string | null; color?: string | null; email?: string | null } | null;
  } | null>(null);
  const [loading, setLoading] = useState(Boolean(documentoId));
  const [datos, setDatos] = useState<HojaEncargoHonorariosDatos>(() => ({
    ...hojaEncargoHonorariosVacia(),
    fecha: new Date().toISOString().slice(0, 10),
  }));
  const [estado, setEstado] = useState<"borrador" | "cerrado">("borrador");
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [listo, setListo] = useState(!documentoId);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const altaBorrador = useAltaBorrador({
    tipo: "honorarios",
    ambito: documentoId ? `id:${documentoId}` : "libre",
    open: !documentoId && listo,
    snapshot: datos,
    estaVacio: snapVacio,
  });

  const htmlPreview = useMemo(() => htmlHojaEncargoHonorarios(datos, { editable: true }), [datos]);
  const htmlExport = useMemo(() => htmlHojaEncargoHonorariosExport(datos), [datos]);
  const tieneClausulasPersonalizadas = Object.keys(datos.clausulas_personalizadas ?? {}).length > 0;

  const setClausulasPersonalizadas = (clausulas: ClausulasPersonalizadasArras) => {
    setDatos((d) => {
      const generadas = textosHojaEncargoHonorarios({ ...d, clausulas_personalizadas: {} });
      return {
        ...d,
        clausulas_personalizadas: clausulasPersonalizadasDesdeEdicion(
          clausulas as ClausulasPersonalizadasHonorarios,
          generadas
        ),
      };
    });
  };

  useEffect(() => {
    if (documentoId) return;
    const guardado = leerAltaBorrador<HojaEncargoHonorariosDatos>("honorarios", "libre");
    if (guardado && !snapVacio(guardado.data)) {
      setDatos({
        ...hojaEncargoHonorariosVacia(),
        ...guardado.data,
        fecha: guardado.data.fecha || new Date().toISOString().slice(0, 10),
      });
    }
    setListo(true);
  }, [documentoId]);

  useEffect(() => {
    if (!documentoId) return;
    const supabase = createClient();
    void supabase
      .from("hojas_encargo_honorarios")
      .select("*, creador:comercial_id(nombre_completo, color, email)")
      .eq("id", documentoId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          toast.error(error?.message ?? "No se ha podido cargar la hoja de encargo.");
          setLoading(false);
          return;
        }
        setDatos(hojaEncargoDesdeFila(data));
        setEstado(data.estado);
        setMetaCreador({
          user_id: data.user_id,
          comercial_id: data.comercial_id,
          creador: relacionUno(
            (data as { creador?: { nombre_completo?: string | null; color?: string | null; email?: string | null } | null })
              .creador
          ),
        });
        setLoading(false);
      });
  }, [documentoId]);

  const guardar = async (): Promise<boolean> => {
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
      lugar: datos.lugar.trim() || EMPRESA_DOCUMENTOS.lugar,
      fecha: datos.fecha,
      cliente_nombre: datos.cliente_nombre.trim() || null,
      cliente_dni: datos.cliente_dni.trim() || null,
      cliente_calidad: datos.cliente_calidad.trim() || null,
      inmueble_descripcion: datos.inmueble_descripcion.trim() || null,
      honorarios_porcentaje: datos.honorarios_porcentaje,
      honorarios_minimo: datos.honorarios_minimo,
      reparto_propiedad_pct: datos.reparto_propiedad_pct,
      reparto_agencia_pct: datos.reparto_agencia_pct,
      clausulas_personalizadas: datos.clausulas_personalizadas as unknown as Json,
      updated_at: new Date().toISOString(),
    };
    if (documentoId) {
      const { error } = await supabase.from("hojas_encargo_honorarios").update(payload).eq("id", documentoId);
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return false;
      }
      toast.success("Hoja de encargo guardada.");
      return true;
    }
    const { data, error } = await supabase
      .from("hojas_encargo_honorarios")
      .insert({
        ...payload,
        user_id: authUser.id,
        comercial_id: authUser.id,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error(error?.message ?? "No se ha podido guardar.");
      return false;
    }
    altaBorrador.consumir();
    toast.success("Hoja de encargo guardada.");
    router.replace(`/hojas-encargo-honorarios/${data.id}`);
    router.refresh();
    return true;
  };

  const descargar = async () => {
    setPrinting(true);
    try {
      await downloadHojaEncargoHonorariosPdf(datos);
      toast.success("PDF descargado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se ha podido generar el PDF.");
    } finally {
      setPrinting(false);
    }
  };

  const imprimir = useImprimirDocumento(htmlExport, guardar, { prepararHtml: prepararDocumentoExportHtml });

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-foreground" />
      </div>
    );
  }

  const form = (
    <div className="space-y-4">
      <section className="rounded-[14px] border border-border bg-white p-4 min-[820px]:p-5">
        <h2 className="text-[15px] font-semibold">Fecha y lugar</h2>
        <div className="mt-4 grid gap-4 min-[820px]:grid-cols-2">
          <div>
            <Label htmlFor="lugar">Lugar</Label>
            <Input id="lugar" className="mt-1.5" value={datos.lugar} onChange={(e) => setDatos((d) => ({ ...d, lugar: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="fecha">Fecha</Label>
            <Input
              id="fecha"
              type="date"
              className="mt-1.5"
              value={datos.fecha ?? ""}
              onChange={(e) => setDatos((d) => ({ ...d, fecha: e.target.value || null }))}
            />
          </div>
        </div>
      </section>

      <section className="rounded-[14px] border border-border bg-white p-4 min-[820px]:p-5">
        <h2 className="text-[15px] font-semibold">Cliente e inmueble</h2>
        <div className="mt-4 grid gap-4 min-[820px]:grid-cols-2">
          <div className="min-[820px]:col-span-2">
            <Label>Nombre del cliente</Label>
            <Input
              className="mt-1.5"
              value={datos.cliente_nombre}
              onChange={(e) => setDatos((d) => ({ ...d, cliente_nombre: e.target.value }))}
            />
          </div>
          <div>
            <Label>DNI</Label>
            <Input className="mt-1.5" value={datos.cliente_dni} onChange={(e) => setDatos((d) => ({ ...d, cliente_dni: e.target.value }))} />
          </div>
          <div>
            <Label>Calidad</Label>
            <Input
              className="mt-1.5"
              value={datos.cliente_calidad}
              onChange={(e) => setDatos((d) => ({ ...d, cliente_calidad: e.target.value }))}
              placeholder="propietario/a"
            />
          </div>
          <div className="min-[820px]:col-span-2">
            <Label>Inmueble</Label>
            <Input
              className="mt-1.5"
              value={datos.inmueble_descripcion}
              onChange={(e) => setDatos((d) => ({ ...d, inmueble_descripcion: e.target.value }))}
            />
          </div>
        </div>
      </section>

      <section className="rounded-[14px] border border-border bg-white p-4 min-[820px]:p-5">
        <h2 className="text-[15px] font-semibold">Honorarios</h2>
        <div className="mt-4 grid gap-4 min-[820px]:grid-cols-2">
          <div>
            <Label>% honorarios</Label>
            <Input
              type="number"
              step="0.01"
              className="mt-1.5"
              value={datos.honorarios_porcentaje}
              onChange={(e) => setDatos((d) => ({ ...d, honorarios_porcentaje: Number(e.target.value) || 0 }))}
            />
          </div>
          <div>
            <Label>Mínimo (€)</Label>
            <Input
              type="number"
              step="0.01"
              className="mt-1.5"
              value={datos.honorarios_minimo}
              onChange={(e) => setDatos((d) => ({ ...d, honorarios_minimo: Number(e.target.value) || 0 }))}
            />
          </div>
          <div>
            <Label>% propiedad (arras fallidas)</Label>
            <Input
              type="number"
              step="0.01"
              className="mt-1.5"
              value={datos.reparto_propiedad_pct}
              onChange={(e) => setDatos((d) => ({ ...d, reparto_propiedad_pct: Number(e.target.value) || 0 }))}
            />
          </div>
          <div>
            <Label>% agencia (arras fallidas)</Label>
            <Input
              type="number"
              step="0.01"
              className="mt-1.5"
              value={datos.reparto_agencia_pct}
              onChange={(e) => setDatos((d) => ({ ...d, reparto_agencia_pct: Number(e.target.value) || 0 }))}
            />
          </div>
          <div>
            <Label>Estado</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              <ToggleChip on={estado === "borrador"} onClick={() => setEstado("borrador")}>
                Borrador
              </ToggleChip>
              <ToggleChip on={estado === "cerrado"} onClick={() => setEstado("cerrado")}>
                Cerrado
              </ToggleChip>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  const eliminar = async () => {
    if (!documentoId) return;
    setDeleting(true);
    const result = await eliminarDocumentos("hoja_encargo_honorarios", [documentoId]);
    setDeleting(false);
    setShowDeleteConfirm(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message ?? "Enviado a la papelera.");
    router.push("/hojas-encargo-honorarios");
    router.refresh();
  };

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <Link
          href="/herramientas"
          aria-label="Volver"
          className="flex shrink-0 items-center justify-center rounded-lg text-neutral-600 hover:text-foreground"
        >
          <ChevronLeft className="h-7 w-7" strokeWidth={1.5} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight min-[820px]:text-[28px]">
            {documentoId ? "Hoja de encargo" : "Nueva hoja de encargo"}
          </h1>
          <p className="mt-1 text-[13px] text-[var(--text-2)]">
            Reconocimiento de honorarios con LOPD de Rehabinco.
          </p>
          {admin && metaCreador ? (
            <CreadorDocumento
              userId={metaCreador.user_id}
              comercialId={metaCreador.comercial_id}
              creador={metaCreador.creador}
              viewerId={user?.id}
              admin
              variant="detalle"
              size={24}
              className="mt-2"
            />
          ) : null}
        </div>
        <div className="hidden gap-2 min-[820px]:flex">
          {documentoId ? (
            <Button
              type="button"
              variant="secondary"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => setShowDeleteConfirm(true)}
              aria-label="Eliminar"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          ) : null}
          <Button type="button" variant="secondary" onClick={imprimir.pedirImprimir}>
            Imprimir
          </Button>
          <Button type="button" onClick={() => void guardar()} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>

      <AlertDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="¿Eliminar esta hoja de encargo?"
        description="Irá a la papelera de Herramientas para confirmar el borrado definitivo."
        confirmLabel={deleting ? "Enviando…" : "Enviar a papelera"}
        onConfirm={() => void eliminar()}
        loading={deleting}
        variant="destructive"
      />

      <DocumentoSplit
        form={form}
        preview={
          <PdfFrameEditable
            html={htmlPreview}
            onClausulasChange={setClausulasPersonalizadas}
            onRestablecerClausulas={() => {
              setDatos((d) => ({ ...d, clausulas_personalizadas: {} }));
              toast.message("Cláusulas restablecidas desde el formulario.");
            }}
            tienePersonalizadas={tieneClausulasPersonalizadas}
            onDownload={descargar}
            downloading={printing}
            onPrint={imprimir.pedirImprimir}
          />
        }
      />

      {imprimir.dialogo}

      <div className="fixed bottom-0 left-0 right-0 z-40 flex gap-2 border-t border-border bg-white/95 px-4 py-3 min-[820px]:hidden">
        {documentoId ? (
          <Button
            type="button"
            variant="secondary"
            className="shrink-0 text-red-600"
            onClick={() => setShowDeleteConfirm(true)}
            aria-label="Eliminar"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
          </Button>
        ) : null}
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
