"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { eliminarDocumentos } from "@/lib/actions/papelera";
import { useAuth } from "@/lib/auth/auth-context";
import { isAdmin } from "@/lib/auth/roles";
import { relacionUno } from "@/lib/citas/citas";
import { CreadorDocumento } from "@/components/documentos/CreadorDocumento";
import { PersonaArrasCard } from "@/components/documentos/PersonaArrasCard";
import { Button } from "@/components/ui/button";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { DocumentoSplit } from "@/components/documentos/DocumentoSplit";
import { PdfFrameEditable } from "@/components/documentos/PdfFrameEditable";
import { useImprimirDocumento } from "@/components/documentos/DialogoGuardarAlImprimir";
import {
  personaArrasVacia,
  type ClausulasPersonalizadasArras,
  type PersonaArras,
} from "@/lib/contrato-arras";
import { clausulasPersonalizadasDesdeEdicion } from "@/lib/contrato-arras-preview";
import {
  contratoPagoAplazadoDesdeFila,
  contratoPagoAplazadoVacio,
  type ClausulasPersonalizadasPagoAplazado,
  type ContratoPagoAplazadoDatos,
} from "@/lib/contrato-pago-aplazado";
import {
  downloadContratoPagoAplazadoPdf,
  htmlContratoPagoAplazado,
  htmlContratoPagoAplazadoExport,
  textosContratoPagoAplazado,
} from "@/lib/contrato-pago-aplazado-pdf";
import { prepararDocumentoExportHtml } from "@/lib/documentos-paginacion";
import { EMPRESA_DOCUMENTOS } from "@/lib/empresa-documentos";
import { altaCamposVacios, leerAltaBorrador } from "@/lib/ui/alta-borrador";
import { useAltaBorrador } from "@/lib/ui/use-alta-borrador";
import type { Json } from "@/lib/supabase/types";

const area =
  "mt-1.5 min-h-[5.5rem] w-full resize-y rounded-[9px] border border-[var(--input)] bg-white px-3 py-2.5 text-[13.5px] outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/15 max-[819px]:text-base";

function personasVacias(personas: PersonaArras[]) {
  return personas.every((p) => altaCamposVacios(p.nombre, p.estado_civil, p.domicilio, p.dni));
}

function snapVacio(s: ContratoPagoAplazadoDatos) {
  return (
    personasVacias(s.vendedores) &&
    personasVacias(s.compradores) &&
    altaCamposVacios(s.finca_descripcion, s.cuenta_vendedora, s.titulo_adquisicion)
  );
}

export function ContratoPagoAplazadoEditor({ contratoId }: { contratoId?: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const admin = isAdmin(user?.role);
  const [metaCreador, setMetaCreador] = useState<{
    user_id: string;
    comercial_id: string | null;
    creador: { nombre_completo?: string | null; color?: string | null; email?: string | null } | null;
  } | null>(null);
  const [loading, setLoading] = useState(Boolean(contratoId));
  const [datos, setDatos] = useState<ContratoPagoAplazadoDatos>(() => ({
    ...contratoPagoAplazadoVacio(),
    fecha: new Date().toISOString().slice(0, 10),
  }));
  const [estado, setEstado] = useState<"borrador" | "cerrado">("borrador");
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [listo, setListo] = useState(!contratoId);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const altaBorrador = useAltaBorrador({
    tipo: "pago-aplazado",
    ambito: contratoId ? `id:${contratoId}` : "libre",
    open: !contratoId && listo,
    snapshot: datos,
    estaVacio: snapVacio,
  });

  const htmlPreview = useMemo(() => htmlContratoPagoAplazado(datos, { editable: true }), [datos]);
  const htmlExport = useMemo(() => htmlContratoPagoAplazadoExport(datos), [datos]);
  const tieneClausulasPersonalizadas = Object.keys(datos.clausulas_personalizadas ?? {}).length > 0;

  const setClausulasPersonalizadas = (clausulas: ClausulasPersonalizadasArras) => {
    setDatos((d) => {
      const generadas = textosContratoPagoAplazado({ ...d, clausulas_personalizadas: {} });
      return {
        ...d,
        clausulas_personalizadas: clausulasPersonalizadasDesdeEdicion(
          clausulas as ClausulasPersonalizadasPagoAplazado,
          generadas
        ),
      };
    });
  };

  useEffect(() => {
    if (contratoId) return;
    const guardado = leerAltaBorrador<ContratoPagoAplazadoDatos>("pago-aplazado", "libre");
    if (guardado && !snapVacio(guardado.data)) {
      setDatos({
        ...contratoPagoAplazadoVacio(),
        ...guardado.data,
        fecha: guardado.data.fecha || new Date().toISOString().slice(0, 10),
      });
    }
    setListo(true);
  }, [contratoId]);

  useEffect(() => {
    if (!contratoId) return;
    const supabase = createClient();
    void supabase
      .from("contratos_pago_aplazado")
      .select("*, creador:comercial_id(nombre_completo, color, email)")
      .eq("id", contratoId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          toast.error(error?.message ?? "No se ha podido cargar el contrato.");
          setLoading(false);
          return;
        }
        setDatos(contratoPagoAplazadoDesdeFila(data));
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
  }, [contratoId]);

  const setPersonas = (lado: "vendedores" | "compradores", next: PersonaArras[]) => {
    setDatos((d) => ({ ...d, [lado]: next }));
  };

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
      vendedores: datos.vendedores as unknown as Json,
      compradores: datos.compradores as unknown as Json,
      finca_descripcion: datos.finca_descripcion.trim() || null,
      titulo_adquisicion: datos.titulo_adquisicion.trim() || null,
      precio: datos.precio,
      pago_inicial: datos.pago_inicial,
      cuota_mensual: datos.cuota_mensual,
      cuota_desde: datos.cuota_desde.trim() || null,
      cuenta_vendedora: datos.cuenta_vendedora.trim() || null,
      plazo_escritura: datos.plazo_escritura.trim() || null,
      plazo_posesion: datos.plazo_posesion.trim() || null,
      penalizacion_mensual: datos.penalizacion_mensual,
      clausulas_personalizadas: datos.clausulas_personalizadas as unknown as Json,
      updated_at: new Date().toISOString(),
    };
    if (contratoId) {
      const { error } = await supabase.from("contratos_pago_aplazado").update(payload).eq("id", contratoId);
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return false;
      }
      toast.success("Contrato guardado.");
      return true;
    }
    const { data, error } = await supabase
      .from("contratos_pago_aplazado")
      .insert({ ...payload, user_id: authUser.id, comercial_id: authUser.id })
      .select("id")
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error(error?.message ?? "No se ha podido guardar.");
      return false;
    }
    altaBorrador.consumir();
    toast.success("Contrato guardado.");
    router.replace(`/contratos-pago-aplazado/${data.id}`);
    router.refresh();
    return true;
  };

  const descargar = async () => {
    setPrinting(true);
    try {
      await downloadContratoPagoAplazadoPdf(datos);
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
            <Label>Lugar</Label>
            <Input className="mt-1.5" value={datos.lugar} onChange={(e) => setDatos((d) => ({ ...d, lugar: e.target.value }))} />
          </div>
          <div>
            <Label>Fecha</Label>
            <Input
              type="date"
              className="mt-1.5"
              value={datos.fecha ?? ""}
              onChange={(e) => setDatos((d) => ({ ...d, fecha: e.target.value || null }))}
            />
          </div>
        </div>
      </section>

      {(["vendedores", "compradores"] as const).map((lado) => (
        <section key={lado} className="rounded-[14px] border border-border bg-white p-4 min-[820px]:p-5">
          <h2 className="text-[15px] font-semibold">{lado === "vendedores" ? "Parte vendedora" : "Parte compradora"}</h2>
          <div className="mt-4 space-y-3">
            {datos[lado].map((persona, i) => (
              <PersonaArrasCard
                key={`${lado}-${i}`}
                titulo={`${persona.tratamiento} ${i + 1}`}
                persona={persona}
                onChange={(p) => {
                  const next = [...datos[lado]];
                  next[i] = p;
                  setPersonas(lado, next);
                }}
                onRemove={() => setPersonas(lado, datos[lado].filter((_, idx) => idx !== i))}
                puedeQuitar={datos[lado].length > 1}
              />
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-1.5"
              onClick={() => setPersonas(lado, [...datos[lado], personaArrasVacia(lado === "vendedores" ? "Don" : "Doña")])}
            >
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              Añadir
            </Button>
          </div>
        </section>
      ))}

      <section className="rounded-[14px] border border-border bg-white p-4 min-[820px]:p-5">
        <h2 className="text-[15px] font-semibold">Finca y título</h2>
        <div className="mt-4 space-y-4">
          <div>
            <Label>Descripción de la finca</Label>
            <textarea
              className={area}
              value={datos.finca_descripcion}
              onChange={(e) => setDatos((d) => ({ ...d, finca_descripcion: e.target.value }))}
            />
          </div>
          <div>
            <Label>Título adquisitivo</Label>
            <textarea
              className={area}
              value={datos.titulo_adquisicion}
              onChange={(e) => setDatos((d) => ({ ...d, titulo_adquisicion: e.target.value }))}
              placeholder="por compra efectuada a … ante el Notario de …"
            />
          </div>
        </div>
      </section>

      <section className="rounded-[14px] border border-border bg-white p-4 min-[820px]:p-5">
        <h2 className="text-[15px] font-semibold">Precio y plazos</h2>
        <div className="mt-4 grid gap-4 min-[820px]:grid-cols-2">
          <div>
            <Label>Precio total (€)</Label>
            <Input
              type="number"
              step="0.01"
              className="mt-1.5"
              value={datos.precio ?? ""}
              onChange={(e) => setDatos((d) => ({ ...d, precio: e.target.value === "" ? null : Number(e.target.value) }))}
            />
          </div>
          <div>
            <Label>Pago inicial (€)</Label>
            <Input
              type="number"
              step="0.01"
              className="mt-1.5"
              value={datos.pago_inicial ?? ""}
              onChange={(e) =>
                setDatos((d) => ({ ...d, pago_inicial: e.target.value === "" ? null : Number(e.target.value) }))
              }
            />
          </div>
          <div>
            <Label>Cuota mensual (€)</Label>
            <Input
              type="number"
              step="0.01"
              className="mt-1.5"
              value={datos.cuota_mensual ?? ""}
              onChange={(e) =>
                setDatos((d) => ({ ...d, cuota_mensual: e.target.value === "" ? null : Number(e.target.value) }))
              }
            />
          </div>
          <div>
            <Label>Cuotas desde</Label>
            <Input
              className="mt-1.5"
              value={datos.cuota_desde}
              onChange={(e) => setDatos((d) => ({ ...d, cuota_desde: e.target.value }))}
              placeholder="enero 2026"
            />
          </div>
          <div className="min-[820px]:col-span-2">
            <Label>Cuenta vendedora</Label>
            <Input
              className="mt-1.5"
              value={datos.cuenta_vendedora}
              onChange={(e) => setDatos((d) => ({ ...d, cuenta_vendedora: e.target.value }))}
            />
          </div>
          <div>
            <Label>Plazo escritura</Label>
            <Input
              className="mt-1.5"
              value={datos.plazo_escritura}
              onChange={(e) => setDatos((d) => ({ ...d, plazo_escritura: e.target.value }))}
            />
          </div>
          <div>
            <Label>Plazo posesión</Label>
            <Input
              className="mt-1.5"
              value={datos.plazo_posesion}
              onChange={(e) => setDatos((d) => ({ ...d, plazo_posesion: e.target.value }))}
            />
          </div>
          <div>
            <Label>Penalización mensual (€)</Label>
            <Input
              type="number"
              step="0.01"
              className="mt-1.5"
              value={datos.penalizacion_mensual ?? ""}
              onChange={(e) =>
                setDatos((d) => ({
                  ...d,
                  penalizacion_mensual: e.target.value === "" ? null : Number(e.target.value),
                }))
              }
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
    if (!contratoId) return;
    setDeleting(true);
    const result = await eliminarDocumentos("contrato_pago_aplazado", [contratoId]);
    setDeleting(false);
    setShowDeleteConfirm(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message ?? "Enviado a la papelera.");
    router.push("/contratos-pago-aplazado");
    router.refresh();
  };

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <Link href="/herramientas" aria-label="Volver" className="flex shrink-0 items-center justify-center rounded-lg text-neutral-600 hover:text-foreground">
          <ChevronLeft className="h-7 w-7" strokeWidth={1.5} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight min-[820px]:text-[28px]">
            {contratoId ? "Compraventa aplazada" : "Nueva compraventa aplazada"}
          </h1>
          <p className="mt-1 text-[13px] text-[var(--text-2)]">Pago aplazado con LOPD de Rehabinco.</p>
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
          {contratoId ? (
            <Button type="button" variant="secondary" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setShowDeleteConfirm(true)} aria-label="Eliminar">
              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          ) : null}
          <Button type="button" variant="secondary" onClick={imprimir.pedirImprimir}>Imprimir</Button>
          <Button type="button" onClick={() => void guardar()} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
        </div>
      </div>

      <AlertDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="¿Eliminar este contrato?"
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
        {contratoId ? (
          <Button type="button" variant="secondary" className="shrink-0 text-red-600" onClick={() => setShowDeleteConfirm(true)} aria-label="Eliminar">
            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
          </Button>
        ) : null}
        <Button type="button" variant="secondary" className="flex-1" onClick={imprimir.pedirImprimir}>Imprimir</Button>
        <Button type="button" className="flex-1" onClick={() => void guardar()} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
      </div>
    </div>
  );
}
