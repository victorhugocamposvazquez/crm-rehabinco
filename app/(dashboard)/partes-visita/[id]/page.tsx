"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { eliminarDocumentos } from "@/lib/actions/papelera";
import { useAuth } from "@/lib/auth/auth-context";
import { isSuperAdmin } from "@/lib/auth/roles";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog } from "@/components/ui/alert-dialog";
import {
  Pencil,
  Trash2,
  Copy,
  ExternalLink,
  CheckCircle2,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import {
  ESTADO_PARTE_LABELS,
  buildPublicFirmaUrl,
  contextoCatastralDesdeProperty,
  formatHoraVisita,
  type ContextoCatastralVisita,
} from "@/lib/partes-visita";
import { VisitContextoCatastro } from "@/components/partes-visita/VisitContextoCatastro";
import { FichaLink } from "@/components/crm/FichaPeek";
import { PdfFrame } from "@/components/documentos/DocumentoSplit";
import { imprimirDocumentoHtml } from "@/lib/documentos-pdf";
import { prepararDocumentoExportHtml } from "@/lib/documentos-paginacion";
import { downloadParteVisitaPdf, htmlParteVisita, parseCalidadVisita } from "@/lib/parte-visita-pdf";

interface ParteVisita {
  id: string;
  token: string;
  estado: "borrador" | "pendiente_firma" | "firmado";
  visitante_nombre: string | null;
  visitante_documento: string | null;
  visitante_telefono: string | null;
  visitante_email: string | null;
  inmueble_direccion: string | null;
  inmueble_referencia: string | null;
  fecha_visita: string | null;
  hora_visita: string | null;
  hora_fin: string | null;
  calidad: "comprador" | "arrendatario" | null;
  agente_nombre: string | null;
  observaciones: string | null;
  lugar_firma: string;
  firma_visitante: string | null;
  firma_agente: string | null;
  firmado_en: string | null;
  propiedad_id: string | null;
}

function estadoVariant(
  estado: ParteVisita["estado"]
): "borrador" | "emitida" | "pagada" | "default" {
  if (estado === "borrador") return "borrador";
  if (estado === "pendiente_firma") return "emitida";
  if (estado === "firmado") return "pagada";
  return "default";
}

export default function DetalleParteVisitaPage() {
  const { user } = useAuth();
  const superadmin = isSuperAdmin(user?.role);
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [parte, setParte] = useState<ParteVisita | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activating, setActivating] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [contextoCatastro, setContextoCatastro] = useState<ContextoCatastralVisita>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("partes_visita")
      .select("*")
      .eq("id", id)
      .single()
      .then(async ({ data, error: err }) => {
        if (err) {
          setError(err.message);
          setParte(null);
          setLoading(false);
          return;
        }
        const parte = data as ParteVisita;
        setParte(parte);
        if (parte.propiedad_id) {
          const { data: propiedad } = await supabase
            .from("propiedades")
            .select("origen, referencia_catastral, catastro_property_links(finca_reference)")
            .eq("id", parte.propiedad_id)
            .maybeSingle();
          const link = Array.isArray(propiedad?.catastro_property_links)
            ? propiedad?.catastro_property_links[0]
            : propiedad?.catastro_property_links;
          setContextoCatastro(
            contextoCatastralDesdeProperty({
              origen: propiedad?.origen,
              referenciaCatastral: propiedad?.referencia_catastral,
              link: link ? { fincaReference: link.finca_reference } : null,
            })
          );
        }
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-foreground" />
      </div>
    );
  }

  if (error || !parte) {
    return (
      <div className="animate-[fadeIn_0.3s_ease-out]">
        <p className="text-red-600">{error ?? "Parte no encontrado"}</p>
        <Button variant="secondary" asChild className="mt-4">
          <Link href="/partes-visita">Volver a partes de visita</Link>
        </Button>
      </div>
    );
  }

  const publicUrl = buildPublicFirmaUrl(parte.token);
  const canShare = parte.estado === "pendiente_firma";
  const datosPdf = {
    visitante_nombre: parte.visitante_nombre,
    visitante_documento: parte.visitante_documento,
    inmueble_direccion: parte.inmueble_direccion,
    fecha_visita: parte.fecha_visita,
    hora_visita: parte.hora_visita,
    hora_fin: parte.hora_fin,
    calidad: parseCalidadVisita(parte.calidad),
    agente_nombre: parte.agente_nombre,
    lugar_firma: parte.lugar_firma,
    firma_visitante: parte.firma_visitante,
  };
  const html = htmlParteVisita(datosPdf);

  const imprimir = () => {
    void prepararDocumentoExportHtml(html)
      .then(imprimirDocumentoHtml)
      .catch((err) => toast.error(err instanceof Error ? err.message : "No se ha podido imprimir"));
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success("Enlace de firma copiado");
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  };

  const activateForSigning = async () => {
    setActivating(true);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("partes_visita")
      .update({ estado: "pendiente_firma", updated_at: new Date().toISOString() })
      .eq("id", id);
    setActivating(false);
    if (err) {
      toast.error(err.message);
      return;
    }
    setParte((p) => (p ? { ...p, estado: "pendiente_firma" } : p));
    toast.success("Parte listo para firmar");
  };

  const handleDelete = async () => {
    setDeleting(true);
    const result = await eliminarDocumentos("parte_visita", [id]);
    setDeleting(false);
    setShowDeleteConfirm(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success(result.message ?? "Parte eliminado.");
    router.push("/partes-visita");
    router.refresh();
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Herramientas", href: "/herramientas" },
          { label: "Partes de visita", href: "/partes-visita" },
          { label: parte.visitante_nombre || "Sin visitante" },
        ]}
        title={parte.visitante_nombre || "Parte de visita"}
        description={parte.inmueble_direccion ?? undefined}
        actions={
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={imprimir}
              className="gap-2"
            >
              Imprimir
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={printing}
              onClick={() => {
                setPrinting(true);
                void downloadParteVisitaPdf(datosPdf)
                  .then(() => toast.success("PDF descargado"))
                  .catch((err) => toast.error(err instanceof Error ? err.message : "No se ha podido generar el PDF"))
                  .finally(() => setPrinting(false));
              }}
              className="gap-2"
            >
              <Download className="h-4 w-4" strokeWidth={1.5} />
              {printing ? "Generando…" : "PDF"}
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link href={`/partes-visita/${id}/editar`} className="gap-2">
                <Pencil className="h-4 w-4" strokeWidth={1.5} />
                Editar
              </Link>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => setShowDeleteConfirm(true)}
              aria-label="Eliminar parte"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge variant={estadoVariant(parte.estado)}>
          {ESTADO_PARTE_LABELS[parte.estado]}
        </Badge>
        {parte.firmado_en && (
          <span className="inline-flex items-center gap-1 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
            Firmado el{" "}
            {new Date(parte.firmado_en).toLocaleString("es-ES", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        )}
      </div>

      <AlertDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="¿Eliminar este parte de visita?"
        description={
          superadmin
            ? "Se borrará de forma permanente."
            : "Irá a la papelera del superadministrador para confirmar el borrado definitivo."
        }
        confirmLabel={deleting ? "Eliminando…" : superadmin ? "Eliminar" : "Enviar a papelera"}
        onConfirm={handleDelete}
        loading={deleting}
        variant="destructive"
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Enlace de firma pública</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {parte.estado === "borrador" && (
            <div className="space-y-3">
              <p className="text-sm text-neutral-600">
                Este parte está en borrador. Actívalo para generar un enlace que
                el visitante pueda abrir y firmar con el dedo.
              </p>
              <Button onClick={activateForSigning} disabled={activating} size="sm">
                {activating ? "Activando…" : "Activar para firma"}
              </Button>
            </div>
          )}
          {canShare && (
            <>
              <p className="break-all rounded-lg bg-neutral-50 px-3 py-2 text-sm text-foreground">
                {publicUrl}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={copyLink} className="gap-2">
                  <Copy className="h-4 w-4" strokeWidth={1.5} />
                  Copiar enlace
                </Button>
                <Button variant="secondary" size="sm" asChild>
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="gap-2"
                  >
                    <ExternalLink className="h-4 w-4" strokeWidth={1.5} />
                    Abrir vista de firma
                  </a>
                </Button>
              </div>
            </>
          )}
          {parte.estado === "firmado" && (
            <p className="text-sm text-neutral-600">
              El documento ya está firmado. Puedes consultarlo abajo.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Visitante</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-neutral-500">Nombre:</span>{" "}
              {parte.visitante_nombre ?? "—"}
            </p>
            <p>
              <span className="text-neutral-500">DNI / NIE:</span>{" "}
              {parte.visitante_documento ?? "—"}
            </p>
            <p>
              <span className="text-neutral-500">Teléfono:</span>{" "}
              {parte.visitante_telefono ?? "—"}
            </p>
            <p>
              <span className="text-neutral-500">Email:</span>{" "}
              {parte.visitante_email ?? "—"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inmueble y visita</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {contextoCatastro ? <VisitContextoCatastro contexto={contextoCatastro} /> : null}
            {parte.propiedad_id ? (
              <p>
                <span className="text-neutral-500">Propiedad:</span>{" "}
                <FichaLink tipo="propiedad" id={parte.propiedad_id} className="font-medium">
                  Ver ficha
                </FichaLink>
              </p>
            ) : null}
            <p>
              <span className="text-neutral-500">Dirección:</span>{" "}
              {parte.inmueble_direccion ?? "—"}
            </p>
            <p>
              <span className="text-neutral-500">Referencia:</span>{" "}
              {parte.inmueble_referencia ?? "—"}
            </p>
            <p>
              <span className="text-neutral-500">Fecha:</span>{" "}
              {parte.fecha_visita
                ? new Date(`${parte.fecha_visita}T12:00:00`).toLocaleDateString(
                    "es-ES"
                  )
                : "—"}
            </p>
            <p>
              <span className="text-neutral-500">Hora:</span>{" "}
              {parte.hora_fin
                ? `${formatHoraVisita(parte.hora_visita)} – ${formatHoraVisita(parte.hora_fin)}`
                : formatHoraVisita(parte.hora_visita)}
            </p>
            <p>
              <span className="text-neutral-500">Agente:</span>{" "}
              {parte.agente_nombre ?? "—"}
            </p>
          </CardContent>
        </Card>

        {parte.observaciones && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Observaciones</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{parte.observaciones}</p>
            </CardContent>
          </Card>
        )}

        <div className="md:col-span-2">
          <PdfFrame
            html={html}
            pages={1}
            onDownload={() => downloadParteVisitaPdf(datosPdf)}
            downloading={printing}
            onPrint={imprimir}
          />
        </div>
      </div>
    </div>
  );
}
